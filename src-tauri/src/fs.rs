use std::{cmp::Ordering, fs, path::PathBuf};

use anyhow::{anyhow, Context, Result};
use base64::engine::general_purpose::STANDARD as BASE64_ENGINE;
use base64::Engine;
use serde::Serialize;
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
