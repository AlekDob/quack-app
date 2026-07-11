// Live Claude Code session monitor for the Quack sidebar Usage panel.
//
// Parses every JSONL under ~/.claude/projects/*/ on demand, summarises
// per-session token usage + estimated USD cost + active/zombie state, and
// returns the lot to the frontend in a single Tauri command. The
// frontend then polls this every few seconds to drive the live Usage tab.
//
// Brain: claude-usage-spike
use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

#[derive(Serialize, Clone)]
pub struct UsageSession {
    pub session_id: String,
    pub project: String,
    /// Last segment of the encoded project path, e.g. "Virgilio" or
    /// "codetta" — used by the panel for compact labels.
    pub project_label: String,
    pub primary_model: String,
    pub pricing_tier: String,
    pub turns: u32,
    pub thinking_blocks: u32,
    pub task_subagents: u32,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cache_read_tokens: u64,
    pub cache_creation_tokens: u64,
    pub cache_creation_5m: u64,
    pub cache_creation_1h: u64,
    pub cache_hit_ratio: f32,
    pub estimated_cost_usd: f32,
    /// Unix millis of the first event (0 if unknown).
    pub first_ts_ms: u64,
    /// Unix millis of the most recent event of any kind.
    pub last_ts_ms: u64,
    /// Unix millis of the most recent user (non-tool-echo) event.
    pub last_user_ts_ms: u64,
    /// True if the session was spawned with a quack-managed-hook in
    /// `.claude/settings.local.json` — i.e. Quack was the active surface
    /// when it was started.
    pub quack_spawned: bool,
}

#[derive(Serialize, Clone)]
pub struct UsageReport {
    pub now_ms: u64,
    pub sessions: Vec<UsageSession>,
    pub total_cost_usd: f32,
    pub total_turns: u64,
    pub active_count: u32,
    pub zombie_count: u32,
}

const PRICING_OPUS: (f32, f32, f32, f32, f32) = (5.0, 25.0, 6.25, 10.0, 0.50);
const PRICING_SONNET: (f32, f32, f32, f32, f32) = (3.0, 15.0, 3.75, 6.0, 0.30);
const PRICING_HAIKU: (f32, f32, f32, f32, f32) = (1.0, 5.0, 1.25, 2.0, 0.10);

fn pricing_for(model: &str) -> (f32, f32, f32, f32, f32, &str) {
    // Returns (input, output, cc_5m, cc_1h, cache_read, tier_label).
    let m = model.to_lowercase();
    if m.contains("haiku") {
        let p = PRICING_HAIKU;
        (p.0, p.1, p.2, p.3, p.4, "haiku")
    } else if m.contains("sonnet") {
        let p = PRICING_SONNET;
        (p.0, p.1, p.2, p.3, p.4, "sonnet")
    } else {
        let p = PRICING_OPUS;
        (p.0, p.1, p.2, p.3, p.4, "opus")
    }
}

fn parse_iso_ms(ts: &str) -> u64 {
    // Accept RFC3339 with optional fractional seconds and Z/offset.
    // We only need rough epoch ms for sorting + freshness math; a sloppy
    // parser is fine here and avoids pulling in chrono.
    let bytes = ts.as_bytes();
    // Find "T" and the year/month/day/hour/minute/second integers.
    if bytes.len() < 19 {
        return 0;
    }
    let year: i32 = match std::str::from_utf8(&bytes[0..4])
        .ok()
        .and_then(|s| s.parse().ok())
    {
        Some(y) => y,
        None => return 0,
    };
    let month: i32 = match std::str::from_utf8(&bytes[5..7])
        .ok()
        .and_then(|s| s.parse().ok())
    {
        Some(m) => m,
        None => return 0,
    };
    let day: i32 = match std::str::from_utf8(&bytes[8..10])
        .ok()
        .and_then(|s| s.parse().ok())
    {
        Some(d) => d,
        None => return 0,
    };
    let hour: i32 = match std::str::from_utf8(&bytes[11..13])
        .ok()
        .and_then(|s| s.parse().ok())
    {
        Some(h) => h,
        None => return 0,
    };
    let minute: i32 = match std::str::from_utf8(&bytes[14..16])
        .ok()
        .and_then(|s| s.parse().ok())
    {
        Some(m) => m,
        None => return 0,
    };
    let second: i32 = match std::str::from_utf8(&bytes[17..19])
        .ok()
        .and_then(|s| s.parse().ok())
    {
        Some(s) => s,
        None => return 0,
    };
    // Days since 1970-01-01 (Gregorian). This is the standard Howard
    // Hinnant date algorithm; deliberately simple (no leap-second table).
    let (y, m) = if month <= 2 { (year - 1, month + 9) } else { (year, month - 3) };
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = (y - era * 400) as i64;
    let m_idx = m as i64;
    let doy = (153 * m_idx + 2) / 5 + day as i64 - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    let days = era as i64 * 146097 + doe - 719468;
    let secs = days * 86400 + hour as i64 * 3600 + minute as i64 * 60 + second as i64;
    (secs * 1000).max(0) as u64
}

fn short_project(encoded: &str) -> String {
    let prefixes = [
        "-Users-alekdob-Desktop-Dev-Personal-",
        "-Users-alekdob-Desktop-Dev-",
        "-Users-alekdob-Documents-",
        "-Users-alekdob-",
    ];
    for p in prefixes {
        if let Some(stripped) = encoded.strip_prefix(p) {
            return stripped.trim_end_matches('-').to_string();
        }
    }
    encoded.to_string()
}

fn summarise(path: &Path) -> Option<UsageSession> {
    summarise_jsonl(path)
}

/// Single-session JSONL rollup (tokens, cost estimate, timestamps).
pub fn summarise_jsonl(path: &Path) -> Option<UsageSession> {
    let metadata = fs::metadata(path).ok()?;
    let modified_ms = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    let content = fs::read_to_string(path).ok()?;
    if content.is_empty() {
        return None;
    }

    let mut usage = UsageAccumulator::default();
    let mut models: HashMap<String, u32> = HashMap::new();
    let mut user_msgs: u32 = 0;
    let mut last_user_ts: u64 = 0;
    let mut last_any_ts: u64 = 0;
    let mut first_ts: u64 = 0;
    let mut quack_spawned = false;

    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let v: serde_json::Value = match serde_json::from_str(line) {
            Ok(v) => v,
            Err(_) => continue,
        };
        let t = v.get("type").and_then(|x| x.as_str()).unwrap_or("");
        let ts_str = v.get("timestamp").and_then(|x| x.as_str()).unwrap_or("");
        let ts_ms = parse_iso_ms(ts_str);
        if ts_ms != 0 {
            if first_ts == 0 || ts_ms < first_ts {
                first_ts = ts_ms;
            }
            if ts_ms > last_any_ts {
                last_any_ts = ts_ms;
            }
        }

        match t {
            "user" => {
                let is_tool_echo = v
                    .get("message")
                    .and_then(|m| m.get("content"))
                    .and_then(|c| c.as_array())
                    .map(|arr| {
                        arr.iter()
                            .any(|b| b.get("type").and_then(|x| x.as_str()) == Some("tool_result"))
                    })
                    .unwrap_or(false);
                let sidechain = v
                    .get("isSidechain")
                    .and_then(|x| x.as_bool())
                    .unwrap_or(false);
                if !is_tool_echo && !sidechain {
                    user_msgs += 1;
                    if ts_ms > last_user_ts {
                        last_user_ts = ts_ms;
                    }
                }
            }
            "assistant" => {
                let msg = v.get("message").cloned().unwrap_or_default();
                if let Some(model) = msg.get("model").and_then(|x| x.as_str()) {
                    *models.entry(model.to_string()).or_insert(0) += 1;
                }
                if let Some(u) = msg.get("usage") {
                    usage.input += u
                        .get("input_tokens")
                        .and_then(|x| x.as_u64())
                        .unwrap_or(0);
                    usage.output += u
                        .get("output_tokens")
                        .and_then(|x| x.as_u64())
                        .unwrap_or(0);
                    usage.cache_read += u
                        .get("cache_read_input_tokens")
                        .and_then(|x| x.as_u64())
                        .unwrap_or(0);
                    usage.cache_creation += u
                        .get("cache_creation_input_tokens")
                        .and_then(|x| x.as_u64())
                        .unwrap_or(0);
                    if let Some(cc) = u.get("cache_creation").and_then(|x| x.as_object()) {
                        usage.cc_5m += cc
                            .get("ephemeral_5m_input_tokens")
                            .and_then(|x| x.as_u64())
                            .unwrap_or(0);
                        usage.cc_1h += cc
                            .get("ephemeral_1h_input_tokens")
                            .and_then(|x| x.as_u64())
                            .unwrap_or(0);
                    }
                }
                if let Some(arr) = msg.get("content").and_then(|x| x.as_array()) {
                    for block in arr {
                        let bt = block.get("type").and_then(|x| x.as_str()).unwrap_or("");
                        if bt == "thinking" {
                            usage.thinking_blocks += 1;
                        } else if bt == "tool_use" {
                            if let Some(name) =
                                block.get("name").and_then(|x| x.as_str())
                            {
                                if name == "Task" || name == "Agent" {
                                    usage.task_subagents += 1;
                                }
                            }
                        }
                    }
                }
            }
            "system" => {
                if let Some(infos) = v.get("hookInfos").and_then(|x| x.as_array()) {
                    for hi in infos {
                        let cmd = hi.get("command").and_then(|x| x.as_str()).unwrap_or("");
                        if cmd.contains("quack-managed-hook") {
                            quack_spawned = true;
                            break;
                        }
                    }
                }
            }
            _ => {}
        }
    }

    let primary_model = models
        .iter()
        .max_by_key(|(_, v)| *v)
        .map(|(k, _)| k.clone())
        .unwrap_or_default();
    let primary_model_clone = primary_model.clone();
    let (p_in, p_out, p_5m, p_1h, p_cr, tier) = pricing_for(&primary_model_clone);
    let cost = (usage.input as f32 * p_in
        + usage.output as f32 * p_out
        + usage.cc_5m as f32 * p_5m
        + usage.cc_1h as f32 * p_1h
        + usage.cache_read as f32 * p_cr)
        / 1_000_000.0;

    let total_for_ratio = usage.input + usage.cache_read + usage.cache_creation;
    let cache_hit_ratio = if total_for_ratio > 0 {
        usage.cache_read as f32 / total_for_ratio as f32
    } else {
        0.0
    };

    let project = path
        .parent()
        .and_then(|p| p.file_name())
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_string();

    Some(UsageSession {
        session_id: path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_string(),
        project_label: short_project(&project),
        project,
        primary_model,
        pricing_tier: tier.to_string(),
        turns: user_msgs,
        thinking_blocks: usage.thinking_blocks,
        task_subagents: usage.task_subagents,
        input_tokens: usage.input,
        output_tokens: usage.output,
        cache_read_tokens: usage.cache_read,
        cache_creation_tokens: usage.cache_creation,
        cache_creation_5m: usage.cc_5m,
        cache_creation_1h: usage.cc_1h,
        cache_hit_ratio,
        estimated_cost_usd: cost,
        first_ts_ms: first_ts,
        last_ts_ms: if last_any_ts != 0 { last_any_ts } else { modified_ms },
        last_user_ts_ms: last_user_ts,
        quack_spawned,
    })
}

#[derive(Default)]
struct UsageAccumulator {
    input: u64,
    output: u64,
    cache_read: u64,
    cache_creation: u64,
    cc_5m: u64,
    cc_1h: u64,
    thinking_blocks: u32,
    task_subagents: u32,
}

fn projects_root() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".claude").join("projects"))
}

/// Return the current Usage report. The frontend polls this every few
/// seconds; a single command keeps the cost low (one dir walk + one
/// JSONL pass per session per poll). `min_age_min` filters out sessions
/// whose last event is older than that — keeps the panel snappy when
/// the user has thousands of old JSONL files.
#[tauri::command]
pub async fn claude_usage_sessions(min_age_min: Option<u64>) -> Result<UsageReport, String> {
    let min_age_min = min_age_min.unwrap_or(0);

    // 5s cache: the same `min_age_min` within the window returns the
    // cached report without touching disk. Polling at 12s means the
    // second poll in any window is free; session churn (new chat
    // surfaces within a few seconds) is still visible. The check is cheap
    // (one mutex + clone) so it stays on the caller's thread.
    {
        let cache = REPORT_CACHE.lock().unwrap();
        if let Some(c) = cache.as_ref() {
            let now = now_ms();
            if c.min_age_min == min_age_min && now.saturating_sub(c.at) < CACHE_TTL_MS {
                return Ok(c.report.clone());
            }
        }
    }

    // The scan reads + parses every recent JSONL; never run it on the
    // core thread (it would stall IPC + window events → the UI freezes
    // the user reported). Same spawn_blocking pattern as git.rs/search.rs.
    tauri::async_runtime::spawn_blocking(move || scan_sessions(min_age_min))
        .await
        .map_err(|e| format!("usage scan join: {}", e))?
}

/// Blocking session scan — walks `~/.claude/projects`, summarises each
/// recent JSONL and caches the result. Runs on the blocking pool.
fn scan_sessions(min_age_min: u64) -> Result<UsageReport, String> {
    let now = now_ms();
    let root = projects_root().ok_or_else(|| "no home dir".to_string())?;
    if !root.exists() {
        let r = UsageReport {
            now_ms: now,
            sessions: Vec::new(),
            total_cost_usd: 0.0,
            total_turns: 0,
            active_count: 0,
            zombie_count: 0,
        };
        *REPORT_CACHE.lock().unwrap() = Some(CachedReport {
            at: now,
            min_age_min,
            report: r.clone(),
        });
        return Ok(r);
    }
    let min_age_ms = min_age_min.saturating_mul(60_000);
    let mut sessions: Vec<UsageSession> = Vec::new();
    let entries = match fs::read_dir(&root) {
        Ok(e) => e,
        Err(_) => return Ok(empty_report(now)),
    };
    for entry in entries.flatten() {
        let proj_dir = entry.path();
        if !proj_dir.is_dir() {
            continue;
        }
        let files = match fs::read_dir(&proj_dir) {
            Ok(f) => f,
            Err(_) => continue,
        };
        for f in files.flatten() {
            let path = f.path();
            if path.extension().and_then(|x| x.to_str()) != Some("jsonl") {
                continue;
            }
            // Cheap mtime gate BEFORE reading the file. This is the perf
            // fix: previously every JSONL (hundreds of MB across 300+
            // sessions) was read + JSON-parsed in full on every poll just
            // to be discarded by the age filter below. A file untouched
            // for longer than the window can't be in-window, so skip it
            // without ever opening it.
            if min_age_ms > 0 {
                let mtime_ms = fs::metadata(&path)
                    .and_then(|m| m.modified())
                    .ok()
                    .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
                    .map(|d| d.as_millis() as u64)
                    .unwrap_or(0);
                if mtime_ms != 0 && now.saturating_sub(mtime_ms) > min_age_ms {
                    continue;
                }
            }
            if let Some(s) = summarise(&path) {
                // Filter: skip sessions with zero turns that haven't
                // been touched recently (they're empty shells).
                if s.turns == 0
                    && s.last_ts_ms != 0
                    && now.saturating_sub(s.last_ts_ms) > min_age_ms.max(86_400_000)
                {
                    continue;
                }
                if s.last_ts_ms != 0
                    && now.saturating_sub(s.last_ts_ms) > min_age_ms
                    && s.estimated_cost_usd < 0.05
                {
                    continue;
                }
                sessions.push(s);
            }
        }
    }
    // Sort: most recently active first, then by cost desc as tiebreaker.
    sessions.sort_by(|a, b| {
        b.last_ts_ms
            .cmp(&a.last_ts_ms)
            .then_with(|| b.estimated_cost_usd.partial_cmp(&a.estimated_cost_usd).unwrap_or(std::cmp::Ordering::Equal))
    });
    let total_cost: f32 = sessions.iter().map(|s| s.estimated_cost_usd).sum();
    let total_turns: u64 = sessions.iter().map(|s| s.turns as u64).sum();
    let active_count = sessions
        .iter()
        .filter(|s| s.last_ts_ms != 0 && now.saturating_sub(s.last_ts_ms) < 10 * 60_000)
        .count() as u32;
    let zombie_count = sessions
        .iter()
        .filter(|s| {
            s.last_ts_ms != 0
                && now.saturating_sub(s.last_ts_ms) < 10 * 60_000
                && s.last_user_ts_ms != 0
                && now.saturating_sub(s.last_user_ts_ms) > 30 * 60_000
        })
        .count() as u32;
    let report = UsageReport {
        now_ms: now,
        sessions,
        total_cost_usd: total_cost,
        total_turns,
        active_count,
        zombie_count,
    };
    // Populate the cache so the next poll inside the 5s window is free.
    // (The previous code never wrote here — the cache only worked for the
    // empty/no-home branches, so every poll re-walked the whole tree.)
    *REPORT_CACHE.lock().unwrap() = Some(CachedReport {
        at: now,
        min_age_min,
        report: report.clone(),
    });
    Ok(report)
}

fn empty_report(now: u64) -> UsageReport {
    UsageReport {
        now_ms: now,
        sessions: Vec::new(),
        total_cost_usd: 0.0,
        total_turns: 0,
        active_count: 0,
        zombie_count: 0,
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

// ---------------------------------------------------------------------------
// 5s in-process cache so the frontend's 8s polling doesn't re-walk every
// JSONL on every refresh. The poll is cheap (~150ms for 300 sessions) but
// keeping the cache warm means the perceived latency stays low and a
// panel that gets polled on focus / hover doesn't hit disk twice.
//
// `cached_report` is updated only when `cached_at` is older than
// CACHE_TTL_MS. We invalidate eagerly on explicit `clear` commands;
// mutation of the JSONL files from outside Quack (Claude Code CLI
// directly) is rare enough that a 5s window is fine.
// ---------------------------------------------------------------------------
use std::sync::Mutex;

const CACHE_TTL_MS: u64 = 5_000;

struct CachedReport {
    at: u64,
    min_age_min: u64,
    report: UsageReport,
}

static REPORT_CACHE: Mutex<Option<CachedReport>> = Mutex::new(None);

/// Render the session JSONL as a human-readable markdown transcript and
/// write it to a cache file under the OS cache dir. Returns the path so
/// the frontend can open it as a regular editor tab via `openFile`.
/// Re-running on an already-cached session just rewrites it (cheap, and
/// keeps the transcript current if the JSONL grew since the last open).
#[tauri::command]
pub fn claude_session_export_markdown(
    project: String,
    session_id: String,
) -> Result<String, String> {
    use std::io::Write;
    let home = dirs::home_dir().ok_or_else(|| "no home dir".to_string())?;
    let projects_dir = home.join(".claude").join("projects");
    let jsonl_path = projects_dir.join(&project).join(format!("{}.jsonl", session_id));
    if !jsonl_path.exists() {
        return Err(format!("session not found: {}", session_path(&project, &session_id)));
    }

    let cache_root = match dirs::cache_dir() {
        Some(c) => c.join("quack-sessions"),
        None => home.join(".cache").join("quack-sessions"),
    };
    fs::create_dir_all(&cache_root).map_err(|e| format!("mkdir cache: {}", e))?;
    let out_path = cache_root.join(format!("{}-{}.md", project_label(&project), session_id));

    let content = fs::read_to_string(&jsonl_path)
        .map_err(|e| format!("read jsonl: {}", e))?;
    let markdown = render_markdown(&project, &session_id, &content);
    let mut f = fs::File::create(&out_path)
        .map_err(|e| format!("create out: {}", e))?;
    f.write_all(markdown.as_bytes())
        .map_err(|e| format!("write out: {}", e))?;
    Ok(out_path.to_string_lossy().into_owned())
}

fn session_path(project: &str, session_id: &str) -> String {
    format!("~/.claude/projects/{}/{}.jsonl", project, session_id)
}

fn project_label(encoded: &str) -> String {
    let prefixes = [
        "-Users-alekdob-Desktop-Dev-Personal-",
        "-Users-alekdob-Desktop-Dev-",
        "-Users-alekdob-Documents-",
        "-Users-alekdob-",
    ];
    for p in prefixes {
        if let Some(stripped) = encoded.strip_prefix(p) {
            return stripped.trim_end_matches('-').to_string();
        }
    }
    encoded.to_string()
}

fn render_markdown(project: &str, session_id: &str, jsonl: &str) -> String {
    use std::fmt::Write;
    let mut out = String::new();
    let _ = writeln!(
        out,
        "# Claude Code session\n\n- **Session:** `{}`\n- **Project:** `{}`\n",
        session_id, project
    );
    let mut user_turn = 0u32;
    let mut total_cost: f32 = 0.0;
    let mut total_in: u64 = 0;
    let mut total_out: u64 = 0;
    let mut total_cache_read: u64 = 0;
    let mut total_cache_create: u64 = 0;
    for line in jsonl.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let v: serde_json::Value = match serde_json::from_str(line) {
            Ok(v) => v,
            Err(_) => continue,
        };
        let t = v.get("type").and_then(|x| x.as_str()).unwrap_or("");
        let ts = v
            .get("timestamp")
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .replace('T', " ")
            .trim_end_matches('Z')
            .to_string();
        match t {
            "user" => {
                let is_tool_echo = v
                    .get("message")
                    .and_then(|m| m.get("content"))
                    .and_then(|c| c.as_array())
                    .map(|arr| {
                        arr.iter()
                            .any(|b| b.get("type").and_then(|x| x.as_str()) == Some("tool_result"))
                    })
                    .unwrap_or(false);
                let content = v.get("message").and_then(|m| m.get("content"));
                if is_tool_echo {
                    if let Some(arr) = content.and_then(|c| c.as_array()) {
                        for b in arr {
                            if b.get("type").and_then(|x| x.as_str()) == Some("tool_result") {
                                let id = b
                                    .get("tool_use_id")
                                    .and_then(|x| x.as_str())
                                    .unwrap_or("?");
                                let c = b.get("content");
                                let rendered = match c {
                                    Some(serde_json::Value::String(s)) => s.clone(),
                                    Some(serde_json::Value::Array(a)) => a
                                        .iter()
                                        .filter_map(|x| {
                                            x.get("text").and_then(|t| t.as_str())
                                        })
                                        .collect::<Vec<_>>()
                                        .join("\n"),
                                    _ => String::new(),
                                };
                                let preview = truncate(&rendered, 400);
                                let _ = writeln!(out, "**`{}`** ↩ `{}`\n", id, preview);
                            }
                        }
                    }
                    continue;
                }
                user_turn += 1;
                let text = match content {
                    Some(serde_json::Value::String(s)) => s.clone(),
                    Some(serde_json::Value::Array(a)) => a
                        .iter()
                        .filter_map(|x| x.get("text").and_then(|t| t.as_str()))
                        .collect::<Vec<_>>()
                        .join("\n"),
                    _ => String::new(),
                };
                let _ = writeln!(
                    out,
                    "\n---\n\n### User turn #{}\n\n**`{}`**\n\n{}\n",
                    user_turn,
                    ts,
                    if text.is_empty() { "_(empty)_".to_string() } else { text }
                );
            }
            "assistant" => {
                let msg = v.get("message").cloned().unwrap_or_default();
                let model = msg.get("model").and_then(|x| x.as_str()).unwrap_or("?");
                let usage = msg.get("usage");
                if let Some(u) = usage {
                    let inp = u.get("input_tokens").and_then(|x| x.as_u64()).unwrap_or(0);
                    let out_t = u.get("output_tokens").and_then(|x| x.as_u64()).unwrap_or(0);
                    let cr = u.get("cache_read_input_tokens").and_then(|x| x.as_u64()).unwrap_or(0);
                    let cc = u
                        .get("cache_creation_input_tokens")
                        .and_then(|x| x.as_u64())
                        .unwrap_or(0);
                    total_in += inp;
                    total_out += out_t;
                    total_cache_read += cr;
                    total_cache_create += cc;
                    let _ = writeln!(
                        out,
                        "_tokens: in {} · out {} · cache read {} · cache write {}_\n",
                        fmt_tok(inp),
                        fmt_tok(out_t),
                        fmt_tok(cr),
                        fmt_tok(cc)
                    );
                }
                if let Some(arr) = msg.get("content").and_then(|x| x.as_array()) {
                    for block in arr {
                        let bt = block.get("type").and_then(|x| x.as_str()).unwrap_or("");
                        match bt {
                            "text" => {
                                let text = block
                                    .get("text")
                                    .and_then(|x| x.as_str())
                                    .unwrap_or("");
                                if !text.is_empty() {
                                    let _ = writeln!(out, "{}\n", text);
                                }
                            }
                            "thinking" => {
                                let t = block
                                    .get("thinking")
                                    .and_then(|x| x.as_str())
                                    .unwrap_or("");
                                if !t.is_empty() {
                                    let _ = writeln!(out, "<details><summary>Thinking</summary>\n\n{}\n\n</details>\n", t);
                                }
                            }
                            "tool_use" => {
                                let name =
                                    block.get("name").and_then(|x| x.as_str()).unwrap_or("?");
                                let id = block.get("id").and_then(|x| x.as_str()).unwrap_or("?");
                                let input = block
                                    .get("input")
                                    .map(|x| serde_json::to_string_pretty(x).unwrap_or_default())
                                    .unwrap_or_default();
                                let _ = writeln!(
                                    out,
                                    "**`{}`** ➜ `{}`\n\n```json\n{}\n```\n",
                                    id,
                                    name,
                                    truncate(&input, 1200)
                                );
                            }
                            _ => {}
                        }
                    }
                }
                let _ = writeln!(out, "_assistant · `{}` · `{}`_\n", model, ts);
            }
            "result" => {
                let cost = v.get("cost_usd").and_then(|x| x.as_f64()).unwrap_or(0.0);
                total_cost += cost as f32;
                let _ = writeln!(
                    out,
                    "\n**Result** · cost `${:.4}` · `{}`\n",
                    cost, ts
                );
            }
            _ => {}
        }
    }
    let _ = writeln!(
        out,
        "\n---\n\n## Totals\n\n- Cost: `${:.4}`\n- Input tokens: {}\n- Output tokens: {}\n- Cache read: {}\n- Cache write: {}\n- User turns: {}\n",
        total_cost,
        fmt_tok(total_in),
        fmt_tok(total_out),
        fmt_tok(total_cache_read),
        fmt_tok(total_cache_create),
        user_turn
    );
    out
}

fn fmt_tok(n: u64) -> String {
    if n < 1000 {
        n.to_string()
    } else if n < 1_000_000 {
        format!("{:.1}k", n as f64 / 1000.0)
    } else {
        format!("{:.2}M", n as f64 / 1_000_000.0)
    }
}

fn truncate(s: &str, max: usize) -> String {
    if s.len() <= max {
        s.to_string()
    } else {
        let mut end = max;
        while !s.is_char_boundary(end) {
            end -= 1;
        }
        format!("{}…", &s[..end])
    }
}

// ---------------------------------------------------------------------------
// Chunked turn loader for the in-tab session transcript viewer.
//
// A Claude Code JSONL is one giant line-buffered stream of events. We
// slice it into "user turns" — each starting at a non-tool-echo `user`
// event and ending at the next one (or EOF). The transcript pane asks
// for chunks of N turns at a time and renders incrementally; this keeps
// the per-open cost flat regardless of session size, and avoids the
// "synthesize a multi-MB markdown file and let Monaco choke on it"
// problem we hit on the first cut.
//
// Brain: claude-usage-spike
// ---------------------------------------------------------------------------
#[derive(Serialize, Clone)]
pub struct TurnToolUse {
    pub id: String,
    pub name: String,
    /// Truncated to keep payloads small — the pane shows a "Show full"
    /// affordance if the user really wants the entire input.
    pub input_preview: String,
}

#[derive(Serialize, Clone)]
pub struct TurnToolResult {
    pub tool_use_id: String,
    pub content_preview: String,
    pub is_error: bool,
}

#[derive(Serialize, Clone)]
pub struct Turn {
    pub index: usize,
    pub kind: String, // "user" | "assistant" | "result" | "system"
    pub timestamp: String,
    pub text: String,
    pub thinking: String,
    pub tool_uses: Vec<TurnToolUse>,
    pub tool_results: Vec<TurnToolResult>,
    pub cost_usd: f32,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cache_read_tokens: u64,
    pub cache_creation_tokens: u64,
}

#[derive(Serialize, Clone)]
pub struct TurnChunk {
    pub session_id: String,
    pub project: String,
    pub total: usize,
    pub offset: usize,
    pub limit: usize,
    pub turns: Vec<Turn>,
    pub first_ts: String,
    pub last_ts: String,
    pub total_cost_usd: f32,
    pub total_turns_approx: u32,
}

/// Walk the session JSONL and return turns[offset .. offset+limit].
/// `limit=0` returns only the metadata (counts) — used by the pane to
/// show the header before any scroll happens.
#[tauri::command]
pub fn claude_session_load_turns(
    project: String,
    session_id: String,
    offset: usize,
    limit: usize,
) -> Result<TurnChunk, String> {
    let home = dirs::home_dir().ok_or_else(|| "no home dir".to_string())?;
    let jsonl_path = home
        .join(".claude")
        .join("projects")
        .join(&project)
        .join(format!("{}.jsonl", session_id));
    if !jsonl_path.exists() {
        return Err(format!("session not found: {}", session_id));
    }
    let content = std::fs::read_to_string(&jsonl_path)
        .map_err(|e| format!("read jsonl: {}", e))?;

    // First pass: slice into raw "blocks" delimited by user messages.
    // A block holds everything from one non-tool-echo user event up to
    // (but not including) the next one. This matches the way the chat UI
    // groups messages for display.
    struct RawBlock {
        timestamp: String,
        // Each block is a vector of JSON values; we keep them as raw
        // serde_json::Value so the second pass can do typed reads.
        events: Vec<serde_json::Value>,
    }
    let mut blocks: Vec<RawBlock> = Vec::new();
    let mut current: Option<RawBlock> = None;
    let mut first_ts = String::new();
    let mut last_ts = String::new();
    let mut total_cost: f32 = 0.0;
    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let v: serde_json::Value = match serde_json::from_str(line) {
            Ok(v) => v,
            Err(_) => continue,
        };
        let ty = v.get("type").and_then(|x| x.as_str()).unwrap_or("");
        let ts = v
            .get("timestamp")
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .to_string();
        if first_ts.is_empty() && !ts.is_empty() {
            first_ts = ts.clone();
        }
        if !ts.is_empty() {
            last_ts = ts.clone();
        }
        if ty == "user" {
            let is_tool_echo = v
                .get("message")
                .and_then(|m| m.get("content"))
                .and_then(|c| c.as_array())
                .map(|arr| {
                    arr.iter().any(|b| {
                        b.get("type").and_then(|x| x.as_str()) == Some("tool_result")
                    })
                })
                .unwrap_or(false);
            let sidechain = v
                .get("isSidechain")
                .and_then(|x| x.as_bool())
                .unwrap_or(false);
            if !is_tool_echo && !sidechain {
                if let Some(c) = current.take() {
                    blocks.push(c);
                }
                current = Some(RawBlock {
                    timestamp: ts.clone(),
                    events: Vec::new(),
                });
            }
        }
        if let Some(cost) = v.get("cost_usd").and_then(|x| x.as_f64()) {
            total_cost += cost as f32;
        }
        if let Some(ref mut cur) = current {
            cur.events.push(v);
        }
    }
    if let Some(c) = current.take() {
        blocks.push(c);
    }
    let total = blocks.len();

    // Resolve metadata only (limit=0 is a header probe).
    let mut out_turns: Vec<Turn> = Vec::new();
    if limit > 0 && offset < total {
        let end = (offset + limit).min(total);
        for block in blocks[offset..end].iter().enumerate() {
            let (i, b) = block;
            out_turns.push(block_events_to_turn(i + offset, &b.timestamp, &b.events));
        }
    }
    Ok(TurnChunk {
        session_id,
        project,
        total,
        offset,
        limit,
        turns: out_turns,
        first_ts,
        last_ts,
        total_cost_usd: total_cost,
        total_turns_approx: total as u32,
    })
}

fn block_events_to_turn(
    index: usize,
    timestamp: &str,
    events: &[serde_json::Value],
) -> Turn {
    let mut turn = Turn {
        index,
        kind: "user".to_string(),
        timestamp: timestamp.to_string(),
        text: String::new(),
        thinking: String::new(),
        tool_uses: Vec::new(),
        tool_results: Vec::new(),
        cost_usd: 0.0,
        input_tokens: 0,
        output_tokens: 0,
        cache_read_tokens: 0,
        cache_creation_tokens: 0,
    };
    let mut first_user_text: Option<String> = None;
    let mut text_buf = String::new();
    for ev in events {
        let ty = ev.get("type").and_then(|x| x.as_str()).unwrap_or("");
        match ty {
            "user" => {
                if let Some(content) = ev.get("message").and_then(|m| m.get("content")) {
                    if first_user_text.is_none() {
                        if let Some(s) = content.as_str() {
                            first_user_text = Some(s.to_string());
                        } else if let Some(arr) = content.as_array() {
                            for b in arr {
                                if b.get("type").and_then(|x| x.as_str()) == Some("text") {
                                    if let Some(t) = b.get("text").and_then(|x| x.as_str()) {
                                        first_user_text = Some(t.to_string());
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    if let Some(arr) = content.as_array() {
                        for b in arr {
                            if b.get("type").and_then(|x| x.as_str()) == Some("tool_result") {
                                let id = b
                                    .get("tool_use_id")
                                    .and_then(|x| x.as_str())
                                    .unwrap_or("?")
                                    .to_string();
                                let preview = match b.get("content") {
                                    Some(serde_json::Value::String(s)) => truncate(s, 600),
                                    Some(serde_json::Value::Array(a)) => a
                                        .iter()
                                        .filter_map(|x| {
                                            x.get("text").and_then(|t| t.as_str())
                                        })
                                        .collect::<Vec<_>>()
                                        .join("\n"),
                                    _ => String::new(),
                                };
                                let is_error = b
                                    .get("is_error")
                                    .and_then(|x| x.as_bool())
                                    .unwrap_or(false);
                                turn.tool_results.push(TurnToolResult {
                                    tool_use_id: id,
                                    content_preview: preview,
                                    is_error,
                                });
                            }
                        }
                    }
                }
            }
            "assistant" => {
                let msg = ev.get("message").cloned().unwrap_or_default();
                if let Some(u) = msg.get("usage") {
                    turn.input_tokens += u
                        .get("input_tokens")
                        .and_then(|x| x.as_u64())
                        .unwrap_or(0);
                    turn.output_tokens += u
                        .get("output_tokens")
                        .and_then(|x| x.as_u64())
                        .unwrap_or(0);
                    turn.cache_read_tokens += u
                        .get("cache_read_input_tokens")
                        .and_then(|x| x.as_u64())
                        .unwrap_or(0);
                    turn.cache_creation_tokens += u
                        .get("cache_creation_input_tokens")
                        .and_then(|x| x.as_u64())
                        .unwrap_or(0);
                }
                if let Some(arr) = msg.get("content").and_then(|x| x.as_array()) {
                    for block in arr {
                        let bt = block.get("type").and_then(|x| x.as_str()).unwrap_or("");
                        match bt {
                            "text" => {
                                if let Some(t) =
                                    block.get("text").and_then(|x| x.as_str())
                                {
                                    if !text_buf.is_empty() {
                                        text_buf.push('\n');
                                    }
                                    text_buf.push_str(t);
                                }
                            }
                            "thinking" => {
                                if let Some(t) = block
                                    .get("thinking")
                                    .and_then(|x| x.as_str())
                                {
                                    if !turn.thinking.is_empty() {
                                        turn.thinking.push('\n');
                                    }
                                    turn.thinking.push_str(t);
                                }
                            }
                            "tool_use" => {
                                let name = block
                                    .get("name")
                                    .and_then(|x| x.as_str())
                                    .unwrap_or("?")
                                    .to_string();
                                let id = block
                                    .get("id")
                                    .and_then(|x| x.as_str())
                                    .unwrap_or("?")
                                    .to_string();
                                let input_preview = block
                                    .get("input")
                                    .map(|x| {
                                        serde_json::to_string_pretty(x)
                                            .unwrap_or_default()
                                    })
                                    .unwrap_or_default();
                                turn.tool_uses.push(TurnToolUse {
                                    id,
                                    name,
                                    input_preview: truncate(&input_preview, 800),
                                });
                            }
                            _ => {}
                        }
                    }
                }
                turn.kind = "assistant".to_string();
            }
            "result" => {
                if let Some(c) = ev.get("cost_usd").and_then(|x| x.as_f64()) {
                    turn.cost_usd += c as f32;
                }
            }
            _ => {}
        }
    }
    turn.text = first_user_text.unwrap_or(text_buf);
    turn
}

/// Drawer + composer ring hydration when Quack's stream lacks usage events.
#[derive(Serialize, Clone)]
pub struct SessionDrawerStats {
    pub context_input_tokens: u64,
    pub context_cache_read_tokens: u64,
    pub context_cache_creation_tokens: u64,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cache_read_tokens: u64,
    pub cache_creation_tokens: u64,
    pub estimated_cost_usd: f32,
    pub turns: u32,
    pub primary_model: String,
    pub first_ts_ms: u64,
    pub last_ts_ms: u64,
}

#[tauri::command]
pub fn claude_session_drawer_stats(
    cwd: String,
    session_id: String,
) -> Result<Option<SessionDrawerStats>, String> {
    let path = crate::session_jsonl::claude_jsonl_path(&cwd, &session_id);
    if !path.exists() {
        return Ok(None);
    }
    let summary = summarise_jsonl(&path);
    let context = crate::session_jsonl::last_context_snap(&path);
    let Some(s) = summary else {
        return Ok(None);
    };
    let (ci, cr, cc) = context
        .map(|c| {
            (
                c.input_tokens,
                c.cache_read_tokens,
                c.cache_creation_tokens,
            )
        })
        .unwrap_or((0, 0, 0));
    Ok(Some(SessionDrawerStats {
        context_input_tokens: ci,
        context_cache_read_tokens: cr,
        context_cache_creation_tokens: cc,
        input_tokens: s.input_tokens,
        output_tokens: s.output_tokens,
        cache_read_tokens: s.cache_read_tokens,
        cache_creation_tokens: s.cache_creation_tokens,
        estimated_cost_usd: s.estimated_cost_usd,
        turns: s.turns,
        primary_model: s.primary_model,
        first_ts_ms: s.first_ts_ms,
        last_ts_ms: s.last_ts_ms,
    }))
}