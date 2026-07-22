//! Shared JSONL transcript parser for Claude Code + Cursor CLI agent sessions.
//! Both CLIs emit Anthropic-style stream-json lines in on-disk transcripts.

use crate::provider_path::encode_project_path;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};

#[derive(serde::Serialize, Clone)]
pub struct LoadedMessage {
    pub role: String,
    pub content: String,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub tool_calls: Vec<LoadedToolCall>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub tool_results: Vec<LoadedToolResult>,
}

#[derive(serde::Serialize, Clone)]
pub struct LoadedToolCall {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    pub function: LoadedToolFunction,
}

#[derive(serde::Serialize, Clone)]
pub struct LoadedToolFunction {
    pub name: String,
    pub arguments: serde_json::Value,
}

#[derive(serde::Serialize, Clone)]
pub struct LoadedToolResult {
    pub tool_use_id: String,
    pub content: String,
    pub is_error: Option<bool>,
}

/// Parse a session JSONL, optionally keeping only the last `max_messages`
/// messages (anti-bomb for multi-10MB Claude Code transcripts).
/// `None` = uncapped.
pub fn parse_session_jsonl_capped(
    path: &Path,
    max_messages: Option<usize>,
) -> Result<Vec<LoadedMessage>, String> {
    use std::fs;
    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut reader = BufReader::new(file);
    let mut buf = String::with_capacity(8 * 1024);
    let mut messages: Vec<LoadedMessage> = Vec::new();

    loop {
        buf.clear();
        match reader.read_line(&mut buf) {
            Ok(0) => break,
            Ok(_) => {
                let line = buf.trim();
                if line.is_empty() {
                    continue;
                }
                let v: serde_json::Value = match serde_json::from_str(line) {
                    Ok(v) => v,
                    Err(_) => continue,
                };
                let ty = v.get("type").and_then(|x| x.as_str()).unwrap_or("");
                match ty {
                    "user" => {
                        let (text, results) = extract_user_blocks(&v);
                        if !results.is_empty() {
                            if let Some(last_asst) = messages
                                .iter_mut()
                                .rev()
                                .find(|m| m.role == "assistant")
                            {
                                last_asst.tool_results.extend(results);
                            }
                        }
                        if !text.is_empty() {
                            messages.push(LoadedMessage {
                                role: "user".into(),
                                content: text,
                                tool_calls: Vec::new(),
                                tool_results: Vec::new(),
                            });
                        }
                    }
                    "assistant" => {
                        let (text, calls) = extract_assistant_blocks(&v);
                        if text.is_empty() && calls.is_empty() {
                            continue;
                        }
                        messages.push(LoadedMessage {
                            role: "assistant".into(),
                            content: text,
                            tool_calls: calls,
                            tool_results: Vec::new(),
                        });
                    }
                    _ => {}
                }
            }
            Err(_) => break,
        }
    }
    if let Some(max) = max_messages {
        if max > 0 && messages.len() > max {
            messages = messages.split_off(messages.len() - max);
        }
    }
    Ok(messages)
}

pub fn extract_user_text(v: &serde_json::Value) -> Option<String> {
    let msg = v.get("message")?;
    let content = msg.get("content")?;
    if let Some(s) = content.as_str() {
        return Some(s.to_string());
    }
    if let Some(arr) = content.as_array() {
        let mut out = String::new();
        for block in arr {
            let bt = block.get("type").and_then(|x| x.as_str()).unwrap_or("");
            if bt == "text" {
                if let Some(t) = block.get("text").and_then(|x| x.as_str()) {
                    if !out.is_empty() {
                        out.push('\n');
                    }
                    out.push_str(t);
                }
            }
        }
        if !out.is_empty() {
            return Some(out);
        }
    }
    None
}

pub fn trim_oneline(s: &str, max: usize) -> String {
    let line = s.lines().next().unwrap_or("").trim();
    if line.chars().count() <= max {
        return line.to_string();
    }
    let mut out: String = line.chars().take(max).collect();
    out.push('…');
    out
}

fn extract_user_blocks(v: &serde_json::Value) -> (String, Vec<LoadedToolResult>) {
    let mut text = String::new();
    let mut results: Vec<LoadedToolResult> = Vec::new();
    let content = v.get("message").and_then(|m| m.get("content"));
    if let Some(s) = content.and_then(|c| c.as_str()) {
        text.push_str(s);
        return (text, results);
    }
    if let Some(arr) = content.and_then(|c| c.as_array()) {
        for block in arr {
            let bt = block.get("type").and_then(|x| x.as_str()).unwrap_or("");
            if bt == "text" {
                if let Some(t) = block.get("text").and_then(|x| x.as_str()) {
                    if !text.is_empty() {
                        text.push('\n');
                    }
                    text.push_str(t);
                }
            } else if bt == "tool_result" {
                let tool_use_id = block
                    .get("tool_use_id")
                    .and_then(|x| x.as_str())
                    .unwrap_or("")
                    .to_string();
                let body = match block.get("content") {
                    Some(serde_json::Value::String(s)) => s.clone(),
                    Some(serde_json::Value::Array(items)) => items
                        .iter()
                        .filter_map(|b| {
                            let bt = b.get("type").and_then(|x| x.as_str())?;
                            if bt == "text" {
                                b.get("text").and_then(|x| x.as_str()).map(|s| s.to_string())
                            } else if bt == "image" {
                                Some("[image]".to_string())
                            } else {
                                None
                            }
                        })
                        .collect::<Vec<_>>()
                        .join("\n"),
                    _ => String::new(),
                };
                let is_error = block.get("is_error").and_then(|x| x.as_bool());
                results.push(LoadedToolResult {
                    tool_use_id,
                    content: body,
                    is_error,
                });
            }
        }
    }
    (text, results)
}

fn extract_assistant_blocks(v: &serde_json::Value) -> (String, Vec<LoadedToolCall>) {
    let mut text = String::new();
    let mut calls: Vec<LoadedToolCall> = Vec::new();
    let content = v
        .get("message")
        .and_then(|m| m.get("content"))
        .and_then(|c| c.as_array());
    let Some(arr) = content else {
        return (text, calls);
    };
    for block in arr {
        let bt = block.get("type").and_then(|x| x.as_str()).unwrap_or("");
        if bt == "text" {
            if let Some(t) = block.get("text").and_then(|x| x.as_str()) {
                if !text.is_empty() {
                    text.push('\n');
                }
                text.push_str(t);
            }
        } else if bt == "tool_use" {
            calls.push(LoadedToolCall {
                id: block
                    .get("id")
                    .and_then(|x| x.as_str())
                    .map(|s| s.to_string()),
                function: LoadedToolFunction {
                    name: block
                        .get("name")
                        .and_then(|x| x.as_str())
                        .unwrap_or("")
                        .to_string(),
                    arguments: block
                        .get("input")
                        .cloned()
                        .unwrap_or(serde_json::Value::Object(Default::default())),
                },
            });
        }
    }
    (text, calls)
}

/// Last API-call input snapshot from a session JSONL (matches CC `/context`).
#[derive(serde::Serialize, Clone)]
pub struct SessionContextSnap {
    pub input_tokens: u64,
    pub cache_read_tokens: u64,
    pub cache_creation_tokens: u64,
}

pub fn claude_jsonl_path(cwd: &str, session_id: &str) -> PathBuf {
    let home = dirs::home_dir().expect("home dir");
    home.join(".claude")
        .join("projects")
        .join(encode_project_path(cwd))
        .join(format!("{session_id}.jsonl"))
}

fn is_sidechain_record(v: &serde_json::Value) -> bool {
    if v.get("parent_tool_use_id").is_some() {
        return true;
    }
    v.get("isSidechain")
        .and_then(|x| x.as_bool())
        .unwrap_or(false)
}

fn usage_snap_from_value(u: &serde_json::Value) -> SessionContextSnap {
    SessionContextSnap {
        input_tokens: u
            .get("input_tokens")
            .and_then(|x| x.as_u64())
            .unwrap_or(0),
        cache_read_tokens: u
            .get("cache_read_input_tokens")
            .and_then(|x| x.as_u64())
            .unwrap_or(0),
        cache_creation_tokens: u
            .get("cache_creation_input_tokens")
            .and_then(|x| x.as_u64())
            .unwrap_or(0),
    }
}

/// Walk JSONL backwards — prefer latest non-subagent `assistant` usage.
pub fn last_context_snap(path: &Path) -> Option<SessionContextSnap> {
    let content = std::fs::read_to_string(path).ok()?;
    last_context_snap_str(&content)
}

/// Same as `last_context_snap` but over already-read content — lets callers
/// that also need `summarise_jsonl` read the (possibly large) file ONCE.
pub fn last_context_snap_str(content: &str) -> Option<SessionContextSnap> {
    let mut result_snap: Option<SessionContextSnap> = None;
    for line in content.lines().rev() {
        let v: serde_json::Value = match serde_json::from_str(line) {
            Ok(v) => v,
            Err(_) => continue,
        };
        if is_sidechain_record(&v) {
            continue;
        }
        let t = v.get("type").and_then(|x| x.as_str())?;
        if t == "assistant" {
            if let Some(u) = v.get("message").and_then(|m| m.get("usage")) {
                return Some(usage_snap_from_value(u));
            }
        }
        if t == "result" && result_snap.is_none() {
            if let Some(u) = v.get("usage") {
                result_snap = Some(usage_snap_from_value(u));
            }
        }
    }
    result_snap
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn load_cap_keeps_tail_only() {
        let path = std::env::temp_dir().join(format!(
            "quack-cap-test-{}.jsonl",
            std::process::id()
        ));
        let mut f = std::fs::File::create(&path).unwrap();
        for i in 0..10 {
            writeln!(
                f,
                r#"{{"type":"user","message":{{"content":"u{i}"}}}}"#
            )
            .unwrap();
            writeln!(
                f,
                r#"{{"type":"assistant","message":{{"content":[{{"type":"text","text":"a{i}"}}]}}}}"#
            )
            .unwrap();
        }
        let all = parse_session_jsonl_capped(&path, None).unwrap();
        assert_eq!(all.len(), 20);
        let capped = parse_session_jsonl_capped(&path, Some(6)).unwrap();
        let _ = std::fs::remove_file(&path);
        assert_eq!(capped.len(), 6);
        assert_eq!(capped[0].content, "u7");
        assert_eq!(capped[5].content, "a9");
    }
}
