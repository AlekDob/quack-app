use std::{env, path::PathBuf, process::Command};

use anyhow::{anyhow, Context, Result};
use serde::Serialize;

#[derive(Serialize, Clone)]
pub struct GitStatusEntry {
  pub path: String,
  pub original_path: Option<String>,
  pub staged_status: Option<String>,
  pub unstaged_status: Option<String>,
  pub is_untracked: bool,
  pub additions: Option<i32>,
  pub deletions: Option<i32>,
}

#[derive(Serialize, Clone)]
pub struct GitStatusSummary {
  pub branch: String,
  pub upstream: Option<String>,
  pub ahead: Option<i32>,
  pub behind: Option<i32>,
  pub entries: Vec<GitStatusEntry>,
  pub clean: bool,
}

#[derive(Serialize, Clone)]
pub struct GitCommitEntry {
  pub hash: String,
  pub summary: String,
  pub author: String,
  pub relative_time: String,
}

#[tauri::command]
pub fn git_status_summary(root_path: Option<String>) -> Result<GitStatusSummary, String> {
  git_status_summary_impl(root_path).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn git_diff(path: String, staged: Option<bool>, untracked: Option<bool>, root_path: Option<String>) -> Result<String, String> {
  git_diff_impl(path, staged.unwrap_or(false), untracked.unwrap_or(false), root_path).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn git_stage(path: String, root_path: Option<String>) -> Result<(), String> {
  git_stage_impl(path, root_path).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn git_unstage(path: String, root_path: Option<String>) -> Result<(), String> {
  git_unstage_impl(path, root_path).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn git_commit(message: String, root_path: Option<String>) -> Result<(), String> {
  git_commit_impl(message, root_path).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn git_commit_history(limit: Option<usize>, root_path: Option<String>) -> Result<Vec<GitCommitEntry>, String> {
  git_commit_history_impl(limit, root_path).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn git_repository_root(root_path: Option<String>) -> Result<String, String> {
  let starting_path = root_path.map(PathBuf::from);
  git_root(starting_path).map(|path| path.to_string_lossy().to_string()).map_err(|err| err.to_string())
}

fn git_status_summary_impl(root_path: Option<String>) -> Result<GitStatusSummary> {
  let starting_path = root_path.map(PathBuf::from);
  let root = git_root(starting_path)?;
  let output = run_git(&root, &["status", "--porcelain=1", "--branch"], false)?;
  let mut branch = String::from("sconosciuto");
  let mut upstream = None;
  let mut ahead = None;
  let mut behind = None;
  let mut entries = Vec::new();

  for line in output.lines() {
    if let Some(rest) = line.strip_prefix("## ") {
      let mut parts = rest.splitn(2, ' ');
      let head_part = parts.next().unwrap_or_default();
      if let Some(head_split) = head_part.split_once("...") {
        branch = head_split.0.to_string();
        if !head_split.1.is_empty() {
          upstream = Some(head_split.1.to_string());
        }
      } else {
        branch = head_part.to_string();
      }

      if let Some(meta) = parts.next() {
        let meta = meta.trim();
        if meta.starts_with('[') && meta.ends_with(']') {
          let inner = &meta[1..meta.len() - 1];
          for chunk in inner.split(',') {
            let chunk = chunk.trim();
            if let Some(value) = chunk.strip_prefix("ahead ") {
              if let Ok(num) = value.parse() {
                ahead = Some(num);
              }
            } else if let Some(value) = chunk.strip_prefix("behind ") {
              if let Ok(num) = value.parse() {
                behind = Some(num);
              }
            }
          }
        }
      }
      continue;
    }

    if line.starts_with("?? ") {
      let path = line[3..].to_string();
      entries.push(GitStatusEntry {
        path,
        original_path: None,
        staged_status: None,
        unstaged_status: Some(String::from("Untracked")),
        is_untracked: true,
        additions: None,
        deletions: None,
      });
      continue;
    }

    if line.len() < 4 {
      continue;
    }

    let mut chars = line.chars();
    let index_status = chars.next().unwrap_or(' ');
    let worktree_status = chars.next().unwrap_or(' ');
    // skip space separator
    let _ = chars.next();
    let path_part: String = chars.collect();

    let (path, original_path) = if let Some((from, to)) = path_part.split_once(" -> ") {
      (to.to_string(), Some(from.to_string()))
    } else {
      (path_part, None)
    };

    let staged_status = status_label(index_status);
    let unstaged_status = status_label(worktree_status);

      entries.push(GitStatusEntry {
      path,
      original_path,
      staged_status: staged_status.map(String::from),
      unstaged_status: unstaged_status.map(String::from),
      is_untracked: false,
        additions: None,
        deletions: None,
    });
  }

  let clean = entries.is_empty();

  for entry in entries.iter_mut() {
    if let Ok(Some(counts)) = compute_entry_counts(&root, entry) {
      entry.additions = counts.additions;
      entry.deletions = counts.deletions;
    }
  }

  Ok(GitStatusSummary {
    branch,
    upstream,
    ahead,
    behind,
    entries,
    clean,
  })
}

fn git_diff_impl(path: String, staged: bool, untracked: bool, root_path: Option<String>) -> Result<String> {
  let starting_path = root_path.map(PathBuf::from);
  let root = git_root(starting_path)?;
  let mut args = vec!["diff", "--no-color"]; // baseline args
  if staged {
    args.push("--cached");
  }
  args.push("--");
  args.push(&path);

  let mut diff = run_git(&root, &args, true)?;

  if diff.trim().is_empty() && untracked && !staged {
    // For untracked files git diff returns nothing; fallback to no-index diff
    let no_index_args = vec!["diff", "--no-index", "--no-color", "--", "/dev/null", &path];
    diff = run_git(&root, &no_index_args, true)?;
  }

  if diff.trim().is_empty() {
    Ok(String::from("Nessuna differenza da mostrare."))
  } else {
    Ok(diff)
  }
}

fn git_stage_impl(path: String, root_path: Option<String>) -> Result<()> {
  let starting_path = root_path.map(PathBuf::from);
  let root = git_root(starting_path)?;
  run_git(&root, &["add", "--", &path], false)?;
  Ok(())
}

fn git_unstage_impl(path: String, root_path: Option<String>) -> Result<()> {
  let starting_path = root_path.map(PathBuf::from);
  let root = git_root(starting_path)?;
  run_git(&root, &["reset", "HEAD", "--", &path], false)?;
  Ok(())
}

fn git_commit_impl(message: String, root_path: Option<String>) -> Result<()> {
  if message.trim().is_empty() {
    return Err(anyhow!("Il messaggio di commit non può essere vuoto."));
  }

  let starting_path = root_path.map(PathBuf::from);
  let root = git_root(starting_path)?;
  run_git(&root, &["commit", "-m", &message], false)?;
  Ok(())
}

fn git_commit_history_impl(limit: Option<usize>, root_path: Option<String>) -> Result<Vec<GitCommitEntry>> {
  let starting_path = root_path.map(PathBuf::from);
  let root = git_root(starting_path)?;
  let limit = limit.unwrap_or(50).min(200);
  let pretty = "--pretty=format:%H%x1f%an%x1f%ad%x1f%s";
  let limit_arg = format!("-n{limit}");
  let args = ["log", "--date=relative", pretty, limit_arg.as_str()];
  let output = run_git(&root, &args, false)?;

  let mut entries = Vec::new();
  for line in output.lines() {
    if line.trim().is_empty() {
      continue;
    }
    let mut parts = line.split('\x1f');
    let hash = parts.next().unwrap_or_default().to_string();
    let author = parts.next().unwrap_or_default().to_string();
    let relative_time = parts.next().unwrap_or_default().to_string();
    let summary = parts.next().unwrap_or_default().to_string();
    entries.push(GitCommitEntry {
      hash,
      author,
      relative_time,
      summary,
    });
  }

  Ok(entries)
}

#[derive(Clone, Default)]
struct DiffCounts {
  additions: Option<i32>,
  deletions: Option<i32>,
}

impl DiffCounts {
  fn merge(&mut self, other: DiffCounts) {
    self.additions = merge_counts(self.additions, other.additions);
    self.deletions = merge_counts(self.deletions, other.deletions);
  }

  fn has_values(&self) -> bool {
    self.additions.is_some() || self.deletions.is_some()
  }
}

fn merge_counts(current: Option<i32>, incoming: Option<i32>) -> Option<i32> {
  match (current, incoming) {
    (_, None) => None,
    (None, Some(value)) => Some(value),
    (Some(existing), Some(value)) => Some(existing + value),
  }
}

fn compute_entry_counts(root: &PathBuf, entry: &GitStatusEntry) -> Result<Option<DiffCounts>> {
  if entry.is_untracked {
    return diff_numstat_untracked(root, &entry.path);
  }

  let mut combined = DiffCounts::default();
  let mut has_any = false;

  if let Some(counts) = diff_numstat_for_path(root, &entry.path, false)? {
    combined.merge(counts);
    has_any = true;
  }

  if entry.staged_status.is_some() {
    if let Some(counts) = diff_numstat_for_path(root, &entry.path, true)? {
      combined.merge(counts);
      has_any = true;
    }
  }

  if has_any && combined.has_values() {
    Ok(Some(combined))
  } else {
    Ok(None)
  }
}

fn diff_numstat_for_path(root: &PathBuf, path: &str, staged: bool) -> Result<Option<DiffCounts>> {
  let mut args = vec!["diff", "--numstat", "--no-color"];
  if staged {
    args.push("--cached");
  }
  args.push("--");
  args.push(path);

  let output = run_git(root, &args, true)?;
  Ok(parse_numstat_output(&output))
}

fn diff_numstat_untracked(root: &PathBuf, path: &str) -> Result<Option<DiffCounts>> {
  let args = [
    "diff",
    "--numstat",
    "--no-color",
    "--no-index",
    "--",
    "/dev/null",
    path,
  ];
  let output = run_git(root, &args, true)?;
  Ok(parse_numstat_output(&output))
}

fn parse_numstat_output(output: &str) -> Option<DiffCounts> {
  let mut counts = DiffCounts::default();
  let mut found = false;

  for line in output.lines() {
    let trimmed = line.trim();
    if trimmed.is_empty() {
      continue;
    }
    if let Some((additions, deletions)) = parse_numstat_line(trimmed) {
      counts.additions = merge_counts(counts.additions, additions);
      counts.deletions = merge_counts(counts.deletions, deletions);
      found = true;
    }
  }

  if found {
    Some(counts)
  } else {
    None
  }
}

fn parse_numstat_line(line: &str) -> Option<(Option<i32>, Option<i32>)> {
  let parts: Vec<&str> = line.splitn(3, '\t').collect();
  if parts.len() < 3 {
    return None;
  }
  let additions = parse_numstat_value(parts[0]);
  let deletions = parse_numstat_value(parts[1]);
  Some((additions, deletions))
}

fn parse_numstat_value(value: &str) -> Option<i32> {
  if value == "-" {
    None
  } else {
    value.parse::<i32>().ok()
  }
}

fn git_root(starting_path: Option<PathBuf>) -> Result<PathBuf> {
  let mut dir = if let Some(path) = starting_path {
    path
  } else {
    env::current_dir().context("Impossibile determinare la directory corrente")?
  };

  loop {
    if dir.join(".git").exists() {
      return Ok(dir);
    }
    if !dir.pop() {
      break;
    }
  }
  Err(anyhow!("Impossibile trovare la directory .git"))
}

fn run_git(root: &PathBuf, args: &[&str], allow_non_zero: bool) -> Result<String> {
  let output = Command::new("git")
    .current_dir(root)
    .args(args)
    .output()
    .with_context(|| format!("Impossibile eseguire git {:?}", args))?;

  if !output.status.success() && !(allow_non_zero && output.status.code().unwrap_or_default() == 1) {
    let stderr = String::from_utf8_lossy(&output.stderr);
    let message = stderr.trim();
    if message.is_empty() {
      return Err(anyhow!("Comando git fallito"));
    }
    return Err(anyhow!(message.to_string()));
  }

  Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

fn status_label(code: char) -> Option<&'static str> {
  match code {
    'M' => Some("Modified"),
    'A' => Some("Added"),
    'D' => Some("Deleted"),
    'R' => Some("Renamed"),
    'C' => Some("Copied"),
    'U' => Some("Updated"),
    'T' => Some("Type changed"),
    '!' => Some("Ignored"),
    _ => None,
  }
}
