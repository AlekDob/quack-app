//! Pinky Brain bridge — wraps the local `pinky` CLI for search, stats,
//! setup, and Quack Brain → Pinky global path migration.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Command;

const PINKY_DB: &str = "brain.db";
const PINKY_SAVE: &str = "documentation";

#[derive(Serialize, Clone)]
pub struct PinkyAvailability {
    pub ok: bool,
    pub version: Option<String>,
}

#[derive(Serialize, Clone)]
pub struct PinkyWorkspaceStatus {
    pub pinky_ok: bool,
    pub version: Option<String>,
    pub documentation_exists: bool,
    pub mcp_installed: bool,
    pub rule_installed: bool,
    pub db_exists: bool,
    pub entries: u32,
    pub chunks: u32,
    pub global_migrated: bool,
}

#[derive(Serialize, Clone, Deserialize)]
pub struct PinkySearchHit {
    pub id: String,
    pub path: String,
    pub title: String,
    pub snippet: String,
    #[serde(rename = "type")]
    pub entry_type: Option<String>,
    pub score: f64,
}

#[derive(Serialize, Clone)]
pub struct PinkySearchResult {
    pub query: String,
    pub results: Vec<PinkySearchHit>,
}

#[derive(Serialize, Clone)]
pub struct PinkySetupResult {
    pub ok: bool,
    pub message: String,
}

#[derive(Serialize, Clone, Deserialize, Default)]
pub struct PinkyUsageStats {
    pub hits: u32,
    pub noise_hits: u32,
    pub served_entries: u32,
    pub sessions: u32,
    pub useful_entries: u32,
    pub useful_hits: u32,
}

#[derive(Serialize, Clone, Deserialize, Default)]
pub struct PinkyValueStats {
    pub entries: u32,
    pub chunks: u32,
    pub never_used: u32,
    #[serde(default)]
    pub by_type: std::collections::HashMap<String, u32>,
    #[serde(default)]
    pub usage: PinkyUsageStats,
}

#[derive(Serialize, Clone, Deserialize)]
pub struct PinkyTelemetryEntry {
    pub path: String,
    pub title: String,
    pub count: u32,
}

#[derive(Serialize, Clone, Deserialize)]
pub struct PinkyTelemetryStale {
    pub path: String,
    pub title: String,
}

#[derive(Serialize, Clone, Deserialize, Default)]
pub struct PinkyTelemetry {
    #[serde(default)]
    pub most_used: Vec<PinkyTelemetryEntry>,
    #[serde(default)]
    pub never_used: Vec<PinkyTelemetryStale>,
}

fn resolve_pinky() -> Option<PathBuf> {
    let home = dirs::home_dir()?;
    for rel in [".local/bin/pinky", ".cargo/bin/pinky"] {
        let p = home.join(rel);
        if p.exists() {
            return Some(p);
        }
    }
    Command::new("sh")
        .args(["-lc", "command -v pinky"])
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| PathBuf::from(String::from_utf8_lossy(&o.stdout).trim().to_string()))
        .filter(|p| !p.as_os_str().is_empty() && p.exists())
}

fn pinky_cmd(root: &Path) -> Result<Command, String> {
    let exe = resolve_pinky().ok_or_else(|| {
        "Pinky Brain CLI not found. Install from https://pinkybrain.dev".to_string()
    })?;
    let mut cmd = Command::new(exe);
    cmd.current_dir(root)
        .env("PINKY_DB", PINKY_DB)
        .env("PINKY_SAVE_DIR", PINKY_SAVE);
    Ok(cmd)
}

fn run_pinky(root: &Path, args: &[&str]) -> Result<String, String> {
    let out = pinky_cmd(root)?
        .args(args)
        .output()
        .map_err(|e| format!("failed to run pinky: {e}"))?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr);
        let msg = String::from_utf8_lossy(&out.stdout);
        return Err(format!(
            "pinky {} failed: {}{}",
            args.first().copied().unwrap_or(""),
            err.trim(),
            if msg.trim().is_empty() {
                String::new()
            } else {
                format!(" ({})", msg.trim())
            }
        ));
    }
    Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
}

fn read_stats(root: &Path) -> (u32, u32) {
    let raw = run_pinky(root, &["stats", "--json"]).unwrap_or_default();
    let Ok(v) = serde_json::from_str::<serde_json::Value>(&raw) else {
        return (0, 0);
    };
    let entries = v.get("entries").and_then(|n| n.as_u64()).unwrap_or(0) as u32;
    let chunks = v.get("chunks").and_then(|n| n.as_u64()).unwrap_or(0) as u32;
    (entries, chunks)
}

fn workspace_mcp(root: &Path) -> bool {
    let path = root.join(".mcp.json");
    let Ok(raw) = std::fs::read_to_string(path) else {
        return false;
    };
    raw.contains("\"pinky\"")
}

fn workspace_rule(root: &Path) -> bool {
    root.join(".claude/rules/use-pinky-brain.md").exists()
}

fn migrate_global_brain() -> Result<bool, String> {
    let home = dirs::home_dir().ok_or("no home dir")?;
    let quack = home.join(".quack/brain");
    let pinky = home.join(".pinky/brain");
    if !quack.exists() {
        return Ok(false);
    }
    if pinky.exists() {
        return Ok(false);
    }
    if let Some(parent) = pinky.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(&quack, &pinky).map_err(|e| e.to_string())?;
    }
    #[cfg(not(unix))]
    {
        copy_dir_recursive(&quack, &pinky)?;
    }
    Ok(true)
}

#[cfg(not(unix))]
fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    std::fs::create_dir_all(dst).map_err(|e| e.to_string())?;
    for entry in std::fs::read_dir(src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let ty = entry.file_type().map_err(|e| e.to_string())?;
        let to = dst.join(entry.file_name());
        if ty.is_dir() {
            copy_dir_recursive(&entry.path(), &to)?;
        } else {
            std::fs::copy(entry.path(), to).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn write_project_mcp(root: &Path) -> Result<(), String> {
    let path = root.join(".mcp.json");
    if path.exists() && workspace_mcp(root) {
        return Ok(());
    }
    let mut servers = serde_json::Map::new();
    if path.exists() {
        let raw = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(&raw) {
            if let Some(obj) = v.get("mcpServers").and_then(|o| o.as_object()) {
                servers = obj.clone();
            }
        }
    }
    servers.insert(
        "pinky".to_string(),
        serde_json::json!({
            "command": "pinky-mcp",
            "env": {
                "PINKY_DB": PINKY_DB,
                "PINKY_SAVE_DIR": PINKY_SAVE
            }
        }),
    );
    let doc = serde_json::json!({ "mcpServers": servers });
    let pretty = serde_json::to_string_pretty(&doc).map_err(|e| e.to_string())?;
    crate::atomic::write(&path, pretty.as_bytes()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn pinky_available() -> PinkyAvailability {
    let Some(exe) = resolve_pinky() else {
        return PinkyAvailability {
            ok: false,
            version: None,
        };
    };
    let version = Command::new(exe)
        .arg("--version")
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string());
    PinkyAvailability {
        ok: true,
        version,
    }
}

#[tauri::command]
pub fn pinky_workspace_status(root: String) -> Result<PinkyWorkspaceStatus, String> {
    let root = PathBuf::from(root);
    let avail = pinky_available();
    let migrated = migrate_global_brain().unwrap_or(false);
    let (entries, chunks) = if avail.ok {
        read_stats(&root)
    } else {
        (0, 0)
    };
    Ok(PinkyWorkspaceStatus {
        pinky_ok: avail.ok,
        version: avail.version,
        documentation_exists: root.join(PINKY_SAVE).is_dir(),
        mcp_installed: workspace_mcp(&root),
        rule_installed: workspace_rule(&root),
        db_exists: root.join(PINKY_DB).exists(),
        entries,
        chunks,
        global_migrated: migrated,
    })
}

#[tauri::command]
pub fn pinky_search(
    root: String,
    query: String,
    limit: Option<u32>,
) -> Result<PinkySearchResult, String> {
    let root = PathBuf::from(root);
    let lim = limit.unwrap_or(5).max(1).min(20);
    let raw = run_pinky(
        &root,
        &["search", &query, "--json", "--limit", &lim.to_string()],
    )?;
    let v: serde_json::Value = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    let results = v
        .get("results")
        .and_then(|r| r.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|item| serde_json::from_value::<PinkySearchHit>(item.clone()).ok())
                .collect()
        })
        .unwrap_or_default();
    Ok(PinkySearchResult {
        query: v
            .get("query")
            .and_then(|q| q.as_str())
            .unwrap_or(&query)
            .to_string(),
        results,
    })
}

#[tauri::command]
pub fn pinky_reindex(root: String) -> Result<PinkySetupResult, String> {
    let root = PathBuf::from(root);
    let doc = root.join(PINKY_SAVE);
    if !doc.is_dir() {
        return Err("documentation/ folder not found — run Setup first".to_string());
    }
    run_pinky(&root, &["reindex", PINKY_SAVE])?;
    let (entries, chunks) = read_stats(&root);
    Ok(PinkySetupResult {
        ok: true,
        message: format!("Indexed {entries} entries ({chunks} chunks)"),
    })
}

#[tauri::command]
pub fn pinky_setup(root: String) -> Result<PinkySetupResult, String> {
    let root = PathBuf::from(root);
    let _ = migrate_global_brain();
    run_pinky(&root, &["init", "--no-model"])?;
    write_project_mcp(&root)?;
    if root.join(PINKY_SAVE).is_dir() {
        let _ = run_pinky(&root, &["reindex", PINKY_SAVE]);
    }
    let (entries, chunks) = read_stats(&root);
    Ok(PinkySetupResult {
        ok: true,
        message: format!("Pinky Brain ready — {entries} entries ({chunks} chunks)"),
    })
}

#[tauri::command]
pub fn pinky_migrate_global_brain() -> Result<bool, String> {
    migrate_global_brain()
}

#[tauri::command]
pub fn pinky_stats_value(root: String) -> Result<PinkyValueStats, String> {
    let root = PathBuf::from(root);
    let raw = run_pinky(&root, &["stats", "--value", "--json"])?;
    serde_json::from_str(&raw).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn pinky_telemetry(root: String) -> Result<PinkyTelemetry, String> {
    let root = PathBuf::from(root);
    let raw = run_pinky(&root, &["telemetry", "--json"])?;
    serde_json::from_str(&raw).map_err(|e| e.to_string())
}
