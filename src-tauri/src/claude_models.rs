// Claude Code model catalog for the composer picker — one fast `/model`
// probe for aliases; version labels (Sonnet 5, Opus 4.8…) cached in memory
// and refreshed in the background so the picker stays instant.

use crate::claude_code::claude_print_text;
use parking_lot::Mutex;
use serde::Serialize;
use std::collections::HashMap;
use std::sync::LazyLock;
use std::thread;
use std::time::{Duration, Instant};

#[derive(Serialize, Clone)]
pub struct ClaudeModelEntry {
    pub id: String,
    pub display_name: String,
    pub is_default: bool,
}

const PICKER_ORDER: &[&str] = &[
    "default",
    "sonnet",
    "opus",
    "haiku",
    "fable",
    "best",
    "sonnet[1m]",
    "opus[1m]",
    "fable[1m]",
    "opusplan",
];

const LABEL_CACHE_TTL: Duration = Duration::from_secs(3600);

static LABEL_CACHE: LazyLock<Mutex<Option<(Instant, HashMap<String, String>)>>> =
    LazyLock::new(|| Mutex::new(None));

#[tauri::command]
pub fn claude_code_list_models() -> Result<Vec<ClaudeModelEntry>, String> {
    let catalog = claude_print_text("/model")?;
    let available = parse_available_aliases(&catalog);
    let current = parse_current_model_short(&catalog);
    let labels = labels_for_aliases(&available);
    maybe_refresh_labels_async(available.clone());
    let mut out = Vec::new();
    push_default(&mut out, &available, current.as_deref());
    push_aliases(&mut out, &available, &labels);
    Ok(dedupe_display_names(out))
}

fn labels_for_aliases(available: &[String]) -> HashMap<String, String> {
    let cache = LABEL_CACHE.lock();
    if let Some((at, map)) = cache.as_ref() {
        if at.elapsed() < LABEL_CACHE_TTL {
            return available
                .iter()
                .map(|id| {
                    (
                        id.clone(),
                        map.get(id)
                            .cloned()
                            .unwrap_or_else(|| fallback_label(id)),
                    )
                })
                .collect();
        }
    }
    drop(cache);
    available
        .iter()
        .map(|id| (id.clone(), fallback_label(id)))
        .collect()
}

fn maybe_refresh_labels_async(available: Vec<String>) {
    let needs = {
        let cache = LABEL_CACHE.lock();
        match cache.as_ref() {
            None => true,
            Some((at, _)) => at.elapsed() >= LABEL_CACHE_TTL,
        }
    };
    if !needs {
        return;
    }
    thread::spawn(move || {
        let map = probe_alias_labels(&available);
        if map.is_empty() {
            return;
        }
        *LABEL_CACHE.lock() = Some((Instant::now(), map));
    });
}

fn push_default(out: &mut Vec<ClaudeModelEntry>, available: &[String], current: Option<&str>) {
    if !available.iter().any(|a| a == "default") && current.is_none() {
        return;
    }
    let name = current
        .map(|c| format!("Default · {c}"))
        .unwrap_or_else(|| "Default".to_string());
    out.push(ClaudeModelEntry {
        id: "default".to_string(),
        display_name: name,
        is_default: true,
    });
}

fn push_aliases(
    out: &mut Vec<ClaudeModelEntry>,
    available: &[String],
    labels: &HashMap<String, String>,
) {
    let mut seen = std::collections::HashSet::new();
    for id in PICKER_ORDER {
        if *id == "default" || !available.iter().any(|a| a == id) {
            continue;
        }
        if !seen.insert(*id) {
            continue;
        }
        out.push(entry_for(id, labels));
    }
    for id in available {
        if *id == "default" || PICKER_ORDER.contains(&id.as_str()) || !is_valid_alias(id) {
            continue;
        }
        if !seen.insert(id.as_str()) {
            continue;
        }
        out.push(entry_for(id, labels));
    }
}

fn entry_for(id: &str, labels: &HashMap<String, String>) -> ClaudeModelEntry {
    let probed = labels.get(id).map(|s| s.as_str());
    ClaudeModelEntry {
        id: id.to_string(),
        display_name: display_label(id, probed),
        is_default: false,
    }
}

fn display_label(id: &str, probed: Option<&str>) -> String {
    let base = probed
        .filter(|s| is_sane_probe_label(s))
        .map(|s| s.to_string())
        .unwrap_or_else(|| fallback_label(id));
    if id.ends_with("[1m]") {
        if base.contains("(1M") {
            return base;
        }
        return format!("{} (1M context)", short_model_label(&base));
    }
    base
}

fn is_sane_probe_label(label: &str) -> bool {
    let l = label.trim();
    !l.is_empty() && l.len() <= 36 && !l.to_ascii_lowercase().contains("plan mode")
}

fn dedupe_display_names(entries: Vec<ClaudeModelEntry>) -> Vec<ClaudeModelEntry> {
    let mut out = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for e in entries {
        if e.is_default {
            out.push(e);
            continue;
        }
        let key = e.display_name.to_ascii_lowercase();
        if seen.insert(key) {
            out.push(e);
        }
    }
    out
}

fn probe_alias_labels(available: &[String]) -> HashMap<String, String> {
    let ids: Vec<String> = available
        .iter()
        .filter(|a| *a != "default" && is_valid_alias(a))
        .cloned()
        .collect();
    let handles: Vec<_> = ids
        .into_iter()
        .map(|id| {
            thread::spawn(move || {
                let prompt = format!("/model {id}");
                let label = claude_print_text(&prompt)
                    .ok()
                    .and_then(|t| parse_probe_label(&t))
                    .filter(|s| is_sane_probe_label(s))
                    .unwrap_or_else(|| fallback_label(&id));
                (id, label)
            })
        })
        .collect();
    let mut map = HashMap::new();
    for h in handles {
        if let Ok((id, label)) = h.join() {
            map.insert(id, label);
        }
    }
    map
}

fn parse_available_aliases(text: &str) -> Vec<String> {
    for line in text.lines() {
        let line = line.trim();
        let Some(idx) = line.find("Available:") else {
            continue;
        };
        let mut rest = line[idx + "Available:".len()..].trim();
        if let Some(or_idx) = rest.to_lowercase().find(" or a full model id") {
            rest = rest[..or_idx].trim();
        }
        return rest
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty() && is_valid_alias(s))
            .collect();
    }
    vec![]
}

fn is_valid_alias(id: &str) -> bool {
    if matches!(id, "default" | "best" | "opusplan") {
        return true;
    }
    if id.ends_with("[1m]") {
        let base = id.trim_end_matches("[1m]");
        return matches!(base, "sonnet" | "opus" | "haiku" | "fable");
    }
    matches!(id, "sonnet" | "opus" | "haiku" | "fable")
}

fn parse_current_model_short(text: &str) -> Option<String> {
    for line in text.lines() {
        let Some(rest) = line.strip_prefix("Current model:") else {
            continue;
        };
        return Some(short_model_label(rest.trim()));
    }
    None
}

fn parse_probe_label(text: &str) -> Option<String> {
    for line in text.lines() {
        let Some(rest) = line.strip_prefix("Set model to ") else {
            continue;
        };
        if let Some(name) = rest.strip_suffix(" for this session only") {
            return Some(name.trim().to_string());
        }
    }
    None
}

fn short_model_label(raw: &str) -> String {
    let end = raw.find(" (").unwrap_or(raw.len());
    raw[..end].trim().to_string()
}

fn fallback_label(id: &str) -> String {
    if id.ends_with("[1m]") {
        let base = id.trim_end_matches("[1m]");
        return format!("{} (1M context)", title_alias(base));
    }
    title_alias(id)
}

fn title_alias(id: &str) -> String {
    match id {
        "sonnet" => "Sonnet".to_string(),
        "opus" => "Opus".to_string(),
        "haiku" => "Haiku".to_string(),
        "fable" => "Fable".to_string(),
        "best" => "Best".to_string(),
        "opusplan" => "Opus Plan".to_string(),
        "default" => "Default".to_string(),
        other => {
            let mut ch = other.chars();
            match ch.next() {
                None => String::new(),
                Some(f) => f.to_uppercase().collect::<String>() + ch.as_str(),
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_available_aliases_without_trailing_garbage() {
        let text = "Usage: /model <name>. Available: sonnet, opus, haiku, fable, default, or a full model ID.";
        let aliases = parse_available_aliases(text);
        assert!(aliases.contains(&"sonnet".to_string()));
        assert!(aliases.contains(&"default".to_string()));
        assert!(!aliases.iter().any(|a| a.contains("full model")));
    }

    #[test]
    fn rejects_junk_alias() {
        assert!(!is_valid_alias("or a full model ID."));
        assert!(is_valid_alias("sonnet[1m]"));
    }

    #[test]
    fn parses_probe_label() {
        let text = "Set model to Sonnet 5 for this session only\n";
        assert_eq!(parse_probe_label(text), Some("Sonnet 5".to_string()));
    }

    #[test]
    fn one_m_suffix_when_probe_omits_context() {
        assert_eq!(
            display_label("fable[1m]", Some("Fable 5")),
            "Fable 5 (1M context)"
        );
    }

    #[test]
    fn dedupes_same_display_name() {
        let rows = dedupe_display_names(vec![
            ClaudeModelEntry {
                id: "fable".into(),
                display_name: "Fable 5".into(),
                is_default: false,
            },
            ClaudeModelEntry {
                id: "best".into(),
                display_name: "Fable 5".into(),
                is_default: false,
            },
        ]);
        assert_eq!(rows.len(), 1);
    }
}
