use std::{cmp::Ordering, fs, path::PathBuf};

use anyhow::{anyhow, Context, Result};
use base64::engine::general_purpose::STANDARD as BASE64_ENGINE;
use base64::Engine;
use serde::Serialize;
use uuid::Uuid;

#[derive(Serialize)]
pub struct DirectoryEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_symlink: bool,
}

#[derive(Serialize)]
pub struct DirectoryListing {
    pub path: String,
    pub entries: Vec<DirectoryEntry>,
}

#[derive(Serialize)]
pub struct FileMetadata {
    pub size: u64,
    pub is_dir: bool,
    pub is_symlink: bool,
}

const MAX_PREVIEW_SIZE: u64 = 3 * 1024 * 1024;
const MAX_CLIPBOARD_FILE_SIZE: u64 = 15 * 1024 * 1024;

#[tauri::command]
pub fn list_directory(path: Option<String>) -> Result<DirectoryListing, String> {
    list_directory_impl(path).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn get_home_directory() -> Result<String, String> {
    get_home().map_err(|err| err.to_string())
}

#[tauri::command]
pub fn read_file_content(path: String) -> Result<String, String> {
    read_file_impl(path).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn write_file_content(path: String, content: String) -> Result<(), String> {
    write_file_impl(path, content).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn stat_file(path: String) -> Result<FileMetadata, String> {
    stat_file_impl(path).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn read_file_preview(path: String) -> Result<String, String> {
    read_file_preview_impl(path).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn save_clipboard_file(
    data_base64: String,
    extension: Option<String>,
    suggested_name: Option<String>,
) -> Result<String, String> {
    save_clipboard_file_impl(data_base64, extension, suggested_name).map_err(|err| err.to_string())
}

fn list_directory_impl(path: Option<String>) -> Result<DirectoryListing> {
    let target_path = match path {
        Some(value) if !value.trim().is_empty() => PathBuf::from(value),
        _ => PathBuf::from(get_home()?),
    };

    let canonical = fs::canonicalize(&target_path).unwrap_or(target_path.clone());

    let mut entries = Vec::new();
    let iterator = fs::read_dir(&canonical)
        .with_context(|| format!("Impossibile leggere la cartella {:?}", canonical))?;

    for entry in iterator {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let entry_path = entry.path();
        let entry_name = entry.file_name().to_string_lossy().to_string();

        entries.push(DirectoryEntry {
            name: entry_name,
            path: entry_path.to_string_lossy().to_string(),
            is_dir: file_type.is_dir(),
            is_symlink: file_type.is_symlink(),
        });
    }

    entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => Ordering::Less,
        (false, true) => Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    Ok(DirectoryListing {
        path: canonical.to_string_lossy().to_string(),
        entries,
    })
}

fn read_file_impl(path: String) -> Result<String> {
    let resolved = PathBuf::from(path);
    if resolved.is_dir() {
        return Err(anyhow!("Il percorso selezionato è una cartella"));
    }

    let max_size: u64 = 5 * 1024 * 1024;
    let metadata = fs::metadata(&resolved).with_context(|| {
        format!(
            "Impossibile ottenere le informazioni del file {:?}",
            resolved
        )
    })?;

    if metadata.len() > max_size {
        return Err(anyhow!(
            "Il file è troppo grande per l’anteprima (limite 5MB)"
        ));
    }

    let content = fs::read_to_string(&resolved)
        .with_context(|| format!("Impossibile leggere il file {:?}", resolved))?;

    Ok(content)
}

fn write_file_impl(path: String, content: String) -> Result<()> {
    let resolved = PathBuf::from(path);
    if resolved.is_dir() {
        return Err(anyhow!("Il percorso selezionato è una cartella"));
    }

    fs::write(&resolved, content)
        .with_context(|| format!("Impossibile scrivere il file {:?}", resolved))?;

    Ok(())
}

fn stat_file_impl(path: String) -> Result<FileMetadata> {
    let resolved = PathBuf::from(path);
    let metadata = fs::symlink_metadata(&resolved).with_context(|| {
        format!("Impossibile ottenere le informazioni del file {:?}", resolved)
    })?;

    Ok(FileMetadata {
        size: metadata.len(),
        is_dir: metadata.is_dir(),
        is_symlink: metadata.is_symlink(),
    })
}

fn read_file_preview_impl(path: String) -> Result<String> {
    let resolved = PathBuf::from(&path);
    if resolved.is_dir() {
        return Err(anyhow!("Impossibile generare l'anteprima di una cartella"));
    }

    let metadata = fs::metadata(&resolved).with_context(|| {
        format!("Impossibile ottenere le informazioni del file {:?}", resolved)
    })?;

    if metadata.len() > MAX_PREVIEW_SIZE {
        return Err(anyhow!("Il file è troppo grande per l'anteprima (limite 3MB)"));
    }

    let bytes = fs::read(&resolved)
        .with_context(|| format!("Impossibile leggere il file {:?}", resolved))?;

    Ok(BASE64_ENGINE.encode(bytes))
}

fn get_home() -> Result<String> {
    dirs::home_dir()
        .map(|path| path.to_string_lossy().to_string())
        .ok_or_else(|| anyhow!("Impossibile determinare la home directory"))
}

fn save_clipboard_file_impl(
    data_base64: String,
    extension: Option<String>,
    suggested_name: Option<String>,
) -> Result<String> {
    let bytes = BASE64_ENGINE
        .decode(data_base64)
        .map_err(|err| anyhow!("Impossibile decodificare l'immagine incollata: {err}"))?;

    if bytes.len() as u64 > MAX_CLIPBOARD_FILE_SIZE {
        return Err(anyhow!(
            "L'immagine incollata supera il limite di 15MB consentito"
        ));
    }

    let extension = extension
        .map(|value| sanitize_extension(&value))
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "png".to_string());

    let mut temp_dir = std::env::temp_dir();
    temp_dir.push("quack-app");
    fs::create_dir_all(&temp_dir)
        .with_context(|| format!("Impossibile creare la cartella temporanea {:?}", temp_dir.clone()))?;

    let file_name = suggested_name
        .and_then(|name| sanitize_filename(&name))
        .unwrap_or_else(|| format!("clipboard-{}", Uuid::new_v4()));

    let mut final_name = file_name;
    if !final_name.to_lowercase().ends_with(&format!(".{}", extension)) {
        final_name = format!("{}.{}", final_name.trim_end_matches('.'), extension);
    }

    let mut file_path = temp_dir;
    file_path.push(&final_name);

    if file_path.exists() {
        let mut counter = 1;
        let stem = file_path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("clipboard")
            .to_string();
        let ext_clone = extension.clone();
        loop {
            let candidate = format!("{}-{}.{}", stem, counter, ext_clone);
            file_path.set_file_name(&candidate);
            if !file_path.exists() {
                break;
            }
            counter += 1;
        }
    }

    fs::write(&file_path, &bytes)
        .with_context(|| format!("Impossibile salvare il file incollato in {:?}", file_path))?;

    Ok(file_path.to_string_lossy().to_string())
}

fn sanitize_extension(extension: &str) -> String {
    extension
        .trim()
        .trim_start_matches('.')
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .collect::<String>()
        .to_lowercase()
}

fn sanitize_filename(name: &str) -> Option<String> {
    let sanitized: String = name
        .trim()
        .chars()
        .map(|ch| match ch {
            'a'..='z' | 'A'..='Z' | '0'..='9' | '-' | '_' | ' ' | '.' => ch,
            _ => '_',
        })
        .collect();

    if sanitized.is_empty() {
        None
    } else {
        Some(sanitized.replace(' ', "_"))
    }
}
