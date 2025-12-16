use std::{cmp::Ordering, fs, path::PathBuf};

use anyhow::{anyhow, Context, Result};
use base64::engine::general_purpose::STANDARD as BASE64_ENGINE;
use base64::Engine;
use serde::{Deserialize, Serialize};
use tauri::Manager;
use uuid::Uuid;
use walkdir::WalkDir;
use fuzzy_matcher::FuzzyMatcher;
use fuzzy_matcher::skim::SkimMatcherV2;

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

#[derive(Serialize, Clone)]
pub struct SearchResult {
    pub name: String,
    pub path: String,
    pub relative_path: String,
    pub is_dir: bool,
    pub is_symlink: bool,
    pub score: i64,
    pub depth: usize,
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

/// Get the current macOS username from home directory path
/// Returns username like "alekdob" from "/Users/alekdob"
#[tauri::command]
pub fn get_current_username() -> Result<String, String> {
    get_username_impl().map_err(|err| err.to_string())
}

fn get_username_impl() -> Result<String> {
    let home = get_home()?;
    let path = PathBuf::from(&home);

    // Extract username from path: /Users/<username> -> username
    path.file_name()
        .and_then(|name| name.to_str())
        .map(|s| s.to_string())
        .ok_or_else(|| anyhow!("Could not extract username from home path"))
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
pub fn create_directory(path: String) -> Result<(), String> {
    create_directory_impl(path).map_err(|err| err.to_string())
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

#[tauri::command]
pub fn search_files_recursive(
    path: String,
    query: String,
    max_results: Option<usize>,
    max_depth: Option<usize>,
) -> Result<Vec<SearchResult>, String> {
    search_files_recursive_impl(path, query, max_results, max_depth).map_err(|err| err.to_string())
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

fn create_directory_impl(path: String) -> Result<()> {
    let resolved = PathBuf::from(path);

    // Check if the path already exists
    if resolved.exists() {
        // If it exists and is a directory, return success (idempotent)
        if resolved.is_dir() {
            return Ok(());
        }
        // If it exists but is not a directory, return an error
        return Err(anyhow!("Il percorso {:?} esiste ma non è una cartella", resolved));
    }

    // Create the directory and all parent directories
    fs::create_dir_all(&resolved)
        .with_context(|| format!("Impossibile creare la cartella {:?}", resolved))?;

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

fn search_files_recursive_impl(
    path: String,
    query: String,
    max_results: Option<usize>,
    max_depth: Option<usize>,
) -> Result<Vec<SearchResult>> {
    let root_path = PathBuf::from(&path);
    if !root_path.exists() {
        return Err(anyhow!("Path does not exist: {:?}", root_path));
    }

    let canonical_root = fs::canonicalize(&root_path)
        .with_context(|| format!("Cannot canonicalize path {:?}", root_path))?;

    let matcher = SkimMatcherV2::default();
    let max_results = max_results.unwrap_or(100);
    let max_depth = max_depth.unwrap_or(10);

    let mut results: Vec<SearchResult> = Vec::new();

    // Skip common directories that should be ignored
    let ignore_dirs = [
        "node_modules",
        ".git",
        "target",
        "dist",
        "build",
        ".next",
        ".cache",
        "coverage",
        ".turbo",
        ".vscode",
        ".idea",
    ];

    let walker = WalkDir::new(&canonical_root)
        .max_depth(max_depth)
        .follow_links(false)
        .into_iter()
        .filter_entry(|entry| {
            // Skip ignored directories
            if entry.file_type().is_dir() {
                if let Some(name) = entry.file_name().to_str() {
                    return !ignore_dirs.contains(&name);
                }
            }
            true
        });

    for entry in walker {
        // Early exit if we have enough results
        if results.len() >= max_results {
            break;
        }

        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue, // Skip entries we can't read
        };

        let file_path = entry.path();

        // Skip the root directory itself
        if file_path == canonical_root {
            continue;
        }

        let file_name = match entry.file_name().to_str() {
            Some(name) => name,
            None => continue, // Skip non-UTF8 filenames
        };

        // Calculate relative path from root
        let relative_path = match file_path.strip_prefix(&canonical_root) {
            Ok(rel) => rel.to_string_lossy().to_string(),
            Err(_) => continue,
        };

        // Fuzzy match against query
        if let Some(score) = matcher.fuzzy_match(file_name, &query) {
            let metadata = match fs::symlink_metadata(file_path) {
                Ok(m) => m,
                Err(_) => continue,
            };

            let depth = file_path.components().count() - canonical_root.components().count();

            results.push(SearchResult {
                name: file_name.to_string(),
                path: file_path.to_string_lossy().to_string(),
                relative_path,
                is_dir: metadata.is_dir(),
                is_symlink: metadata.is_symlink(),
                score,
                depth,
            });
        }
    }

    // Sort by score (highest first), then by depth (shallowest first)
    results.sort_by(|a, b| {
        b.score.cmp(&a.score).then_with(|| a.depth.cmp(&b.depth))
    });

    // Truncate to max_results
    results.truncate(max_results);

    Ok(results)
}

#[tauri::command]
pub fn open_file_in_editor(path: String) -> Result<(), String> {
    open_file_in_editor_impl(path).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn open_file_externally(path: String) -> Result<(), String> {
    open_file_externally_impl(path).map_err(|err| err.to_string())
}

fn open_file_in_editor_impl(path: String) -> Result<()> {
    let file_path = PathBuf::from(&path);

    if !file_path.exists() {
        return Err(anyhow!("File does not exist: {:?}", file_path));
    }

    // Use platform-specific command to open file with code editor
    #[cfg(target_os = "macos")]
    {
        // Try common code editors in priority order
        let editors = [
            "com.todesktop.230313mzl4w4u92", // Cursor
            "com.microsoft.VSCode",           // VS Code
            "com.sublimetext.4",              // Sublime Text
            "com.apple.TextEdit",             // TextEdit (fallback)
        ];

        let mut opened = false;
        for bundle_id in &editors {
            let result = std::process::Command::new("open")
                .arg("-b")
                .arg(bundle_id)
                .arg(&file_path)
                .spawn();

            if result.is_ok() {
                opened = true;
                break;
            }
        }

        if !opened {
            // Final fallback: use default text editor
            std::process::Command::new("open")
                .arg("-t")
                .arg(&file_path)
                .spawn()
                .with_context(|| format!("Failed to open file {:?}", file_path))?;
        }
    }

    #[cfg(target_os = "linux")]
    {
        // Try common Linux code editors
        let editors = ["code", "subl", "gedit", "nano"];

        let mut opened = false;
        for editor in &editors {
            let result = std::process::Command::new(editor)
                .arg(&file_path)
                .spawn();

            if result.is_ok() {
                opened = true;
                break;
            }
        }

        if !opened {
            std::process::Command::new("xdg-open")
                .arg(&file_path)
                .spawn()
                .with_context(|| format!("Failed to open file {:?}", file_path))?;
        }
    }

    #[cfg(target_os = "windows")]
    {
        // Try common Windows code editors
        let editors = [
            "code.cmd",      // VS Code
            "cursor.cmd",    // Cursor
            "subl.exe",      // Sublime Text
            "notepad++.exe", // Notepad++
        ];

        let mut opened = false;
        for editor in &editors {
            let result = std::process::Command::new(editor)
                .arg(&file_path)
                .spawn();

            if result.is_ok() {
                opened = true;
                break;
            }
        }

        if !opened {
            std::process::Command::new("cmd")
                .args(&["/C", "start", "", path.as_str()])
                .spawn()
                .with_context(|| format!("Failed to open file {:?}", file_path))?;
        }
    }

    Ok(())
}

fn open_file_externally_impl(path: String) -> Result<()> {
    let file_path = PathBuf::from(&path);

    if !file_path.exists() {
        return Err(anyhow!("File does not exist: {:?}", file_path));
    }

    // Use platform-specific command to open file with default application
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&file_path)
            .spawn()
            .with_context(|| format!("Failed to open file {:?}", file_path))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&file_path)
            .spawn()
            .with_context(|| format!("Failed to open file {:?}", file_path))?;
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(&["/C", "start", "", path.as_str()])
            .spawn()
            .with_context(|| format!("Failed to open file {:?}", file_path))?;
    }

    Ok(())
}


#[tauri::command]
pub fn list_avatar_images(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    list_avatar_images_impl(app).map_err(|err| err.to_string())
}

fn list_avatar_images_impl(app: tauri::AppHandle) -> Result<Vec<String>> {
    // Get resource directory path
    let resource_dir = app.path().resource_dir()
        .map_err(|e| anyhow!("Cannot get resource directory: {}", e))?;

    let avatars_path = resource_dir.join("images").join("ducks").join("avatars");

    if !avatars_path.exists() {
        return Err(anyhow!("Avatars directory does not exist: {:?}", avatars_path));
    }

    let mut avatar_files = Vec::new();

    for entry in fs::read_dir(&avatars_path)
        .with_context(|| format!("Cannot read avatars directory: {:?}", avatars_path))?
    {
        let entry = entry?;
        let path = entry.path();

        // Only include image files (jpeg, jpg, png)
        if path.is_file() {
            if let Some(extension) = path.extension() {
                let ext = extension.to_string_lossy().to_lowercase();
                if ext == "jpeg" || ext == "jpg" || ext == "png" {
                    if let Some(filename) = path.file_name() {
                        avatar_files.push(filename.to_string_lossy().to_string());
                    }
                }
            }
        }
    }

    // Sort alphabetically
    avatar_files.sort();

    Ok(avatar_files)
}

// Custom avatar management
#[derive(Serialize)]
pub struct CustomAvatarInfo {
    pub id: String,
    pub filename: String,
    pub original_name: String,
    pub created_at: u64,
    pub size: u64,
}

#[tauri::command]
pub fn save_custom_avatar(
    app: tauri::AppHandle,
    data_base64: String,
    original_name: String,
) -> Result<CustomAvatarInfo, String> {
    save_custom_avatar_impl(app, data_base64, original_name).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn list_custom_avatars(app: tauri::AppHandle) -> Result<Vec<CustomAvatarInfo>, String> {
    list_custom_avatars_impl(app).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn delete_custom_avatar(app: tauri::AppHandle, avatar_id: String) -> Result<(), String> {
    delete_custom_avatar_impl(app, avatar_id).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn get_custom_avatar_path(app: tauri::AppHandle, avatar_id: String) -> Result<String, String> {
    get_custom_avatar_path_impl(app, avatar_id).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn read_custom_avatar_bytes(app: tauri::AppHandle, avatar_id: String) -> Result<Vec<u8>, String> {
    read_custom_avatar_bytes_impl(app, avatar_id).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn list_directory_files(path: String, extension: String) -> Result<Vec<String>, String> {
    list_directory_files_impl(path, extension).map_err(|err| err.to_string())
}

fn save_custom_avatar_impl(
    app: tauri::AppHandle,
    data_base64: String,
    original_name: String,
) -> Result<CustomAvatarInfo> {
    // Decode base64 image data
    let bytes = BASE64_ENGINE
        .decode(data_base64)
        .map_err(|err| anyhow!("Failed to decode avatar image: {err}"))?;

    // Validate image size (max 5MB)
    const MAX_AVATAR_SIZE: usize = 5 * 1024 * 1024;
    if bytes.len() > MAX_AVATAR_SIZE {
        return Err(anyhow!("Avatar image is too large (max 5MB)"));
    }

    // Get app data directory
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| anyhow!("Cannot get app data directory: {}", e))?;

    // Create custom avatars directory
    let custom_avatars_dir = app_data_dir.join("avatars").join("custom");
    fs::create_dir_all(&custom_avatars_dir)
        .with_context(|| format!("Cannot create custom avatars directory: {:?}", custom_avatars_dir))?;

    // Generate unique ID for avatar
    let avatar_id = Uuid::new_v4().to_string();

    // Extract extension from original filename
    let extension = PathBuf::from(&original_name)
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_lowercase())
        .unwrap_or_else(|| "png".to_string());

    // Validate extension
    let valid_extensions = ["png", "jpg", "jpeg", "gif", "webp"];
    if !valid_extensions.contains(&extension.as_str()) {
        return Err(anyhow!("Invalid image format. Supported: PNG, JPG, JPEG, GIF, WEBP"));
    }

    // Create filename: {uuid}.{extension}
    let filename = format!("{}.{}", avatar_id, extension);
    let avatar_path = custom_avatars_dir.join(&filename);

    // Save image file
    fs::write(&avatar_path, &bytes)
        .with_context(|| format!("Cannot save custom avatar: {:?}", avatar_path))?;

    // Get current timestamp
    let created_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| anyhow!("Failed to get timestamp: {}", e))?
        .as_secs();

    Ok(CustomAvatarInfo {
        id: avatar_id,
        filename,
        original_name,
        created_at,
        size: bytes.len() as u64,
    })
}

fn list_custom_avatars_impl(app: tauri::AppHandle) -> Result<Vec<CustomAvatarInfo>> {
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| anyhow!("Cannot get app data directory: {}", e))?;

    let custom_avatars_dir = app_data_dir.join("avatars").join("custom");

    // If directory doesn't exist, return empty list
    if !custom_avatars_dir.exists() {
        return Ok(Vec::new());
    }

    let mut avatars = Vec::new();

    for entry in fs::read_dir(&custom_avatars_dir)
        .with_context(|| format!("Cannot read custom avatars directory: {:?}", custom_avatars_dir))?
    {
        let entry = entry?;
        let path = entry.path();

        if path.is_file() {
            if let Some(filename) = path.file_name() {
                let filename_str = filename.to_string_lossy().to_string();

                // Extract ID from filename (before extension)
                if let Some(stem) = path.file_stem() {
                    let avatar_id = stem.to_string_lossy().to_string();

                    // Get file metadata
                    let metadata = fs::metadata(&path)?;
                    let created_at = metadata
                        .created()
                        .or_else(|_| metadata.modified())
                        .map(|time| {
                            time.duration_since(std::time::UNIX_EPOCH)
                                .unwrap_or_default()
                                .as_secs()
                        })
                        .unwrap_or(0);

                    avatars.push(CustomAvatarInfo {
                        id: avatar_id.clone(),
                        filename: filename_str.clone(),
                        original_name: filename_str,
                        created_at,
                        size: metadata.len(),
                    });
                }
            }
        }
    }

    // Sort by creation date (newest first)
    avatars.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    Ok(avatars)
}

fn delete_custom_avatar_impl(app: tauri::AppHandle, avatar_id: String) -> Result<()> {
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| anyhow!("Cannot get app data directory: {}", e))?;

    let custom_avatars_dir = app_data_dir.join("avatars").join("custom");

    if !custom_avatars_dir.exists() {
        return Err(anyhow!("Custom avatars directory does not exist"));
    }

    // Find file with matching ID (any extension)
    let mut deleted = false;
    for entry in fs::read_dir(&custom_avatars_dir)? {
        let entry = entry?;
        let path = entry.path();

        if let Some(stem) = path.file_stem() {
            if stem.to_string_lossy() == avatar_id {
                fs::remove_file(&path)
                    .with_context(|| format!("Cannot delete custom avatar: {:?}", path))?;
                deleted = true;
                break;
            }
        }
    }

    if !deleted {
        return Err(anyhow!("Custom avatar not found: {}", avatar_id));
    }

    Ok(())
}

fn get_custom_avatar_path_impl(app: tauri::AppHandle, avatar_id: String) -> Result<String> {
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| anyhow!("Cannot get app data directory: {}", e))?;

    let custom_avatars_dir = app_data_dir.join("avatars").join("custom");

    if !custom_avatars_dir.exists() {
        return Err(anyhow!("Custom avatars directory does not exist"));
    }

    // Find file with matching ID
    for entry in fs::read_dir(&custom_avatars_dir)? {
        let entry = entry?;
        let path = entry.path();

        if let Some(stem) = path.file_stem() {
            if stem.to_string_lossy() == avatar_id {
                return Ok(path.to_string_lossy().to_string());
            }
        }
    }

    Err(anyhow!("Custom avatar not found: {}", avatar_id))
}

fn read_custom_avatar_bytes_impl(app: tauri::AppHandle, avatar_id: String) -> Result<Vec<u8>> {
    // Get the path to the custom avatar file
    let path = get_custom_avatar_path_impl(app, avatar_id)?;
    let file_path = PathBuf::from(&path);

    // Read the file as bytes
    let bytes = fs::read(&file_path)
        .with_context(|| format!("Cannot read custom avatar file: {:?}", file_path))?;

    Ok(bytes)
}

fn list_directory_files_impl(path: String, extension: String) -> Result<Vec<String>> {
    let dir_path = PathBuf::from(&path);

    if !dir_path.exists() {
        // Return empty list if directory doesn't exist (not an error)
        return Ok(Vec::new());
    }

    if !dir_path.is_dir() {
        return Err(anyhow!("Path is not a directory: {:?}", dir_path));
    }

    let mut files = Vec::new();
    let ext_lower = extension.to_lowercase();

    for entry in fs::read_dir(&dir_path)
        .with_context(|| format!("Cannot read directory: {:?}", dir_path))?
    {
        let entry = entry?;
        let entry_path = entry.path();

        // Only include files (not directories)
        if entry_path.is_file() {
            // Check if file has the specified extension
            if let Some(file_ext) = entry_path.extension() {
                if file_ext.to_string_lossy().to_lowercase() == ext_lower {
                    if let Some(filename) = entry_path.file_name() {
                        files.push(filename.to_string_lossy().to_string());
                    }
                }
            }
        }
    }

    // Sort alphabetically
    files.sort();

    Ok(files)
}

// ============================================
// MCP Memory File Operations
// ============================================

/// MCP Memory entity as stored in memory.jsonl
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MCPMemoryEntity {
    #[serde(rename = "type")]
    pub entity_type_marker: String,
    pub name: String,
    #[serde(rename = "entityType")]
    pub entity_type: String,
    pub observations: Vec<String>,
}

/// MCP Memory relation as stored in memory.jsonl
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MCPMemoryRelation {
    #[serde(rename = "type")]
    pub relation_type_marker: String,
    pub from: String,
    pub to: String,
    #[serde(rename = "relationType")]
    pub relation_type: String,
}

/// Knowledge graph containing entities and relations
#[derive(Serialize, Clone, Debug)]
pub struct MCPKnowledgeGraph {
    pub entities: Vec<MCPMemoryEntity>,
    pub relations: Vec<MCPMemoryRelation>,
}

/// Find MCP memory.jsonl file location
/// Searches in NPX cache directory for the server-memory package
#[tauri::command]
pub fn find_mcp_memory_path() -> Result<Option<String>, String> {
    find_mcp_memory_path_impl().map_err(|err| err.to_string())
}

/// Read MCP memory knowledge graph from file
#[tauri::command]
pub fn read_mcp_memory_file() -> Result<MCPKnowledgeGraph, String> {
    read_mcp_memory_file_impl().map_err(|err| err.to_string())
}

fn find_mcp_memory_path_impl() -> Result<Option<String>> {
    let home = get_home()?;
    let npx_cache_dir = PathBuf::from(&home).join(".npm").join("_npx");

    if !npx_cache_dir.exists() {
        return Ok(None);
    }

    // Search through all subdirectories in NPX cache
    for entry in fs::read_dir(&npx_cache_dir)
        .with_context(|| format!("Cannot read NPX cache directory: {:?}", npx_cache_dir))?
    {
        let entry = entry?;
        let entry_path = entry.path();

        if entry_path.is_dir() {
            // Look for the memory.jsonl file path
            let memory_file = entry_path
                .join("node_modules")
                .join("@modelcontextprotocol")
                .join("server-memory")
                .join("dist")
                .join("memory.jsonl");

            if memory_file.exists() {
                return Ok(Some(memory_file.to_string_lossy().to_string()));
            }
        }
    }

    Ok(None)
}

fn read_mcp_memory_file_impl() -> Result<MCPKnowledgeGraph> {
    let memory_path = find_mcp_memory_path_impl()?
        .ok_or_else(|| anyhow!("MCP memory file not found in NPX cache"))?;

    let file_path = PathBuf::from(&memory_path);
    let content = fs::read_to_string(&file_path)
        .with_context(|| format!("Cannot read MCP memory file: {:?}", file_path))?;

    let mut entities: Vec<MCPMemoryEntity> = Vec::new();
    let mut relations: Vec<MCPMemoryRelation> = Vec::new();

    // Parse JSONL format (one JSON object per line)
    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        // Try to parse as entity first
        if let Ok(entity) = serde_json::from_str::<MCPMemoryEntity>(line) {
            if entity.entity_type_marker == "entity" {
                entities.push(entity);
                continue;
            }
        }

        // Try to parse as relation
        if let Ok(relation) = serde_json::from_str::<MCPMemoryRelation>(line) {
            if relation.relation_type_marker == "relation" {
                relations.push(relation);
            }
        }
    }

    Ok(MCPKnowledgeGraph { entities, relations })
}

/// Input for creating a new MCP memory entity
#[derive(Deserialize, Debug)]
pub struct CreateMCPEntityInput {
    pub name: String,
    #[serde(rename = "entityType")]
    pub entity_type: String,
    pub observations: Vec<String>,
}

/// Write a new entity to MCP memory.jsonl file
#[tauri::command]
pub fn write_mcp_memory_entity(entity: CreateMCPEntityInput) -> Result<MCPMemoryEntity, String> {
    write_mcp_memory_entity_impl(entity).map_err(|err| err.to_string())
}

fn write_mcp_memory_entity_impl(input: CreateMCPEntityInput) -> Result<MCPMemoryEntity> {
    let memory_path = find_mcp_memory_path_impl()?
        .ok_or_else(|| anyhow!("MCP memory file not found in NPX cache. Make sure the MCP memory server has been used at least once."))?;

    let file_path = PathBuf::from(&memory_path);

    // Create the entity struct
    let entity = MCPMemoryEntity {
        entity_type_marker: "entity".to_string(),
        name: input.name,
        entity_type: input.entity_type,
        observations: input.observations,
    };

    // Serialize to JSON
    let json_line = serde_json::to_string(&entity)
        .with_context(|| "Failed to serialize entity to JSON")?;

    // Check if file exists and doesn't end with newline
    use std::io::{Read, Seek, SeekFrom, Write};

    // First, ensure file ends with newline if it exists and has content
    if file_path.exists() {
        let mut check_file = fs::File::open(&file_path)
            .with_context(|| format!("Cannot open MCP memory file: {:?}", file_path))?;

        let file_len = check_file.metadata()?.len();
        if file_len > 0 {
            check_file.seek(SeekFrom::End(-1))?;
            let mut last_byte = [0u8; 1];
            check_file.read_exact(&mut last_byte)?;

            // If file doesn't end with newline, add one before our content
            if last_byte[0] != b'\n' {
                let mut append_file = fs::OpenOptions::new()
                    .append(true)
                    .open(&file_path)?;
                writeln!(append_file)?; // Add missing newline
            }
        }
    }

    // Append entity to file with newline
    let mut file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&file_path)
        .with_context(|| format!("Cannot open MCP memory file for writing: {:?}", file_path))?;

    writeln!(file, "{}", json_line)
        .with_context(|| format!("Cannot write to MCP memory file: {:?}", file_path))?;

    Ok(entity)
}

/// Delete an entity from MCP memory.jsonl file by name
#[tauri::command]
pub fn delete_mcp_memory_entity(name: String) -> Result<bool, String> {
    delete_mcp_memory_entity_impl(name).map_err(|err| err.to_string())
}

fn delete_mcp_memory_entity_impl(name: String) -> Result<bool> {
    let memory_path = find_mcp_memory_path_impl()?
        .ok_or_else(|| anyhow!("MCP memory file not found in NPX cache"))?;

    let file_path = PathBuf::from(&memory_path);
    let content = fs::read_to_string(&file_path)
        .with_context(|| format!("Cannot read MCP memory file: {:?}", file_path))?;

    let mut new_lines: Vec<String> = Vec::new();
    let mut deleted = false;

    // Filter out the entity and its relations
    for line in content.lines() {
        let line_trimmed = line.trim();
        if line_trimmed.is_empty() {
            continue;
        }

        // Check if this is the entity to delete
        if let Ok(entity) = serde_json::from_str::<MCPMemoryEntity>(line_trimmed) {
            if entity.entity_type_marker == "entity" && entity.name == name {
                deleted = true;
                continue; // Skip this entity
            }
        }

        // Check if this is a relation involving the entity
        if let Ok(relation) = serde_json::from_str::<MCPMemoryRelation>(line_trimmed) {
            if relation.relation_type_marker == "relation" {
                if relation.from == name || relation.to == name {
                    continue; // Skip relations involving deleted entity
                }
            }
        }

        new_lines.push(line_trimmed.to_string());
    }

    // Write back the filtered content
    let new_content = new_lines.join("\n");
    fs::write(&file_path, if new_content.is_empty() { "".to_string() } else { new_content + "\n" })
        .with_context(|| format!("Cannot write MCP memory file: {:?}", file_path))?;

    Ok(deleted)
}

/// Add observations to an existing MCP entity
#[tauri::command]
pub fn add_mcp_memory_observations(name: String, observations: Vec<String>) -> Result<bool, String> {
    add_mcp_memory_observations_impl(name, observations).map_err(|err| err.to_string())
}

fn add_mcp_memory_observations_impl(name: String, new_observations: Vec<String>) -> Result<bool> {
    let memory_path = find_mcp_memory_path_impl()?
        .ok_or_else(|| anyhow!("MCP memory file not found in NPX cache"))?;

    let file_path = PathBuf::from(&memory_path);
    let content = fs::read_to_string(&file_path)
        .with_context(|| format!("Cannot read MCP memory file: {:?}", file_path))?;

    let mut new_lines: Vec<String> = Vec::new();
    let mut found = false;

    // Update the entity's observations
    for line in content.lines() {
        let line_trimmed = line.trim();
        if line_trimmed.is_empty() {
            continue;
        }

        // Check if this is the entity to update
        if let Ok(mut entity) = serde_json::from_str::<MCPMemoryEntity>(line_trimmed) {
            if entity.entity_type_marker == "entity" && entity.name == name {
                // Add new observations (avoid duplicates)
                for obs in &new_observations {
                    if !entity.observations.contains(obs) {
                        entity.observations.push(obs.clone());
                    }
                }
                let updated_line = serde_json::to_string(&entity)?;
                new_lines.push(updated_line);
                found = true;
                continue;
            }
        }

        new_lines.push(line_trimmed.to_string());
    }

    if !found {
        return Ok(false);
    }

    // Write back the updated content
    let new_content = new_lines.join("\n") + "\n";
    fs::write(&file_path, new_content)
        .with_context(|| format!("Cannot write MCP memory file: {:?}", file_path))?;

    Ok(true)
}

/// Update observations of an existing MCP entity (replace all observations)
#[tauri::command]
pub fn update_mcp_memory_observations(name: String, observations: Vec<String>) -> Result<bool, String> {
    update_mcp_memory_observations_impl(name, observations).map_err(|err| err.to_string())
}

fn update_mcp_memory_observations_impl(name: String, new_observations: Vec<String>) -> Result<bool> {
    let memory_path = find_mcp_memory_path_impl()?
        .ok_or_else(|| anyhow!("MCP memory file not found in NPX cache"))?;

    let file_path = PathBuf::from(&memory_path);
    let content = fs::read_to_string(&file_path)
        .with_context(|| format!("Cannot read MCP memory file: {:?}", file_path))?;

    let mut new_lines: Vec<String> = Vec::new();
    let mut found = false;

    // Update the entity's observations (replace all)
    for line in content.lines() {
        let line_trimmed = line.trim();
        if line_trimmed.is_empty() {
            continue;
        }

        // Check if this is the entity to update
        if let Ok(mut entity) = serde_json::from_str::<MCPMemoryEntity>(line_trimmed) {
            if entity.entity_type_marker == "entity" && entity.name == name {
                // Replace all observations
                entity.observations = new_observations.clone();
                let updated_line = serde_json::to_string(&entity)?;
                new_lines.push(updated_line);
                found = true;
                continue;
            }
        }

        new_lines.push(line_trimmed.to_string());
    }

    if !found {
        return Ok(false);
    }

    // Write back the updated content
    let new_content = new_lines.join("\n") + "\n";
    fs::write(&file_path, new_content)
        .with_context(|| format!("Cannot write MCP memory file: {:?}", file_path))?;

    Ok(true)
}

/// Input for creating a new MCP memory relation
#[derive(Deserialize, Debug)]
pub struct CreateMCPRelationInput {
    pub from: String,
    pub to: String,
    #[serde(rename = "relationType")]
    pub relation_type: String,
}

/// Write a new relation to the MCP memory file
#[tauri::command]
pub fn write_mcp_memory_relation(relation: CreateMCPRelationInput) -> Result<MCPMemoryRelation, String> {
    write_mcp_memory_relation_impl(relation).map_err(|err| err.to_string())
}

fn write_mcp_memory_relation_impl(input: CreateMCPRelationInput) -> Result<MCPMemoryRelation> {
    let memory_path = find_mcp_memory_path_impl()?
        .ok_or_else(|| anyhow!("MCP memory file not found in NPX cache. Make sure the MCP memory server has been used at least once."))?;

    let file_path = PathBuf::from(&memory_path);

    // Create the relation struct
    let relation = MCPMemoryRelation {
        relation_type_marker: "relation".to_string(),
        from: input.from,
        to: input.to,
        relation_type: input.relation_type,
    };

    // Serialize to JSON
    let json_line = serde_json::to_string(&relation)
        .with_context(|| "Failed to serialize relation to JSON")?;

    // Check if file exists and doesn't end with newline
    use std::io::{Read, Seek, SeekFrom, Write};

    // First, ensure file ends with newline if it exists and has content
    if file_path.exists() {
        let mut check_file = fs::File::open(&file_path)
            .with_context(|| format!("Cannot open MCP memory file: {:?}", file_path))?;

        let file_len = check_file.metadata()?.len();
        if file_len > 0 {
            check_file.seek(SeekFrom::End(-1))?;
            let mut last_byte = [0u8; 1];
            check_file.read_exact(&mut last_byte)?;

            // If file doesn't end with newline, add one before our content
            if last_byte[0] != b'\n' {
                let mut append_file = fs::OpenOptions::new()
                    .append(true)
                    .open(&file_path)?;
                writeln!(append_file)?; // Add missing newline
            }
        }
    }

    // Append relation to file with newline
    let mut file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&file_path)
        .with_context(|| format!("Cannot open MCP memory file for writing: {:?}", file_path))?;

    writeln!(file, "{}", json_line)
        .with_context(|| format!("Cannot write to MCP memory file: {:?}", file_path))?;

    Ok(relation)
}

/// Delete a specific relation from the MCP memory file
#[tauri::command]
pub fn delete_mcp_memory_relation(from: String, to: String) -> Result<bool, String> {
    delete_mcp_memory_relation_impl(from, to).map_err(|err| err.to_string())
}

fn delete_mcp_memory_relation_impl(from: String, to: String) -> Result<bool> {
    let memory_path = find_mcp_memory_path_impl()?
        .ok_or_else(|| anyhow!("MCP memory file not found"))?;

    let file_path = PathBuf::from(&memory_path);
    let content = fs::read_to_string(&file_path)
        .with_context(|| format!("Cannot read MCP memory file: {:?}", file_path))?;

    let mut new_lines: Vec<String> = Vec::new();
    let mut found = false;

    for line in content.lines() {
        let line_trimmed = line.trim();
        if line_trimmed.is_empty() {
            continue;
        }

        // Check if this is the relation to delete
        if let Ok(relation) = serde_json::from_str::<MCPMemoryRelation>(line_trimmed) {
            if relation.relation_type_marker == "relation" {
                if relation.from == from && relation.to == to {
                    found = true;
                    continue; // Skip this relation
                }
            }
        }

        new_lines.push(line_trimmed.to_string());
    }

    if !found {
        return Ok(false);
    }

    // Write back the updated content
    let new_content = new_lines.join("\n") + "\n";
    fs::write(&file_path, new_content)
        .with_context(|| format!("Cannot write MCP memory file: {:?}", file_path))?;

    Ok(true)
}
