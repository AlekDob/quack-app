//! Atomic file writes — write to a sibling temp file then rename over
//! the target. Three modules (fs_ops, workspace, claude_mcp) used to
//! re-implement this with subtly different suffixes and error handling;
//! consolidated here so the rename-on-same-volume invariant + tmp
//! cleanup on rename failure is enforced once.
//!
//! All variants:
//!   1. Build a sibling tmp path (same parent → same volume → rename
//!      is atomic on every supported OS, Windows ≥2019 included).
//!   2. Write the contents to the tmp file.
//!   3. Rename the tmp file over the target. On rename failure, do a
//!      best-effort `remove_file` on the tmp so a crash mid-write
//!      doesn't leave clutter behind forever.
//!
//! Tmp names are unique per call. A fixed `.codetta-tmp` sibling raced when
//! two writers (e.g. parallel `chat_store_save`) renamed the same path —
//! the second `rename` hit ENOENT → "Chat not saved" toast.

use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

const DEFAULT_SUFFIX: &str = ".codetta-tmp";
static TMP_SEQ: AtomicU64 = AtomicU64::new(1);

/// Write `contents` atomically to `path`. Creates parent directories
/// if needed. Uses a unique `.codetta-tmp.*` sibling so orphaned files
/// after a crash are easy to identify and concurrent writers don't collide.
pub fn write(path: &Path, contents: &[u8]) -> std::io::Result<()> {
    write_with_suffix(path, contents, DEFAULT_SUFFIX)
}

/// Write `contents` atomically with a caller-specified tmp suffix. The
/// suffix is appended to the full filename (so `state.json` →
/// `state.json{suffix}.{unique}`), preserving the original extension. Avoids
/// the `with_extension` footgun where a path without an extension
/// would silently produce a different tmp name.
pub fn write_with_suffix(
    path: &Path,
    contents: &[u8],
    suffix: &str,
) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let mut tmp = path.to_path_buf();
    let mut name = tmp
        .file_name()
        .map(|s| s.to_os_string())
        .unwrap_or_default();
    name.push(unique_tmp_tag(suffix));
    tmp.set_file_name(name);
    std::fs::write(&tmp, contents)?;
    match std::fs::rename(&tmp, path) {
        Ok(()) => Ok(()),
        Err(e) => {
            let _ = std::fs::remove_file(&tmp);
            Err(e)
        }
    }
}

fn unique_tmp_tag(suffix: &str) -> String {
    let seq = TMP_SEQ.fetch_add(1, Ordering::Relaxed);
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!("{suffix}.{nanos}.{seq}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::sync::{Arc, Barrier};
    use std::thread;

    #[test]
    fn concurrent_writes_do_not_enoent() {
        let dir = std::env::temp_dir().join(format!(
            "codetta-atomic-{}",
            TMP_SEQ.fetch_add(1, Ordering::Relaxed)
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let target = dir.join("session.json");
        let barrier = Arc::new(Barrier::new(8));
        let mut handles = Vec::new();
        for i in 0..8 {
            let barrier = Arc::clone(&barrier);
            let target = target.clone();
            handles.push(thread::spawn(move || {
                barrier.wait();
                let body = format!("{{\"n\":{i}}}");
                write(&target, body.as_bytes()).expect("concurrent write");
            }));
        }
        for h in handles {
            h.join().unwrap();
        }
        let raw = fs::read_to_string(&target).unwrap();
        assert!(raw.contains("\"n\":"), "final file written");
        let _ = fs::remove_dir_all(&dir);
    }
}
