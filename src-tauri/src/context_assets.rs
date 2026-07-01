// Context-cost analyzer for the Usage tab's "Context" view.
//
// Every skill and subagent Claude Code discovers is injected (name +
// description) into the system prompt on every session — so a pile of
// unused global skills silently inflates the context window and every
// cache-write. This module scans the three sources Claude Code reads
// (user `~/.claude/{skills,agents}`, project `<root>/.claude/...`, and
// enabled plugins under `~/.claude/plugins/cache`), estimates each one's
// token weight, and — crucially — counts how many times each skill was
// actually invoked across all local transcripts, so the UI can rank
// "heavy + never used" candidates for archiving.
//
// Weight is a char/4 estimate, not a real tokenizer: good enough to rank
// and to show orders of magnitude, and the UI labels it "~".
use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::SystemTime;

#[derive(Serialize, Clone)]
pub struct ContextAsset {
    pub name: String,
    pub description: String,
    /// "user" | "project" | "plugin:<plugin>"
    pub source: String,
    /// "skill" | "agent"
    pub kind: String,
    /// Absolute path to the backing file (SKILL.md / agent .md) — the
    /// frontend opens it in an editor tab on click.
    pub path: String,
    /// Estimated tokens the asset's full entry (name + description) adds to
    /// the system prompt (~char/4).
    pub est_tokens: u32,
    /// Tokens actually spent given the current `visibility` override:
    /// full for "on", ~name-only for "name-only", 0 when hidden.
    pub effective_tokens: u32,
    /// Current `skillOverrides` value from settings.json:
    /// "on" | "name-only" | "user-invocable-only" | "off". Skills only.
    pub visibility: String,
    /// Whether a visibility toggle applies (user/project skills — the ones
    /// keyed by a bare name in `skillOverrides`).
    pub togglable: bool,
    /// How many times this skill was invoked across all local transcripts.
    /// Always 0 for agents (their invocation isn't a simple skill call).
    pub use_count: u32,
}

#[derive(Serialize, Clone)]
pub struct ContextReport {
    pub now_ms: u64,
    pub assets: Vec<ContextAsset>,
    /// Sum of est_tokens over the *active* (non-archived) assets.
    pub total_tokens: u32,
    pub skill_count: u32,
    pub agent_count: u32,
    /// Skills invoked zero times across every transcript.
    pub unused_count: u32,
    /// Tokens tied up by those never-used skills (at full weight).
    pub unused_tokens: u32,
}

fn name_only_tokens(name: &str) -> u32 {
    ((name.len() + 4) / 4) as u32
}

// Map a skillOverrides value to the tokens it actually costs in context.
fn effective_for(visibility: &str, est: u32, name: &str) -> u32 {
    match visibility {
        "off" | "user-invocable-only" => 0,
        "name-only" => name_only_tokens(name),
        _ => est, // "on" / unknown → full weight
    }
}

fn est_tokens(name: &str, desc: &str) -> u32 {
    // Rough char/4 heuristic — enough to rank and show magnitude. The
    // slash-menu list is roughly "- name: description" per asset.
    ((name.len() + desc.len() + 4) / 4) as u32
}

// Extract a top-level YAML frontmatter field, following simple multi-line
// continuations (indented lines, or a `>`/`|` block scalar) until the next
// top-level key or the end of the block. Enough for `name:`/`description:`.
fn extract_field(frontmatter: &str, key: &str) -> Option<String> {
    let mut lines = frontmatter.lines();
    let head = format!("{}:", key);
    let mut collecting = false;
    let mut out = String::new();
    for line in &mut lines {
        if !collecting {
            let t = line.trim_start();
            if let Some(rest) = t.strip_prefix(&head) {
                collecting = true;
                let first = rest.trim().trim_matches(['>', '|', ' ']);
                if !first.is_empty() {
                    out.push_str(first);
                }
            }
            continue;
        }
        // A new top-level key (word followed by ':') ends the field.
        let t = line.trim_end();
        let is_new_key = t
            .split_once(':')
            .map(|(k, _)| !k.is_empty() && k.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '-'))
            .unwrap_or(false);
        if is_new_key && !t.starts_with([' ', '\t']) {
            break;
        }
        let piece = t.trim();
        if !piece.is_empty() {
            if !out.is_empty() {
                out.push(' ');
            }
            out.push_str(piece);
        }
    }
    if out.is_empty() {
        None
    } else {
        Some(out.trim_matches(['"', '\'', ' ']).to_string())
    }
}

fn frontmatter_block(src: &str) -> &str {
    src.strip_prefix("---")
        .and_then(|rest| rest.split_once("\n---"))
        .map(|(block, _)| block)
        .unwrap_or("")
}

// Read the `---` frontmatter block and pull (name, description). Falls
// back to the dir name and an empty description if the block is missing.
fn parse_asset_md(src: &str, fallback_name: &str) -> (String, String) {
    let fm = frontmatter_block(src);
    let name = extract_field(fm, "name").unwrap_or_else(|| fallback_name.to_string());
    let description = extract_field(fm, "description").unwrap_or_default();
    (name, description)
}

// A skill whose frontmatter declares `disable-model-invocation: true` is
// hidden from the model (author's own choice, versioned with the skill).
fn frontmatter_hidden(src: &str) -> bool {
    extract_field(frontmatter_block(src), "disable-model-invocation")
        .map(|v| v == "true")
        .unwrap_or(false)
}

// Scan a `skills/` dir: each subfolder with a SKILL.md is one skill.
// `togglable` = the visibility override applies (user/project skills, keyed
// by a bare name in skillOverrides). Visibility is filled in build_report.
fn read_skill_dir(dir: &Path, source: &str) -> Vec<ContextAsset> {
    let mut out = Vec::new();
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return out,
    };
    for e in entries.flatten() {
        let path = e.path();
        if !path.is_dir() {
            continue;
        }
        let md = path.join("SKILL.md");
        let src = match fs::read_to_string(&md) {
            Ok(s) => s,
            Err(_) => continue,
        };
        let dir_name = e.file_name().to_string_lossy().into_owned();
        let (name, description) = parse_asset_md(&src, &dir_name);
        let est = est_tokens(&name, &description);
        // Project skills read their state from the frontmatter (the
        // versioned source of truth); user skills get it from
        // skillOverrides in build_report. Plugin skills aren't togglable.
        let hidden = source == "project" && frontmatter_hidden(&src);
        out.push(ContextAsset {
            est_tokens: est,
            effective_tokens: if hidden { 0 } else { est },
            visibility: if hidden { "user-invocable-only" } else { "on" }.to_string(),
            togglable: source == "user" || source == "project",
            name,
            description,
            source: source.to_string(),
            kind: "skill".to_string(),
            path: md.to_string_lossy().into_owned(),
            use_count: 0,
        });
    }
    out
}

// Scan an `agents/` dir for subagent `.md` files. Recurses (plugin
// templates nest them under `agents/<team>/*.md`; user/project keep them
// flat) so the count reflects everything Claude Code actually loads.
fn read_agent_dir(dir: &Path, source: &str) -> Vec<ContextAsset> {
    let mut out = Vec::new();
    collect_agent_md(dir, source, 0, &mut out);
    out
}

fn collect_agent_md(dir: &Path, source: &str, depth: u8, out: &mut Vec<ContextAsset>) {
    if depth > 3 {
        return;
    }
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for e in entries.flatten() {
        let path = e.path();
        if path.is_dir() {
            collect_agent_md(&path, source, depth + 1, out);
            continue;
        }
        if path.extension().and_then(|x| x.to_str()) != Some("md") {
            continue;
        }
        let src = match fs::read_to_string(&path) {
            Ok(s) => s,
            Err(_) => continue,
        };
        let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_string();
        let (name, description) = parse_asset_md(&src, &stem);
        let est = est_tokens(&name, &description);
        out.push(ContextAsset {
            est_tokens: est,
            effective_tokens: est,
            visibility: "on".to_string(),
            togglable: false, // agents aren't controlled by skillOverrides
            name,
            description,
            source: source.to_string(),
            kind: "agent".to_string(),
            path: path.to_string_lossy().into_owned(),
            use_count: 0,
        });
    }
}

// Walk the plugin cache and collect skills + agents from every plugin's
// latest cached version. Plugins nest as
// `cache/<repo>/<plugin>/<version>/{skills,agents}/…`; we keep only the
// highest version per plugin so multiple cached versions aren't counted.
fn scan_plugins(cache_root: &Path) -> Vec<ContextAsset> {
    let mut out = Vec::new();
    let repos = match fs::read_dir(cache_root) {
        Ok(e) => e,
        Err(_) => return out,
    };
    for repo in repos.flatten() {
        let plugins = match fs::read_dir(repo.path()) {
            Ok(e) => e,
            Err(_) => continue,
        };
        for plugin in plugins.flatten() {
            if let Some(ver_dir) = latest_version_dir(&plugin.path()) {
                let label = format!("plugin:{}", plugin.file_name().to_string_lossy());
                collect_plugin_dir(&ver_dir, &label, &mut out);
            }
        }
    }
    out
}

// Pick the lexically-greatest child dir (versions sort well enough for
// the semver-ish `1.0.0`/`1.1.0` dirs the plugin cache uses).
fn latest_version_dir(plugin: &Path) -> Option<PathBuf> {
    fs::read_dir(plugin)
        .ok()?
        .flatten()
        .map(|e| e.path())
        .filter(|p| p.is_dir())
        .max_by_key(|p| p.file_name().map(|n| n.to_os_string()).unwrap_or_default())
}

// Find skills/ and agents/ anywhere under a plugin version dir (templates
// nest them under cli-tool/components/…), and append their assets.
fn collect_plugin_dir(ver_dir: &Path, label: &str, out: &mut Vec<ContextAsset>) {
    for skills in find_named_dirs(ver_dir, "skills") {
        out.extend(read_skill_dir(&skills, label));
    }
    for agents in find_named_dirs(ver_dir, "agents") {
        out.extend(read_agent_dir(&agents, label));
    }
}

// Shallow recursive search (depth ≤4) for dirs with a given name.
fn find_named_dirs(root: &Path, target: &str) -> Vec<PathBuf> {
    let mut found = Vec::new();
    walk_for(root, target, 0, &mut found);
    found
}

fn walk_for(dir: &Path, target: &str, depth: u8, found: &mut Vec<PathBuf>) {
    if depth > 4 {
        return;
    }
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for e in entries.flatten() {
        let p = e.path();
        if !p.is_dir() {
            continue;
        }
        if p.file_name().and_then(|n| n.to_str()) == Some(target) {
            found.push(p.clone());
        } else {
            walk_for(&p, target, depth + 1, found);
        }
    }
}

// Count skill invocations across every transcript by scanning for the
// literal `"skill":"<name>"` the Skill tool_use writes. Cheap substring
// pass — no per-line JSON parse — over files we already read fully.
fn count_skill_usage() -> HashMap<String, u32> {
    let mut counts: HashMap<String, u32> = HashMap::new();
    let root = match dirs::home_dir() {
        Some(h) => h.join(".claude").join("projects"),
        None => return counts,
    };
    let projects = match fs::read_dir(&root) {
        Ok(e) => e,
        Err(_) => return counts,
    };
    for proj in projects.flatten() {
        let files = match fs::read_dir(proj.path()) {
            Ok(f) => f,
            Err(_) => continue,
        };
        for f in files.flatten() {
            let path = f.path();
            if path.extension().and_then(|x| x.to_str()) != Some("jsonl") {
                continue;
            }
            if let Ok(content) = fs::read_to_string(&path) {
                tally_pattern(&content, "\"skill\":\"", &mut counts);
            }
        }
    }
    counts
}

// For each occurrence of `prefix` in haystack, read the identifier up to
// the next '"' and bump its counter.
fn tally_pattern(haystack: &str, prefix: &str, counts: &mut HashMap<String, u32>) {
    for (idx, _) in haystack.match_indices(prefix) {
        let rest = &haystack[idx + prefix.len()..];
        if let Some(end) = rest.find('"') {
            let name = &rest[..end];
            if !name.is_empty() {
                *counts.entry(name.to_string()).or_insert(0) += 1;
            }
        }
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

// Assemble the full report: gather every asset, fold in usage counts,
// then compute the summary rollups.
fn build_report(root: Option<String>) -> ContextReport {
    let home = dirs::home_dir();
    let mut assets: Vec<ContextAsset> = Vec::new();
    if let Some(h) = &home {
        let base = h.join(".claude");
        assets.extend(read_skill_dir(&base.join("skills"), "user"));
        assets.extend(read_agent_dir(&base.join("agents"), "user"));
        assets.extend(scan_plugins(&base.join("plugins").join("cache")));
    }
    if let Some(r) = &root {
        let base = Path::new(r).join(".claude");
        assets.extend(read_skill_dir(&base.join("skills"), "project"));
        assets.extend(read_agent_dir(&base.join("agents"), "project"));
    }
    let usage = count_skill_usage();
    let overrides = read_skill_overrides();
    for a in &mut assets {
        if a.kind != "skill" {
            continue;
        }
        a.use_count = usage.get(&a.name).copied().unwrap_or(0);
        // Only USER skills are controlled by skillOverrides. Project skills
        // already carry their visibility from the SKILL.md frontmatter (set
        // in read_skill_dir) — one source of truth per skill, per the docs.
        if a.source == "user" {
            if let Some(v) = overrides.get(&a.name) {
                a.visibility = v.clone();
                a.effective_tokens = effective_for(v, a.est_tokens, &a.name);
            }
        }
    }
    summarize(assets)
}

fn summarize(assets: Vec<ContextAsset>) -> ContextReport {
    let total_tokens = assets.iter().map(|a| a.effective_tokens).sum();
    let skill_count = assets.iter().filter(|a| a.kind == "skill").count() as u32;
    let agent_count = assets.iter().filter(|a| a.kind == "agent").count() as u32;
    let unused: Vec<&ContextAsset> = assets
        .iter()
        .filter(|a| a.kind == "skill" && a.use_count == 0)
        .collect();
    let unused_count = unused.len() as u32;
    let unused_tokens = unused.iter().map(|a| a.effective_tokens).sum();
    ContextReport {
        now_ms: now_ms(),
        assets,
        total_tokens,
        skill_count,
        agent_count,
        unused_count,
        unused_tokens,
    }
}

// 30s cache keyed by root: the transcript scan is the expensive part and
// usage counts barely move, so we don't re-walk on every tab focus.
struct Cached {
    at: u64,
    root: Option<String>,
    report: ContextReport,
}
static CACHE: Mutex<Option<Cached>> = Mutex::new(None);
const CACHE_TTL_MS: u64 = 30_000;

/// Return the context-cost report. `root` is the active workspace path so
/// project-local skills/agents are included; pass null for user+plugins
/// only. Runs on the blocking pool (transcript scan reads many files).
#[tauri::command]
pub async fn claude_context_assets(root: Option<String>) -> Result<ContextReport, String> {
    {
        let cache = CACHE.lock().unwrap();
        if let Some(c) = cache.as_ref() {
            if c.root == root && now_ms().saturating_sub(c.at) < CACHE_TTL_MS {
                return Ok(c.report.clone());
            }
        }
    }
    let root_for_scan = root.clone();
    let report = tauri::async_runtime::spawn_blocking(move || build_report(root_for_scan))
        .await
        .map_err(|e| format!("context scan join: {}", e))?;
    *CACHE.lock().unwrap() = Some(Cached {
        at: now_ms(),
        root,
        report: report.clone(),
    });
    Ok(report)
}

fn settings_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or_else(|| "no home dir".to_string())?;
    Ok(home.join(".claude").join("settings.json"))
}

// Read the `skillOverrides` object from ~/.claude/settings.json into a
// name→value map. Missing file / key / malformed JSON → empty map (every
// skill defaults to "on").
fn read_skill_overrides() -> HashMap<String, String> {
    let mut map = HashMap::new();
    let path = match settings_path() {
        Ok(p) => p,
        Err(_) => return map,
    };
    let content = match fs::read_to_string(&path) {
        Ok(c) => c,
        Err(_) => return map,
    };
    let json: serde_json::Value = match serde_json::from_str(&content) {
        Ok(v) => v,
        Err(_) => return map,
    };
    if let Some(obj) = json.get("skillOverrides").and_then(|v| v.as_object()) {
        for (k, v) in obj {
            if let Some(s) = v.as_str() {
                map.insert(k.clone(), s.to_string());
            }
        }
    }
    map
}

const VALID_VISIBILITY: [&str; 4] = ["on", "name-only", "user-invocable-only", "off"];

/// Drop the report cache so the next `claude_context_assets` re-scans from
/// disk. Called by the frontend after it edits a project skill's frontmatter
/// (that write happens in TS via `setFrontmatterScalar`, so Rust can't know).
#[tauri::command]
pub fn claude_invalidate_context_cache() {
    *CACHE.lock().unwrap() = None;
}

/// Set (or clear) a skill's `skillOverrides` entry in ~/.claude/settings.json.
/// `"on"` removes the key so the file stays minimal. Preserves every other
/// setting (parse → mutate → pretty-write). Invalidates the report cache.
#[tauri::command]
pub fn claude_set_skill_override(name: String, value: String) -> Result<(), String> {
    if name.is_empty() {
        return Err("empty skill name".to_string());
    }
    if !VALID_VISIBILITY.contains(&value.as_str()) {
        return Err(format!("invalid visibility: {}", value));
    }
    let path = settings_path()?;
    let content = fs::read_to_string(&path).unwrap_or_else(|_| "{}".to_string());
    let mut json: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| format!("parse settings.json: {}", e))?;
    if !json.is_object() {
        json = serde_json::json!({});
    }
    let obj = json.as_object_mut().unwrap();
    let overrides = obj
        .entry("skillOverrides")
        .or_insert_with(|| serde_json::json!({}));
    let ov = overrides
        .as_object_mut()
        .ok_or_else(|| "skillOverrides is not an object".to_string())?;
    if value == "on" {
        ov.remove(&name); // "on" is the default — keep the file clean
    } else {
        ov.insert(name, serde_json::Value::String(value));
    }
    if ov.is_empty() {
        obj.remove("skillOverrides");
    }
    let pretty = serde_json::to_string_pretty(&json).map_err(|e| format!("serialize: {}", e))?;
    fs::write(&path, pretty).map_err(|e| format!("write settings.json: {}", e))?;
    *CACHE.lock().unwrap() = None; // next poll reflects the change
    Ok(())
}
