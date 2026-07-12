//! Quack Store — detect optional extensions, hybrid install, SkillOpt-Sleep bridge.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::{Command, Stdio};

#[derive(Serialize, Clone)]
pub struct ExtensionStatusRow {
    pub id: String,
    pub installed: bool,
    pub version: Option<String>,
    pub workspace_ready: Option<bool>,
}

#[derive(Serialize, Clone)]
pub struct InstallResult {
    pub ok: bool,
    pub message: String,
    pub manual_command: Option<String>,
}

#[derive(Serialize, Clone, Default)]
pub struct SkillOptSleepStatus {
    pub available: bool,
    pub has_proposal: bool,
    pub proposal_summary: Option<String>,
    pub proposal_skill_path: Option<String>,
    pub proposal_body: Option<String>,
    pub raw_output: Option<String>,
}

#[derive(Serialize, Clone)]
pub struct SkillOptRunResult {
    pub ok: bool,
    pub output: String,
}

async fn off_thread<T: Send + 'static>(
    f: impl FnOnce() -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(f)
        .await
        .map_err(|e| e.to_string())?
}

fn resolve_on_path(name: &str) -> Option<PathBuf> {
    let home = dirs::home_dir()?;
    for rel in [
        format!(".local/bin/{name}"),
        format!(".cargo/bin/{name}"),
    ] {
        let p = home.join(&rel);
        if p.exists() {
            return Some(p);
        }
    }
    Command::new("sh")
        .args(["-lc", &format!("command -v {name}")])
        .output()
        .ok()
        .filter(|o| o.status.success())
        .and_then(|o| {
            let s = String::from_utf8_lossy(&o.stdout).trim().to_string();
            if s.is_empty() {
                None
            } else {
                Some(PathBuf::from(s))
            }
        })
}

fn cli_version(exe: &PathBuf) -> Option<String> {
    Command::new(exe)
        .arg("--version")
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
}

fn detect_cli(command: &str) -> (bool, Option<String>) {
    let Some(exe) = resolve_on_path(command) else {
        return (false, None);
    };
    (true, cli_version(&exe))
}

fn pinky_workspace_ready(root: &str) -> bool {
    let root = PathBuf::from(root);
    root.join("brain.db").exists() || root.join(".mcp.json").exists()
}

fn run_install(cmd: &str, args: &[&str]) -> InstallResult {
    let out = Command::new(cmd).args(args).output();
    match out {
        Ok(o) if o.status.success() => InstallResult {
            ok: true,
            message: format!("Installed via {cmd} {}", args.join(" ")),
            manual_command: None,
        },
        Ok(o) => {
            let stderr = String::from_utf8_lossy(&o.stderr).trim().to_string();
            let stdout = String::from_utf8_lossy(&o.stdout).trim().to_string();
            let detail = if !stderr.is_empty() { stderr } else { stdout };
            InstallResult {
                ok: false,
                message: if detail.is_empty() {
                    format!("{cmd} exited with {}", o.status)
                } else {
                    detail
                },
                manual_command: Some(format!("{cmd} {}", args.join(" "))),
            }
        }
        Err(e) => InstallResult {
            ok: false,
            message: e.to_string(),
            manual_command: Some(format!("{cmd} {}", args.join(" "))),
        },
    }
}

fn pip_install(package: &str) -> InstallResult {
    let manual = format!("pipx install {package}");
    let mut last = InstallResult {
        ok: false,
        message: "Install failed — try the manual command below".into(),
        manual_command: Some(manual.clone()),
    };

    if let Some(pipx) = resolve_on_path("pipx") {
        let pipx_s = pipx.to_string_lossy();
        let res = run_install(&pipx_s, &["install", package]);
        if res.ok {
            return res;
        }
        last = res;
    }

    for args in [
        vec!["-m", "pip", "install", "--user", package],
        vec![
            "-m",
            "pip",
            "install",
            "--user",
            "--break-system-packages",
            package,
        ],
    ] {
        let res = run_install("python3", &args);
        if res.ok {
            return res;
        }
        last = res;
    }

    for args in [vec!["install", "--user", package], vec!["install", package]] {
        let res = run_install("pip3", &args);
        if res.ok {
            return res;
        }
        last = res;
    }

    InstallResult {
        ok: false,
        message: if last.message.is_empty() {
            "pip/pipx install failed — try the manual command below".into()
        } else {
            last.message
        },
        manual_command: last.manual_command.or(Some(manual)),
    }
}

fn cargo_install(crate_name: &str) -> InstallResult {
    let res = run_install("cargo", &["install", crate_name]);
    if res.ok {
        return res;
    }
    InstallResult {
        ok: false,
        message: res.message,
        manual_command: Some(format!("cargo install {crate_name}")),
    }
}

fn run_skillopt(args: &[&str]) -> Result<String, String> {
    let Some(exe) = resolve_on_path("skillopt-sleep") else {
        return Err("skillopt-sleep not found on PATH".into());
    };
    let out = Command::new(exe)
        .args(args)
        .stdin(Stdio::null())
        .output()
        .map_err(|e| e.to_string())?;
    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
    let stderr = String::from_utf8_lossy(&out.stderr).to_string();
    if out.status.success() {
        Ok(if stdout.is_empty() { stderr } else { stdout })
    } else {
        Err(if stderr.is_empty() { stdout } else { stderr })
    }
}

fn has_staged_proposal(raw: &str) -> bool {
    let lower = raw.to_lowercase();
    if lower.contains("no staged proposal") || lower.contains("no proposal") {
        return false;
    }
    if extract_path(raw).is_some() {
        return true;
    }
    lower.contains("staged proposal:")
        || lower.contains("proposal ready")
        || lower.contains("pending proposal")
}

fn parse_skillopt_status(raw: &str) -> SkillOptSleepStatus {
    let has_proposal = has_staged_proposal(raw);
    SkillOptSleepStatus {
        available: true,
        has_proposal,
        proposal_summary: if has_proposal {
            Some(first_line(raw))
        } else {
            None
        },
        proposal_skill_path: extract_path(raw),
        proposal_body: if has_proposal && raw.len() > 80 {
            Some(raw.to_string())
        } else {
            None
        },
        raw_output: Some(raw.to_string()),
    }
}

fn first_line(s: &str) -> String {
    s.lines()
        .find(|l| !l.trim().is_empty())
        .unwrap_or("")
        .trim()
        .to_string()
}

fn extract_path(s: &str) -> Option<String> {
    for line in s.lines() {
        let t = line.trim();
        if t.contains("SKILL.md") || t.contains(".claude/skills") {
            return Some(t.to_string());
        }
    }
    None
}

#[tauri::command]
pub async fn quack_extensions_status(root: String) -> Result<Vec<ExtensionStatusRow>, String> {
    off_thread(move || {
        let ids = ["pinky-brain", "skill-trainer"];
        let mut out = Vec::new();
        for id in ids {
            let row = match id {
                "pinky-brain" => {
                    let (installed, version) = detect_cli("pinky");
                    ExtensionStatusRow {
                        id: id.into(),
                        installed,
                        version,
                        workspace_ready: if installed {
                            Some(pinky_workspace_ready(&root))
                        } else {
                            None
                        },
                    }
                }
                "skill-trainer" => {
                    let (installed, version) = detect_cli("skillopt-sleep");
                    ExtensionStatusRow {
                        id: id.into(),
                        installed,
                        version,
                        workspace_ready: None,
                    }
                }
                _ => continue,
            };
            out.push(row);
        }
        Ok(out)
    })
    .await
}

#[derive(Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum InstallMethodArg {
    Pip { package: String },
    Cargo { crate_name: String },
}

#[tauri::command]
pub async fn quack_extensions_install(method: InstallMethodArg) -> Result<InstallResult, String> {
    off_thread(move || {
        Ok(match method {
            InstallMethodArg::Pip { package } => pip_install(&package),
            InstallMethodArg::Cargo { crate_name } => cargo_install(&crate_name),
        })
    })
    .await
}

#[tauri::command]
pub async fn skillopt_sleep_status() -> Result<SkillOptSleepStatus, String> {
    off_thread(|| {
        if resolve_on_path("skillopt-sleep").is_none() {
            return Ok(SkillOptSleepStatus::default());
        }
        match run_skillopt(&["status"]) {
            Ok(raw) => Ok(parse_skillopt_status(&raw)),
            Err(e) => Ok(SkillOptSleepStatus {
                available: true,
                raw_output: Some(e),
                ..Default::default()
            }),
        }
    })
    .await
}

#[tauri::command]
pub async fn skillopt_sleep_dry_run() -> Result<SkillOptRunResult, String> {
    off_thread(|| {
        let out = run_skillopt(&["dry-run"])?;
        Ok(SkillOptRunResult {
            ok: true,
            output: out,
        })
    })
    .await
}

#[tauri::command]
pub async fn skillopt_sleep_adopt() -> Result<SkillOptRunResult, String> {
    off_thread(|| {
        let out = run_skillopt(&["adopt"])?;
        Ok(SkillOptRunResult {
            ok: true,
            output: out,
        })
    })
    .await
}
