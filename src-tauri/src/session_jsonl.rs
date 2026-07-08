//! Shared JSONL transcript parser for Claude Code + Cursor CLI agent sessions.
//! Both CLIs emit Anthropic-style stream-json lines in on-disk transcripts.

use std::io::{BufRead, BufReader};
use std::path::Path;

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

pub fn parse_session_jsonl(path: &Path) -> Result<Vec<LoadedMessage>, String> {
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
