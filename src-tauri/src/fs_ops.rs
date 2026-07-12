use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::Serialize;
use std::io::Read;
use std::path::{Path, PathBuf};

#[derive(Serialize)]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
}

// HEAVY_DIRS lives in search.rs (and is the authoritative list of paths to
// skip during walks). list_dir below intentionally does NOT skip them —
// the file-tree shows every direct child, and the user expands manually.

const MAX_READ_BYTES: u64 = 8 * 1024 * 1024; // 8 MiB
const BINARY_PROBE_BYTES: usize = 8 * 1024;

#[tauri::command]
pub fn list_dir(path: String) -> Result<Vec<DirEntry>, String> {
    let p = Path::new(&path);
    let mut out = Vec::new();
    let read = std::fs::read_dir(p).map_err(|e| e.to_string())?;
    for entry in read.flatten() {
        let meta = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        let name = entry.file_name().to_string_lossy().into_owned();
        let is_dir = meta.is_dir();
        out.push(DirEntry {
            name,
            path: entry.path().to_string_lossy().into_owned(),
            is_dir,
        });
    }
    out.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });
    Ok(out)
}

fn looks_binary(buf: &[u8]) -> bool {
    // Heuristic: if there's a NUL anywhere in the probe window, treat as
    // binary. The caller passes only the first BINARY_PROBE_BYTES of the
    // file so we can't get fooled by a NUL deep in a giant text file.
    buf.contains(&0)
}

#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    let p = Path::new(&path);
    let meta = std::fs::metadata(p).map_err(|e| e.to_string())?;
    if meta.len() > MAX_READ_BYTES {
        return Err(format!(
            "File is too large to open in editor ({} MiB > {} MiB).",
            meta.len() / (1024 * 1024),
            MAX_READ_BYTES / (1024 * 1024)
        ));
    }
    // Two-stage read: probe the first 8 KiB first, bail early if it
    // looks binary (NUL byte). Previous code did fs::read which pulled
    // up to 8 MiB before probing — meaningful waste on slow disks or
    // when a user accidentally clicks an mp4 / pyc / lockfile.
    let mut f = std::fs::File::open(p).map_err(|e| e.to_string())?;
    let mut probe = vec![0u8; BINARY_PROBE_BYTES];
    let probed = f.read(&mut probe).map_err(|e| e.to_string())?;
    probe.truncate(probed);
    if looks_binary(&probe) {
        return Err("File appears to be binary.".to_string());
    }
    // Buffer the rest of the file, prepending the probe we already read.
    let total = meta.len() as usize;
    let mut bytes = Vec::with_capacity(total.max(probed));
    bytes.extend_from_slice(&probe);
    f.read_to_end(&mut bytes).map_err(|e| e.to_string())?;
    Ok(decode_text_bytes(&bytes))
}

/// Decode arbitrary text bytes, tolerating common non-UTF-8 encodings
/// (GBK / GB2312 / Big5 / Shift-JIS / EUC-KR / Windows-125x). Strategy:
///
///   1. Strip UTF-8 BOM if present and the rest is valid UTF-8.
///   2. Honour explicit UTF-16 BOMs.
///   3. Try plain UTF-8.
///   4. Fall back to chardetng + encoding_rs for everything else.
///
/// Always returns a String — never errors. Garbage in → "best-guess"
/// out, which is exactly how every other editor handles legacy files.
fn decode_text_bytes(bytes: &[u8]) -> String {
    // 1. UTF-8 BOM (EF BB BF).
    if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
        if let Ok(s) = std::str::from_utf8(&bytes[3..]) {
            return s.to_string();
        }
    }
    // 2. UTF-16 LE / BE BOMs.
    if bytes.starts_with(&[0xFF, 0xFE]) {
        let (cow, _, _) = encoding_rs::UTF_16LE.decode(&bytes[2..]);
        return cow.into_owned();
    }
    if bytes.starts_with(&[0xFE, 0xFF]) {
        let (cow, _, _) = encoding_rs::UTF_16BE.decode(&bytes[2..]);
        return cow.into_owned();
    }
    // 3. Plain UTF-8 — most files.
    if let Ok(s) = std::str::from_utf8(bytes) {
        return s.to_string();
    }
    // 4. Sniff legacy encoding (GBK, Shift_JIS, etc.) and decode.
    let mut detector = chardetng::EncodingDetector::new();
    detector.feed(bytes, true);
    let encoding = detector.guess(None, true);
    let (cow, _, _) = encoding.decode(bytes);
    cow.into_owned()
}

#[tauri::command]
pub fn write_file(path: String, contents: String) -> Result<(), String> {
    crate::atomic::write(Path::new(&path), contents.as_bytes()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn rename_path(from: String, to: String) -> Result<(), String> {
    std::fs::rename(&from, &to).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_path(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    // Recycle Bin first — a mis-confirmed delete of a folder was
    // unrecoverable with remove_dir_all, and every desktop OS has a
    // native undo path. Fall back to permanent removal only where no
    // trash facility exists (headless Linux, some network shares).
    match trash::delete(p) {
        Ok(()) => Ok(()),
        Err(_) => {
            if p.is_dir() {
                std::fs::remove_dir_all(p).map_err(|e| e.to_string())
            } else {
                std::fs::remove_file(p).map_err(|e| e.to_string())
            }
        }
    }
}

#[tauri::command]
pub fn create_dir(path: String) -> Result<(), String> {
    std::fs::create_dir_all(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn path_exists(path: String) -> bool {
    Path::new(&path).exists()
}

#[tauri::command]
pub fn create_file(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if let Some(parent) = p.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    if p.exists() {
        return Err("File already exists".to_string());
    }
    std::fs::write(&p, "").map_err(|e| e.to_string())
}

/// Persist a chat image attachment outside the workspace (system temp dir)
/// and return its absolute path. The frontend already compressed + encoded
/// the image (WebP/JPEG) and sends the bytes base64; here we just decode and
/// write. Lives in temp so we never dirty the user's repo — Claude Code
/// reads it back with its Read tool (the path is inlined into the prompt).
#[tauri::command]
pub fn save_image_attachment(filename: String, data_b64: String) -> Result<String, String> {
    let dir = std::env::temp_dir().join("quack-attachments");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    // Strip any directory components from the frontend-supplied name so a
    // crafted value (e.g. "../foo") can't escape the attachments dir.
    let safe = Path::new(&filename)
        .file_name()
        .ok_or_else(|| "invalid filename".to_string())?
        .to_string_lossy()
        .into_owned();
    let bytes = STANDARD
        .decode(data_b64.as_bytes())
        .map_err(|e| e.to_string())?;
    let path = dir.join(safe);
    std::fs::write(&path, &bytes).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

/// Persist an image to a durable, caller-chosen directory (e.g. a preset's
/// `.codetta/avatars/`) rather than the ephemeral OS temp dir used by
/// `save_image_attachment`. Same decode + filename-sanitize logic; the
/// directory is created if missing.
#[tauri::command]
pub fn save_persistent_image(
    dir: String,
    filename: String,
    data_b64: String,
) -> Result<String, String> {
    let dir_path = PathBuf::from(&dir);
    std::fs::create_dir_all(&dir_path).map_err(|e| e.to_string())?;
    let safe = Path::new(&filename)
        .file_name()
        .ok_or_else(|| "invalid filename".to_string())?
        .to_string_lossy()
        .into_owned();
    let bytes = STANDARD
        .decode(data_b64.as_bytes())
        .map_err(|e| e.to_string())?;
    let path = dir_path.join(safe);
    std::fs::write(&path, &bytes).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

/// Read a binary media file (image or PDF) back as a `data:` URL. Used by
/// the chat zoom modal AND by the in-tab media preview (MediaPreviewPane).
/// Keeps base64 OUT of localStorage — callers ask for full quality on
/// demand. Mime is derived from the extension (good enough for previews).
#[tauri::command]
pub fn read_image_data_url(path: String) -> Result<String, String> {
    let p = Path::new(&path);
    let bytes = std::fs::read(p).map_err(|e| e.to_string())?;
    let mime = match p
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .as_deref()
    {
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("bmp") => "image/bmp",
        Some("ico") => "image/x-icon",
        Some("avif") => "image/avif",
        Some("pdf") => "application/pdf",
        _ => "application/octet-stream",
    };
    Ok(format!("data:{};base64,{}", mime, STANDARD.encode(&bytes)))
}
