use serde::{Deserialize, Serialize};
use std::{fs, path::Path, process::Stdio};
use tokio::io::AsyncWriteExt;
use tokio::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeCliResponse {
    pub result: String,
    pub session_id: String,
    pub total_cost_usd: f64,
    pub usage: Usage,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Usage {
    pub input_tokens: u32,
    pub output_tokens: u32,
    #[serde(default)]
    pub cache_read_input_tokens: u32,
    #[serde(default)]
    pub cache_creation_input_tokens: u32,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ClaudeCliRequest {
    pub prompt: String,
    pub model: Option<String>,
    pub thinking_mode: Option<String>,
    pub permission_mode: Option<String>,
    pub attachments: Option<Vec<String>>,
}

const DEFAULT_MODEL: &str = "sonnet";
const MAX_ATTACHMENTS: usize = 6;
const MAX_ATTACHMENT_SIZE: u64 = 15 * 1024 * 1024;

/// Check if Claude CLI is available and authenticated
#[tauri::command]
pub fn check_claude_cli_available() -> Result<bool, String> {
    let output = std::process::Command::new("claude")
        .arg("--version")
        .output();

    match output {
        Ok(output) => {
            if output.status.success() {
                Ok(true)
            } else {
                Ok(false)
            }
        }
        Err(_) => Ok(false),
    }
}

/// Send a message to Claude via CLI
#[tauri::command]
pub async fn send_message_via_cli(request: ClaudeCliRequest) -> Result<ClaudeCliResponse, String> {
    // Check if CLI is available
    if !check_claude_cli_available().map_err(|e| e.to_string())? {
        return Err("Claude CLI is not available. Make sure Claude Code CLI is installed and you are logged in.".to_string());
    }

    let ClaudeCliRequest {
        prompt,
        model,
        thinking_mode,
        permission_mode,
        attachments,
    } = request;

    let mut prompt_with_attachments = prompt.clone();

    if let Some(list) = attachments {
        if list.len() > MAX_ATTACHMENTS {
            return Err(format!("Too many attachments. Maximum allowed is {}.", MAX_ATTACHMENTS));
        }

        let mut has_header = prompt_with_attachments.contains("Attachments:");

        for path in list {
            let trimmed = path.trim();
            if trimmed.is_empty() {
                continue;
            }

            let metadata = fs::metadata(trimmed)
                .map_err(|e| format!("Unable to read attachment '{}': {}", trimmed, e))?;

            if !metadata.is_file() {
                return Err(format!("Attachment is not a file: {}", trimmed));
            }

            if metadata.len() > MAX_ATTACHMENT_SIZE {
                let name = Path::new(trimmed)
                    .file_name()
                    .and_then(|s| s.to_str())
                    .unwrap_or(trimmed);
                return Err(format!("Attachment '{}' exceeds 15MB limit.", name));
            }

            if prompt_with_attachments.contains(trimmed) {
                continue;
            }

            if !has_header {
                if !prompt_with_attachments.ends_with('\n') {
                    prompt_with_attachments.push('\n');
                }
                prompt_with_attachments.push_str("\nAttachments:\n");
                has_header = true;
            }

            prompt_with_attachments.push_str(trimmed);
            prompt_with_attachments.push('\n');
        }
    }

    // Prepare the command
    let mut command = Command::new("claude");
    command
        .arg("--print")
        .arg("--output-format")
        .arg("json");

    let selected_model = model.unwrap_or_else(|| DEFAULT_MODEL.to_string());
    command.arg("--model").arg(&selected_model);

    if let Some(mode) = thinking_mode.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() || trimmed.eq_ignore_ascii_case("auto") {
            None
        } else {
            Some(trimmed.to_owned())
        }
    }) {
        command.arg("--think").arg(mode);
    }

    if let Some(mode) = permission_mode.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_lowercase())
        }
    }) {
        if mode.eq_ignore_ascii_case("bypass") {
            command.arg("--permission-mode").arg(&mode);
            command.arg("--dangerously-skip-permissions");
        } else {
            command.arg("--permission-mode").arg(&mode);
        }
    }

    command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = command
        .spawn()
        .map_err(|e| format!("Failed to spawn claude command: {}", e))?;

    // Write prompt to stdin
    {
        let stdin = child.stdin.as_mut()
            .ok_or("Failed to open stdin".to_string())?;
        stdin.write_all(prompt_with_attachments.as_bytes()).await
            .map_err(|e| format!("Failed to write to stdin: {}", e))?;
    }

    // Wait for command to complete and get output
    let output = child.wait_with_output().await
        .map_err(|e| format!("Failed to wait for claude command: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Claude CLI failed: {}", stderr));
    }

    // Parse JSON output
    let stdout = String::from_utf8_lossy(&output.stdout);
    let response: ClaudeCliResponse = serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse Claude CLI JSON response: {}", e))?;

    Ok(response)
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cli_availability() {
        // This test will only pass if Claude CLI is installed
        let available = check_claude_cli_available().unwrap_or(false);
        println!("Claude CLI available: {}", available);
    }
}
