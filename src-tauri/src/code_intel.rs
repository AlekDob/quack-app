// Brain: pattern-code-intel-language-extension
//! Code Intelligence Module
//!
//! Provides Tauri commands for tree-sitter-based code intelligence:
//! - Outline (symbols in a file)
//! - Find definition (where a symbol is defined)
//! - Find references (where a symbol is used)
//!
//! Delegates to Node.js scripts via `code-intel-bridge.js` subprocess.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tokio::io::AsyncWriteExt;
use tokio::process::Command;

// ------------------------------------------------------------------
// Data types
// ------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutlineSymbol {
    pub name: String,
    pub kind: String,
    pub line: u32,
    #[serde(rename = "endLine")]
    pub end_line: u32,
    pub exported: bool,
    pub children: Vec<OutlineSymbol>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Definition {
    pub file: String,
    pub line: u32,
    pub column: u32,
    pub kind: String,
    pub exported: bool,
    pub preview: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FindDefinitionResult {
    pub symbol: String,
    pub definitions: Vec<Definition>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Reference {
    pub file: String,
    pub line: u32,
    pub column: u32,
    pub context: String,
    pub preview: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FindReferencesResult {
    pub symbol: String,
    pub total_count: u32,
    pub references: Vec<Reference>,
}

// ------------------------------------------------------------------
// Bridge invocation
// ------------------------------------------------------------------

/// Resolve the path to `node-sdk/` directory.
/// In dev: `CARGO_MANIFEST_DIR/node-sdk/`
/// In production macOS: `Contents/Resources/node-sdk/`
fn get_node_sdk_path() -> PathBuf {
    // Dev path (set at compile time)
    let dev_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("node-sdk");
    if dev_path.exists() {
        return dev_path;
    }

    // Production: relative to the running binary
    let exe = std::env::current_exe().unwrap_or_default();
    let base = exe.parent().unwrap_or(
        std::path::Path::new(".")
    );
    // Brain: fix-windows-code-intel-path
    // Brain: gotcha-windows-path-separators
    // macOS: Contents/MacOS/quack → ../Resources/node-sdk
    // Windows: app dir is flat, node-sdk sits in resources/
    #[cfg(target_os = "macos")]
    { base.join("../Resources/node-sdk") }
    #[cfg(target_os = "windows")]
    { base.join("resources/node-sdk") }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    { base.join("../Resources/node-sdk") }
}

/// Build a `tokio::process::Command` for `node` with the
/// user's full PATH (handles macOS GUI-launch missing PATH).
fn node_command() -> Command {
    let mut cmd = Command::new("node");
    cmd.env("PATH", crate::shell_env::get_extended_path());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    cmd
}

/// Invoke `code-intel-bridge.js` with a JSON payload on stdin
/// and parse the JSON response from stdout.
async fn invoke_bridge(
    payload: &serde_json::Value,
) -> Result<serde_json::Value, String> {
    let sdk_path = get_node_sdk_path();
    let bridge = sdk_path.join("code-intel-bridge.js");

    if !bridge.exists() {
        return Err(format!(
            "code-intel-bridge.js not found at {}",
            bridge.display()
        ));
    }

    let input = serde_json::to_string(payload)
        .map_err(|e| format!("Failed to serialize payload: {e}"))?;

    let mut child = node_command()
        .arg(&bridge)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .current_dir(&sdk_path)
        .spawn()
        .map_err(|e| format!("Failed to spawn node: {e}"))?;

    // Write JSON to stdin
    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(input.as_bytes())
            .await
            .map_err(|e| format!("Failed to write stdin: {e}"))?;
        // Drop to close stdin so the child reads EOF
    }

    let output = child
        .wait_with_output()
        .await
        .map_err(|e| format!("Failed to read output: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        return Err(format!(
            "code-intel-bridge exited with {}: {}{}",
            output.status,
            stderr.trim(),
            if stdout.is_empty() {
                String::new()
            } else {
                format!(" | stdout: {}", stdout.trim())
            }
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);

    // Check for bridge-level error
    let value: serde_json::Value = serde_json::from_str(&stdout)
        .map_err(|e| format!(
            "Failed to parse bridge response: {e} | raw: {}",
            &stdout[..stdout.len().min(200)]
        ))?;

    if let Some(err) = value.get("error").and_then(|v| v.as_str()) {
        return Err(format!("code-intel error: {err}"));
    }

    Ok(value)
}

// ------------------------------------------------------------------
// Tauri commands
// ------------------------------------------------------------------

/// Get the AST outline (symbols) for a single file.
#[tauri::command]
pub async fn code_intel_outline(
    file_path: String,
) -> Result<Vec<OutlineSymbol>, String> {
    let payload = serde_json::json!({
        "action": "outline",
        "args": { "filePath": file_path }
    });

    let value = invoke_bridge(&payload).await?;

    serde_json::from_value(value).map_err(|e| {
        format!("Failed to deserialize outline: {e}")
    })
}

/// Find all definitions of a symbol across a project.
#[tauri::command]
pub async fn code_intel_find_definition(
    symbol: String,
    project_path: String,
    file_extensions: Option<Vec<String>>,
) -> Result<FindDefinitionResult, String> {
    let mut args = serde_json::json!({
        "symbol": symbol,
        "projectPath": project_path
    });

    if let Some(exts) = file_extensions {
        args["fileExtensions"] = serde_json::json!(exts);
    }

    let payload = serde_json::json!({
        "action": "findDefinition",
        "args": args
    });

    let value = invoke_bridge(&payload).await?;

    serde_json::from_value(value).map_err(|e| {
        format!("Failed to deserialize definitions: {e}")
    })
}

/// Find all references to a symbol across a project.
#[tauri::command]
pub async fn code_intel_find_references(
    symbol: String,
    project_path: String,
    max_results: Option<u32>,
) -> Result<FindReferencesResult, String> {
    let payload = serde_json::json!({
        "action": "findReferences",
        "args": {
            "symbol": symbol,
            "projectPath": project_path,
            "maxResults": max_results.unwrap_or(50)
        }
    });

    let value = invoke_bridge(&payload).await?;

    serde_json::from_value(value).map_err(|e| {
        format!("Failed to deserialize references: {e}")
    })
}
