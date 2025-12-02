use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;
use uuid::Uuid;

/// A prompt snippet that can be triggered by a tag
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Snippet {
    pub id: String,
    pub name: String,
    pub content: String,
    pub tag: String,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
}

/// Response for listing snippets
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnippetsFile {
    pub snippets: Vec<Snippet>,
}

impl Default for SnippetsFile {
    fn default() -> Self {
        Self {
            snippets: Vec::new(),
        }
    }
}

/// Get the path to the snippets JSON file
fn get_snippets_path(app: &AppHandle) -> Result<PathBuf, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    // Ensure the directory exists
    std::fs::create_dir_all(&data_dir)
        .map_err(|e| format!("Failed to create app data dir: {}", e))?;

    Ok(data_dir.join("snippets.json"))
}

/// Read snippets from the JSON file
fn read_snippets_file(app: &AppHandle) -> Result<SnippetsFile, String> {
    let path = get_snippets_path(app)?;

    if !path.exists() {
        return Ok(SnippetsFile::default());
    }

    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read snippets file: {}", e))?;

    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse snippets file: {}", e))
}

/// Write snippets to the JSON file
fn write_snippets_file(app: &AppHandle, file: &SnippetsFile) -> Result<(), String> {
    let path = get_snippets_path(app)?;

    let content = serde_json::to_string_pretty(file)
        .map_err(|e| format!("Failed to serialize snippets: {}", e))?;

    std::fs::write(&path, content)
        .map_err(|e| format!("Failed to write snippets file: {}", e))
}

/// Get current timestamp in ISO format
fn get_timestamp() -> String {
    chrono::Utc::now().to_rfc3339()
}

/// List all snippets
#[tauri::command]
pub async fn list_snippets(app: AppHandle) -> Result<Vec<Snippet>, String> {
    let file = read_snippets_file(&app)?;
    Ok(file.snippets)
}

/// Get a snippet by ID
#[tauri::command]
pub async fn get_snippet(app: AppHandle, id: String) -> Result<Option<Snippet>, String> {
    let file = read_snippets_file(&app)?;
    Ok(file.snippets.into_iter().find(|s| s.id == id))
}

/// Get a snippet by tag (case-insensitive)
#[tauri::command]
pub async fn get_snippet_by_tag(app: AppHandle, tag: String) -> Result<Option<Snippet>, String> {
    let file = read_snippets_file(&app)?;
    let tag_lower = tag.to_lowercase();
    Ok(file.snippets.into_iter().find(|s| s.tag.to_lowercase() == tag_lower))
}

/// Create a new snippet
#[tauri::command]
pub async fn create_snippet(
    app: AppHandle,
    name: String,
    content: String,
    tag: String,
) -> Result<Snippet, String> {
    let mut file = read_snippets_file(&app)?;

    // Check for duplicate tag (case-insensitive)
    let tag_lower = tag.to_lowercase();
    if file.snippets.iter().any(|s| s.tag.to_lowercase() == tag_lower) {
        return Err(format!("A snippet with tag '{}' already exists", tag));
    }

    let now = get_timestamp();
    let snippet = Snippet {
        id: Uuid::new_v4().to_string(),
        name,
        content,
        tag,
        created_at: now.clone(),
        updated_at: now,
    };

    file.snippets.push(snippet.clone());
    write_snippets_file(&app, &file)?;

    Ok(snippet)
}

/// Update an existing snippet
#[tauri::command]
pub async fn update_snippet(
    app: AppHandle,
    id: String,
    name: Option<String>,
    content: Option<String>,
    tag: Option<String>,
) -> Result<Snippet, String> {
    let mut file = read_snippets_file(&app)?;

    let index = file
        .snippets
        .iter()
        .position(|s| s.id == id)
        .ok_or_else(|| format!("Snippet with id '{}' not found", id))?;

    // Check for duplicate tag if tag is being changed
    if let Some(ref new_tag) = tag {
        let tag_lower = new_tag.to_lowercase();
        let existing = file.snippets.iter().enumerate().find(|(i, s)| {
            *i != index && s.tag.to_lowercase() == tag_lower
        });
        if existing.is_some() {
            return Err(format!("A snippet with tag '{}' already exists", new_tag));
        }
    }

    let snippet = &mut file.snippets[index];

    if let Some(name) = name {
        snippet.name = name;
    }
    if let Some(content) = content {
        snippet.content = content;
    }
    if let Some(tag) = tag {
        snippet.tag = tag;
    }
    snippet.updated_at = get_timestamp();

    let updated = snippet.clone();
    write_snippets_file(&app, &file)?;

    Ok(updated)
}

/// Delete a snippet by ID
#[tauri::command]
pub async fn delete_snippet(app: AppHandle, id: String) -> Result<(), String> {
    let mut file = read_snippets_file(&app)?;

    let initial_len = file.snippets.len();
    file.snippets.retain(|s| s.id != id);

    if file.snippets.len() == initial_len {
        return Err(format!("Snippet with id '{}' not found", id));
    }

    write_snippets_file(&app, &file)?;
    Ok(())
}

/// Search snippets by name or tag (case-insensitive)
#[tauri::command]
pub async fn search_snippets(app: AppHandle, query: String) -> Result<Vec<Snippet>, String> {
    let file = read_snippets_file(&app)?;
    let query_lower = query.to_lowercase();

    let results: Vec<Snippet> = file
        .snippets
        .into_iter()
        .filter(|s| {
            s.name.to_lowercase().contains(&query_lower)
                || s.tag.to_lowercase().contains(&query_lower)
                || s.content.to_lowercase().contains(&query_lower)
        })
        .collect();

    Ok(results)
}

/// Import snippets from JSON (merges with existing)
#[tauri::command]
pub async fn import_snippets(app: AppHandle, json: String) -> Result<usize, String> {
    let imported: SnippetsFile = serde_json::from_str(&json)
        .map_err(|e| format!("Invalid JSON format: {}", e))?;

    let mut file = read_snippets_file(&app)?;

    let mut count = 0;
    for mut snippet in imported.snippets {
        // Check for duplicate tag
        let tag_lower = snippet.tag.to_lowercase();
        if file.snippets.iter().any(|s| s.tag.to_lowercase() == tag_lower) {
            // Skip duplicates
            continue;
        }

        // Generate new ID and timestamps
        snippet.id = Uuid::new_v4().to_string();
        let now = get_timestamp();
        snippet.created_at = now.clone();
        snippet.updated_at = now;

        file.snippets.push(snippet);
        count += 1;
    }

    write_snippets_file(&app, &file)?;
    Ok(count)
}

/// Export all snippets as JSON
#[tauri::command]
pub async fn export_snippets(app: AppHandle) -> Result<String, String> {
    let file = read_snippets_file(&app)?;
    serde_json::to_string_pretty(&file)
        .map_err(|e| format!("Failed to export snippets: {}", e))
}
