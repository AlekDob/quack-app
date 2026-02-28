use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;
use uuid::Uuid;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SavedCommand {
    pub id: String,
    pub name: String,
    pub command: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cwd: Option<String>,
    pub color: String,
    pub category: String, // "dev", "build", "test", "custom"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_path: Option<String>,
}

#[allow(dead_code)]
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ProcessInfo {
    pub terminal_id: String,
    pub terminal_label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub command: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pid: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub port: Option<u16>,
    pub uptime_seconds: u64,
    pub status: String, // "running" | "idle"
}

const STORE_FILENAME: &str = "commands.json";

/// Normalize empty-string optionals to None so filter logic works correctly.
fn sanitize_optional_string(value: &Option<String>) -> Option<String> {
    match value {
        Some(s) if s.trim().is_empty() => None,
        other => other.clone(),
    }
}
const COMMANDS_KEY: &str = "saved_commands";

#[tauri::command]
pub fn load_saved_commands(app: AppHandle) -> Result<Vec<SavedCommand>, String> {
    load_saved_commands_impl(&app).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn save_command(app: AppHandle, command: SavedCommand) -> Result<SavedCommand, String> {
    save_command_impl(&app, command).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn update_command(
    app: AppHandle,
    id: String,
    command: SavedCommand,
) -> Result<SavedCommand, String> {
    update_command_impl(&app, &id, command).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn delete_command(app: AppHandle, id: String) -> Result<(), String> {
    delete_command_impl(&app, &id).map_err(|err| err.to_string())
}

fn load_saved_commands_impl(app: &AppHandle) -> Result<Vec<SavedCommand>> {
    let store = app
        .store(STORE_FILENAME)
        .map_err(|e| anyhow!("Impossibile accedere allo store: {}", e))?;

    let commands = store
        .get(COMMANDS_KEY)
        .and_then(|value| serde_json::from_value::<Vec<SavedCommand>>(value.clone()).ok())
        .unwrap_or_default();

    Ok(commands)
}

fn save_command_impl(app: &AppHandle, mut command: SavedCommand) -> Result<SavedCommand> {
    // Generate new ID if not provided
    if command.id.is_empty() {
        command.id = Uuid::new_v4().to_string();
    }
    command.project_path = sanitize_optional_string(&command.project_path);

    let store = app
        .store(STORE_FILENAME)
        .map_err(|e| anyhow!("Impossibile accedere allo store: {}", e))?;

    let mut commands = load_saved_commands_impl(app)?;

    // Check if command with this ID already exists
    if commands.iter().any(|c| c.id == command.id) {
        return Err(anyhow!("Comando con questo ID esiste già"));
    }

    commands.push(command.clone());

    store.set(COMMANDS_KEY, serde_json::to_value(&commands)?);

    store
        .save()
        .map_err(|e| anyhow!("Impossibile persistere lo store: {}", e))?;

    Ok(command)
}

fn update_command_impl(
    app: &AppHandle,
    id: &str,
    updated_command: SavedCommand,
) -> Result<SavedCommand> {
    let store = app
        .store(STORE_FILENAME)
        .map_err(|e| anyhow!("Impossibile accedere allo store: {}", e))?;

    let mut commands = load_saved_commands_impl(app)?;

    let mut updated = None;

    for command in commands.iter_mut() {
        if command.id == id {
            command.name = updated_command.name.clone();
            command.command = updated_command.command.clone();
            command.cwd = updated_command.cwd.clone();
            command.color = updated_command.color.clone();
            command.category = updated_command.category.clone();
            command.project_path = sanitize_optional_string(&updated_command.project_path);
            updated = Some(command.clone());
            break;
        }
    }

    if updated.is_none() {
        return Err(anyhow!("Comando non trovato"));
    }

    store.set(COMMANDS_KEY, serde_json::to_value(&commands)?);

    store
        .save()
        .map_err(|e| anyhow!("Impossibile persistere lo store: {}", e))?;

    Ok(updated.expect("comando aggiornato"))
}

fn delete_command_impl(app: &AppHandle, id: &str) -> Result<()> {
    let store = app
        .store(STORE_FILENAME)
        .map_err(|e| anyhow!("Impossibile accedere allo store: {}", e))?;

    let mut commands = load_saved_commands_impl(app)?;

    let original_len = commands.len();
    commands.retain(|c| c.id != id);

    if commands.len() == original_len {
        return Err(anyhow!("Comando non trovato"));
    }

    store.set(COMMANDS_KEY, serde_json::to_value(&commands)?);

    store
        .save()
        .map_err(|e| anyhow!("Impossibile persistere lo store: {}", e))?;

    Ok(())
}
