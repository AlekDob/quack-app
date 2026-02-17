use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanUsageData {
    pub current_session: SessionUsage,
    pub current_week: WeeklyUsage,
    pub reset_time: Option<String>,
    pub last_updated: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionUsage {
    pub percentage: f64,
    pub model: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeeklyUsage {
    pub all_models: f64,
    pub opus: Option<f64>,
    pub sonnet: Option<f64>,
}

/// Get Claude plan usage by executing `claude /usage` command
#[tauri::command]
pub async fn get_claude_plan_usage() -> Result<PlanUsageData, String> {
    let mut cmd = Command::new("claude");
    cmd.arg("/usage");

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let output = cmd.output()
        .map_err(|e| format!("Failed to execute claude command: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Claude command failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);

    // DEBUG: Log the raw output
    eprintln!("=== RAW CLAUDE /usage OUTPUT ===");
    eprintln!("{}", stdout);
    eprintln!("=== END OUTPUT ===");

    let result = parse_usage_output(&stdout)?;

    // DEBUG: Log parsed result
    eprintln!("=== PARSED RESULT ===");
    eprintln!("Current session: {}%", result.current_session.percentage);
    eprintln!("Current week (all): {}%", result.current_week.all_models);
    eprintln!("Current week (opus): {:?}", result.current_week.opus);
    eprintln!("Current week (sonnet): {:?}", result.current_week.sonnet);
    eprintln!("Reset times: {:?}", result.reset_time);
    eprintln!("=== END RESULT ===");

    Ok(result)
}

/// Open native terminal and execute `claude /usage` in the specified directory
#[tauri::command]
pub async fn open_claude_usage_in_terminal(cwd: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        // Use osascript to open Terminal.app, cd to the directory, and run the command
        let script = format!(
            r#"
            tell application "Terminal"
                activate
                do script "cd '{}' && claude /usage"
            end tell
            "#,
            cwd.replace("'", "'\\''") // Escape single quotes for shell safety
        );

        Command::new("osascript")
            .arg("-e")
            .arg(&script)
            .spawn()
            .map_err(|e| format!("Failed to open Terminal: {}", e))?;

        Ok(())
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err("Opening terminal is only supported on macOS".to_string())
    }
}

fn parse_usage_output(output: &str) -> Result<PlanUsageData, String> {
    let mut current_session_percentage = 0.0;
    let current_session_model: Option<String> = None;
    let mut weekly_all_models = 0.0;
    let mut weekly_opus: Option<f64> = None;
    let mut weekly_sonnet: Option<f64> = None;
    let mut reset_times: Vec<String> = Vec::new();

    for line in output.lines() {
        let line = line.trim();
        let line_lower = line.to_lowercase();

        // Parse "Current session" with or without model name
        // Format: "Current session                27% used"
        if line_lower.starts_with("current session") {
            if let Some(pct) = extract_percentage(line) {
                current_session_percentage = pct;
            }
        }

        // Parse "Current week (all models)"
        // Format: "Current week (all models)      34% used"
        if line_lower.contains("current week") && line_lower.contains("all models") {
            if let Some(pct) = extract_percentage(line) {
                weekly_all_models = pct;
            }
        }

        // Parse "Current week (Opus)"
        // Format: "Current week (Opus)            29% used"
        if line_lower.contains("current week") && line_lower.contains("opus") {
            if let Some(pct) = extract_percentage(line) {
                weekly_opus = Some(pct);
            }
        }

        // Parse "Current week (Sonnet)"
        // Format: "Current week (Sonnet)          XX% used"
        if line_lower.contains("current week") && line_lower.contains("sonnet") {
            if let Some(pct) = extract_percentage(line) {
                weekly_sonnet = Some(pct);
            }
        }

        // Parse reset times
        // Format: "Resets 6:59pm (Europe/Rome)" or "Resets Oct 23, 9:59am (Europe/Rome)"
        if line_lower.starts_with("resets") {
            let reset_text = line.replace("Resets", "").replace("resets", "").trim().to_string();
            if !reset_text.is_empty() {
                reset_times.push(reset_text);
            }
        }
    }

    // Combine all reset times into one string
    let reset_time = if !reset_times.is_empty() {
        Some(reset_times.join(", "))
    } else {
        None
    };

    Ok(PlanUsageData {
        current_session: SessionUsage {
            percentage: current_session_percentage,
            model: current_session_model,
        },
        current_week: WeeklyUsage {
            all_models: weekly_all_models,
            opus: weekly_opus,
            sonnet: weekly_sonnet,
        },
        reset_time,
        last_updated: chrono::Utc::now().timestamp(),
    })
}

fn extract_percentage(line: &str) -> Option<f64> {
    // Find "XX%" or "XX.X%" pattern
    for word in line.split_whitespace() {
        if word.ends_with('%') {
            if let Ok(pct) = word.trim_end_matches('%').parse::<f64>() {
                return Some(pct);
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_usage_output() {
        let sample = r#"
Current session (sonnet): 17% used
Current week (all models): 32% used
Current week (Opus): 25% used
Current week (Sonnet): 18% used
Resets: 7pm Europe/Rome, Oct 23 10am
        "#;

        let result = parse_usage_output(sample).unwrap();
        assert_eq!(result.current_session.percentage, 17.0);
        assert_eq!(result.current_session.model, Some("sonnet".to_string()));
        assert_eq!(result.current_week.all_models, 32.0);
        assert_eq!(result.current_week.opus, Some(25.0));
        assert_eq!(result.current_week.sonnet, Some(18.0));
        assert!(result.reset_time.is_some());
    }
}
