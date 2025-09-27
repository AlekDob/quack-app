use std::{cmp::Ordering, fs, path::PathBuf};

use anyhow::{anyhow, Context, Result};
use serde::Serialize;

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
    let entry_name = entry
      .file_name()
      .to_string_lossy()
      .to_string();

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
    _ => a
      .name
      .to_lowercase()
      .cmp(&b.name.to_lowercase()),
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
  let metadata = fs::metadata(&resolved)
    .with_context(|| format!("Impossibile ottenere le informazioni del file {:?}", resolved))?;

  if metadata.len() > max_size {
    return Err(anyhow!("Il file è troppo grande per l’anteprima (limite 5MB)"));
  }

  let content = fs::read_to_string(&resolved)
    .with_context(|| format!("Impossibile leggere il file {:?}", resolved))?;

  Ok(content)
}

fn get_home() -> Result<String> {
  dirs::home_dir()
    .map(|path| path.to_string_lossy().to_string())
    .ok_or_else(|| anyhow!("Impossibile determinare la home directory"))
}
