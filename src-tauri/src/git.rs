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
    pub timestamp: Option<i64>,
}

#[tauri::command]
pub fn git_status_summary(root_path: Option<String>) -> Result<GitStatusSummary, String> {
    git_status_summary_impl(root_path).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn git_diff(
    path: String,
    staged: Option<bool>,
    untracked: Option<bool>,
    root_path: Option<String>,
) -> Result<String, String> {
    git_diff_impl(
        path,
        staged.unwrap_or(false),
        untracked.unwrap_or(false),
        root_path,
    )
    .map_err(|err| err.to_string())
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
pub fn git_stage_all(root_path: Option<String>) -> Result<(), String> {
    git_stage_all_impl(root_path).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn git_commit(message: String, root_path: Option<String>) -> Result<(), String> {
    git_commit_impl(message, root_path).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn git_commit_history(
    limit: Option<usize>,
    branch_name: Option<String>,
    root_path: Option<String>,
) -> Result<Vec<GitCommitEntry>, String> {
    git_commit_history_impl(limit, branch_name, root_path).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn git_repository_root(root_path: Option<String>) -> Result<String, String> {
    let starting_path = root_path.map(PathBuf::from);
    git_root(starting_path)
        .map(|path| path.to_string_lossy().to_string())
        .map_err(|err| err.to_string())
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
                unstaged_status: Some(String::from("U")),
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

fn git_diff_impl(
    path: String,
    staged: bool,
    untracked: bool,
    root_path: Option<String>,
) -> Result<String> {
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
        // Return empty string so frontend can handle the "no diff" case properly
        // This allows the frontend to show appropriate messages or close the drawer
        Ok(String::new())
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

fn git_stage_all_impl(root_path: Option<String>) -> Result<()> {
    let starting_path = root_path.map(PathBuf::from);
    let root = git_root(starting_path)?;
    run_git(&root, &["add", "-A"], false)?;
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

fn git_commit_history_impl(
    limit: Option<usize>,
    branch_name: Option<String>,
    root_path: Option<String>,
) -> Result<Vec<GitCommitEntry>> {
    let starting_path = root_path.map(PathBuf::from);
    let root = git_root(starting_path)?;
    let limit = limit.unwrap_or(50).min(200);
    let pretty = "--pretty=format:%H%x1f%an%x1f%ad%x1f%at%x1f%s";
    let limit_arg = format!("-n{limit}");

    // Build args with optional branch name
    let mut args = vec!["log", "--date=relative", pretty, limit_arg.as_str()];
    let branch_str: String;
    if let Some(ref branch) = branch_name {
        branch_str = branch.clone();
        args.push(&branch_str);
    }

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
        let timestamp_str = parts.next().unwrap_or_default();
        let timestamp = timestamp_str.parse::<i64>().ok();
        let summary = parts.next().unwrap_or_default().to_string();
        entries.push(GitCommitEntry {
            hash,
            author,
            relative_time,
            timestamp,
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

pub(crate) fn git_root(starting_path: Option<PathBuf>) -> Result<PathBuf> {
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

#[tauri::command]
pub fn is_git_repository(path: String) -> bool {
    let dir = PathBuf::from(path);
    let mut current = dir.as_path();

    loop {
        if current.join(".git").exists() {
            return true;
        }
        match current.parent() {
            Some(parent) => current = parent,
            None => return false,
        }
    }
}

#[tauri::command]
pub fn git_init(path: String) -> Result<String, String> {
    let dir = PathBuf::from(&path);

    // Verify directory exists
    if !dir.exists() {
        return Err("Directory does not exist".to_string());
    }

    // Initialize git repository
    let mut cmd = Command::new("git");
    cmd.current_dir(&dir).args(&["init"]);

    // Windows: Hide console window
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let output = cmd.output()
        .map_err(|e| format!("Failed to run git init: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git init failed: {}", stderr));
    }

    // Create an initial commit to establish the main branch
    // First, check if there's a .gitignore or any files to commit
    let mut add_cmd = Command::new("git");
    add_cmd.current_dir(&dir).args(&["add", "-A"]);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        add_cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let add_output = add_cmd.output()
        .map_err(|e| format!("Failed to stage files: {}", e))?;

    // Create initial commit (allow empty if no files exist)
    let mut commit_cmd = Command::new("git");
    commit_cmd.current_dir(&dir).args(&["commit", "--allow-empty", "-m", "Initial commit"]);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        commit_cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let commit_output = commit_cmd.output()
        .map_err(|e| format!("Failed to create initial commit: {}", e))?;

    if !commit_output.status.success() {
        let stderr = String::from_utf8_lossy(&commit_output.stderr);
        return Err(format!("Failed to create initial commit: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(format!("Git repository initialized at: {}\nCreated initial commit on main branch", path))
}

fn run_git(root: &PathBuf, args: &[&str], allow_non_zero: bool) -> Result<String> {
    let mut cmd = Command::new("git");
    cmd.current_dir(root).args(args);

    // Windows: Hide console window
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let output = cmd.output()
        .with_context(|| format!("Impossibile eseguire git {:?}", args))?;

    if !output.status.success()
        && !(allow_non_zero && output.status.code().unwrap_or_default() == 1)
    {
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
        'M' => Some("M"),
        'A' => Some("A"),
        'D' => Some("D"),
        'R' => Some("R"),
        'C' => Some("C"),
        'U' => Some("U"),
        'T' => Some("T"),
        '!' => Some("!"),
        _ => None,
    }
}

#[tauri::command]
pub fn git_current_branch(root_path: Option<String>) -> Result<String, String> {
    git_current_branch_impl(root_path).map_err(|err| err.to_string())
}

fn git_current_branch_impl(root_path: Option<String>) -> Result<String> {
    let starting_path = root_path.map(PathBuf::from);
    let root = git_root(starting_path)?;
    let output = run_git(&root, &["branch", "--show-current"], false)?;
    Ok(output.trim().to_string())
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitBranch {
    pub name: String,
    pub is_current: bool,
    pub has_remote: bool,
    pub upstream: Option<String>,
    pub behind: Option<i32>,
}

#[tauri::command]
pub fn git_list_branches(root_path: Option<String>) -> Result<Vec<GitBranch>, String> {
    git_list_branches_impl(root_path).map_err(|err| err.to_string())
}

fn git_list_branches_impl(root_path: Option<String>) -> Result<Vec<GitBranch>> {
    let starting_path = root_path.map(PathBuf::from);
    let root = git_root(starting_path)?;

    // Get all local branches with tracking info
    let output = run_git(&root, &["branch", "-vv"], false)?;
    let mut branches = Vec::new();

    for line in output.lines() {
        if line.is_empty() {
            continue;
        }

        // Check if this is the current branch (starts with '* ')
        let is_current = line.starts_with('*');

        // Check if this branch has a worktree (starts with '+ ')
        let has_worktree = line.starts_with('+');

        // FIX: Correctly handle branch name extraction
        // Output format: "* main     abc123 [origin/main] message" for current branch
        //                "+ feat/xyz abc123 [origin/feat/xyz] message" for worktree branches
        //                "  feat/xyz abc123 [origin/feat/xyz] message" for other branches
        // The prefix is always 2 characters: "* " for current, "+ " for worktree, "  " for others
        let line = if is_current || has_worktree {
            &line[2..] // Remove "* " or "+ " prefix
        } else {
            line.trim_start() // Remove leading spaces for normal branches
        };

        // Parse branch name (first word)
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.is_empty() {
            continue;
        }

        let name = parts[0].to_string();

        // Check if branch has remote tracking (contains [origin/...])
        let has_remote = line.contains('[') && line.contains("origin/");
        let upstream = if has_remote {
            // Extract upstream branch name from [origin/branch-name...]
            if let Some(start) = line.find('[') {
                if let Some(end) = line[start..].find(']') {
                    let tracking = &line[start+1..start+end];
                    // Remove : ahead/behind info if present
                    let upstream_name = tracking.split(':').next().unwrap_or(tracking);
                    Some(upstream_name.trim().to_string())
                } else {
                    None
                }
            } else {
                None
            }
        } else {
            None
        };

        // Calculate behind count if there's an upstream
        let behind = if let Some(ref upstream_ref) = upstream {
            // Use git rev-list to count commits: local..remote
            let count_args = ["rev-list", "--count", &format!("{}..{}", name, upstream_ref)];
            if let Ok(count_output) = run_git(&root, &count_args, true) {
                count_output.trim().parse::<i32>().ok()
            } else {
                None
            }
        } else {
            None
        };

        branches.push(GitBranch {
            name,
            is_current,
            has_remote,
            upstream,
            behind,
        });
    }

    Ok(branches)
}

#[tauri::command]
pub fn git_create_branch(
    branch_name: String,
    from_branch: Option<String>,
    switch: Option<bool>,
    root_path: Option<String>,
) -> Result<(), String> {
    git_create_branch_impl(branch_name, from_branch, switch, root_path)
        .map_err(|err| err.to_string())
}

fn git_create_branch_impl(
    branch_name: String,
    from_branch: Option<String>,
    switch: Option<bool>,
    root_path: Option<String>,
) -> Result<()> {
    // Validate branch name
    if branch_name.trim().is_empty() {
        return Err(anyhow!("Branch name cannot be empty"));
    }

    // Check for invalid characters
    let invalid_chars = ['~', '^', ':', '?', '*', '[', '\\', ' ', '\t'];
    if branch_name.chars().any(|c| invalid_chars.contains(&c)) {
        return Err(anyhow!("Branch name contains invalid characters"));
    }

    let starting_path = root_path.map(PathBuf::from);
    let root = git_root(starting_path)?;

    // Create branch (optionally from specific branch)
    let mut args = vec!["branch", &branch_name];
    if let Some(from) = from_branch.as_ref() {
        args.push(from);
    }

    run_git(&root, &args, false)?;

    // Switch to new branch if requested
    if switch.unwrap_or(false) {
        run_git(&root, &["checkout", &branch_name], false)?;
    }

    Ok(())
}

#[tauri::command]
pub fn git_switch_branch(
    branch_name: String,
    root_path: Option<String>,
) -> Result<(), String> {
    git_switch_branch_impl(branch_name, root_path).map_err(|err| err.to_string())
}

fn git_switch_branch_impl(branch_name: String, root_path: Option<String>) -> Result<()> {
    if branch_name.trim().is_empty() {
        return Err(anyhow!("Branch name cannot be empty"));
    }

    let starting_path = root_path.map(PathBuf::from);
    let root = git_root(starting_path)?;

    // Switch branch using checkout
    run_git(&root, &["checkout", &branch_name], false)?;

    Ok(())
}

#[derive(Serialize, Clone)]
pub struct GitMergeResult {
    pub success: bool,
    pub has_conflicts: bool,
    pub conflicted_files: Vec<String>,
    pub message: String,
}

#[tauri::command]
pub fn git_merge_branch(
    branch_name: String,
    root_path: Option<String>,
) -> Result<GitMergeResult, String> {
    git_merge_branch_impl(branch_name, root_path).map_err(|err| err.to_string())
}

fn git_merge_branch_impl(branch_name: String, root_path: Option<String>) -> Result<GitMergeResult> {
    if branch_name.trim().is_empty() {
        return Err(anyhow!("Branch name cannot be empty"));
    }

    let starting_path = root_path.map(PathBuf::from);
    let root = git_root(starting_path)?;

    // Attempt merge
    let output = run_git(&root, &["merge", &branch_name, "--no-edit"], true)?;

    // Check if there are conflicts
    let status_output = run_git(&root, &["status", "--porcelain"], false)?;
    let has_conflicts = status_output.lines().any(|line| {
        line.starts_with("UU ") || line.starts_with("AA ") ||
        line.starts_with("DD ") || line.starts_with("AU ") ||
        line.starts_with("UA ") || line.starts_with("DU ") ||
        line.starts_with("UD ")
    });

    let conflicted_files: Vec<String> = if has_conflicts {
        status_output
            .lines()
            .filter(|line| {
                line.starts_with("UU ") || line.starts_with("AA ") ||
                line.starts_with("DD ") || line.starts_with("AU ") ||
                line.starts_with("UA ") || line.starts_with("DU ") ||
                line.starts_with("UD ")
            })
            .map(|line| line[3..].to_string())
            .collect()
    } else {
        Vec::new()
    };

    let conflicted_count = conflicted_files.len();

    Ok(GitMergeResult {
        success: !has_conflicts,
        has_conflicts,
        conflicted_files,
        message: if has_conflicts {
            format!("Merge has conflicts in {} files", conflicted_count)
        } else {
            output.trim().to_string()
        },
    })
}

#[tauri::command]
pub fn git_abort_merge(root_path: Option<String>) -> Result<(), String> {
    git_abort_merge_impl(root_path).map_err(|err| err.to_string())
}

fn git_abort_merge_impl(root_path: Option<String>) -> Result<()> {
    let starting_path = root_path.map(PathBuf::from);
    let root = git_root(starting_path)?;

    run_git(&root, &["merge", "--abort"], false)?;

    Ok(())
}

#[tauri::command]
pub fn git_resolve_conflict(
    file_path: String,
    strategy: String,
    root_path: Option<String>,
) -> Result<(), String> {
    git_resolve_conflict_impl(file_path, strategy, root_path).map_err(|err| err.to_string())
}

fn git_resolve_conflict_impl(
    file_path: String,
    strategy: String,
    root_path: Option<String>,
) -> Result<()> {
    let starting_path = root_path.map(PathBuf::from);
    let root = git_root(starting_path)?;

    let strategy_arg = match strategy.as_str() {
        "ours" => "--ours",
        "theirs" => "--theirs",
        _ => return Err(anyhow!("Invalid strategy. Use 'ours' or 'theirs'")),
    };

    // Checkout the file with the specified strategy
    run_git(&root, &["checkout", strategy_arg, "--", &file_path], false)?;

    // Add the resolved file to staging
    run_git(&root, &["add", "--", &file_path], false)?;

    Ok(())
}

#[tauri::command]
pub fn git_delete_branch(
    branch_name: String,
    force: Option<bool>,
    root_path: Option<String>,
) -> Result<(), String> {
    git_delete_branch_impl(branch_name, force, root_path).map_err(|err| err.to_string())
}

fn git_delete_branch_impl(
    branch_name: String,
    force: Option<bool>,
    root_path: Option<String>,
) -> Result<()> {
    if branch_name.trim().is_empty() {
        return Err(anyhow!("Branch name cannot be empty"));
    }

    // Safety check: prevent deleting main/master branches
    if branch_name == "main" || branch_name == "master" {
        return Err(anyhow!("Cannot delete main or master branch"));
    }

    let starting_path = root_path.map(PathBuf::from);
    let root = git_root(starting_path)?;

    // Check if it's the current branch
    let current_branch = run_git(&root, &["branch", "--show-current"], false)?;
    if current_branch.trim() == branch_name {
        return Err(anyhow!("Cannot delete the current branch. Switch to another branch first."));
    }

    // Delete branch (force or regular)
    let flag = if force.unwrap_or(false) { "-D" } else { "-d" };
    run_git(&root, &["branch", flag, &branch_name], false)?;

    Ok(())
}

// ==================== GIT STASH ====================

#[tauri::command]
pub fn git_stash_push(
    message: Option<String>,
    root_path: Option<String>,
) -> Result<(), String> {
    git_stash_push_impl(message, root_path).map_err(|err| err.to_string())
}

fn git_stash_push_impl(message: Option<String>, root_path: Option<String>) -> Result<()> {
    let starting_path = root_path.map(PathBuf::from);
    let root = git_root(starting_path)?;

    let mut args = vec!["stash", "push"];
    if let Some(msg) = &message {
        args.push("-m");
        args.push(msg.as_str());
    }

    run_git(&root, &args, false)?;
    Ok(())
}

#[tauri::command]
pub fn git_stash_pop(root_path: Option<String>) -> Result<(), String> {
    git_stash_pop_impl(root_path).map_err(|err| err.to_string())
}

fn git_stash_pop_impl(root_path: Option<String>) -> Result<()> {
    let starting_path = root_path.map(PathBuf::from);
    let root = git_root(starting_path)?;

    run_git(&root, &["stash", "pop"], false)?;
    Ok(())
}

#[derive(Serialize, Clone)]
pub struct GitConflictFile {
    pub path: String,
    pub status: String,
}

#[tauri::command]
pub fn git_get_conflicts(root_path: Option<String>) -> Result<Vec<GitConflictFile>, String> {
    git_get_conflicts_impl(root_path).map_err(|err| err.to_string())
}

fn git_get_conflicts_impl(root_path: Option<String>) -> Result<Vec<GitConflictFile>> {
    let starting_path = root_path.map(PathBuf::from);
    let root = git_root(starting_path)?;

    let status_output = run_git(&root, &["status", "--porcelain"], false)?;

    let conflicts: Vec<GitConflictFile> = status_output
        .lines()
        .filter_map(|line| {
            let status_code = &line[0..2];
            if status_code.contains('U') || status_code == "AA" || status_code == "DD" {
                Some(GitConflictFile {
                    path: line[3..].to_string(),
                    status: conflict_status_label(status_code).to_string(),
                })
            } else {
                None
            }
        })
        .collect();

    Ok(conflicts)
}

fn conflict_status_label(code: &str) -> &'static str {
    match code {
        "UU" => "Both modified",
        "AA" => "Both added",
        "DD" => "Both deleted",
        "AU" | "UA" => "Added by one, modified by other",
        "DU" | "UD" => "Deleted by one, modified by other",
        _ => "Conflict",
    }
}

#[tauri::command]
pub fn git_push(
    branch_name: Option<String>,
    force: Option<bool>,
    root_path: Option<String>,
) -> Result<String, String> {
    git_push_impl(branch_name, force, root_path).map_err(|err| err.to_string())
}

fn git_push_impl(
    branch_name: Option<String>,
    force: Option<bool>,
    root_path: Option<String>,
) -> Result<String> {
    let starting_path = root_path.map(PathBuf::from);
    let root = git_root(starting_path)?;

    // Get current branch if not specified
    let branch = if let Some(name) = branch_name {
        name
    } else {
        let output = run_git(&root, &["branch", "--show-current"], false)?;
        output.trim().to_string()
    };

    if branch.is_empty() {
        return Err(anyhow!("No branch specified and cannot determine current branch"));
    }

    // Build push command
    let mut args = vec!["push", "origin", &branch];
    if force.unwrap_or(false) {
        args.insert(1, "--force");
    }

    // Execute push
    let output = run_git(&root, &args, false)?;

    Ok(format!("Successfully pushed {} to origin", branch))
}

#[derive(Serialize, Clone)]
pub struct GitPullResult {
    pub success: bool,
    pub has_conflicts: bool,
    pub conflicted_files: Vec<String>,
    pub message: String,
    pub is_fast_forward: bool,
}

#[tauri::command]
pub fn git_pull(
    branch_name: Option<String>,
    root_path: Option<String>,
) -> Result<GitPullResult, String> {
    git_pull_impl(branch_name, root_path).map_err(|err| err.to_string())
}

fn git_pull_impl(
    branch_name: Option<String>,
    root_path: Option<String>,
) -> Result<GitPullResult> {
    let starting_path = root_path.map(PathBuf::from);
    let root = git_root(starting_path)?;

    // Get current branch if not specified
    let branch = if let Some(name) = branch_name {
        name
    } else {
        let output = run_git(&root, &["branch", "--show-current"], false)?;
        output.trim().to_string()
    };

    if branch.is_empty() {
        return Err(anyhow!("No branch specified and cannot determine current branch"));
    }

    // First, fetch from origin to get latest changes
    let _fetch_output = run_git(&root, &["fetch", "origin"], false)?;

    // Execute pull with merge strategy (not rebase)
    let output = run_git(&root, &["pull", "origin", &branch, "--no-rebase"], true)?;
    let output_lower = output.to_lowercase();

    // Check if it's a fast-forward merge
    let is_fast_forward = output_lower.contains("fast-forward");

    // Check for conflicts
    let status_output = run_git(&root, &["status", "--porcelain"], false)?;
    let has_conflicts = status_output.lines().any(|line| {
        line.starts_with("UU ") || line.starts_with("AA ") ||
        line.starts_with("DD ") || line.starts_with("AU ") ||
        line.starts_with("UA ") || line.starts_with("DU ") ||
        line.starts_with("UD ")
    });

    let conflicted_files = if has_conflicts {
        status_output
            .lines()
            .filter(|line| {
                line.starts_with("UU ") || line.starts_with("AA ") ||
                line.starts_with("DD ") || line.starts_with("AU ") ||
                line.starts_with("UA ") || line.starts_with("DU ") ||
                line.starts_with("UD ")
            })
            .map(|line| line[3..].to_string())
            .collect()
    } else {
        Vec::new()
    };

    let conflicted_count = conflicted_files.len();

    Ok(GitPullResult {
        success: !has_conflicts,
        has_conflicts,
        conflicted_files,
        is_fast_forward,
        message: if has_conflicts {
            format!("Pull has conflicts in {} files", conflicted_count)
        } else if is_fast_forward {
            "Pull completed (fast-forward)".to_string()
        } else {
            "Pull completed successfully".to_string()
        },
    })
}

// ============================================================================
// Git Worktree Support
// ============================================================================

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitWorktree {
    pub path: String,
    pub branch: String,
    pub commit_hash: String,
    pub is_bare: bool,
    pub is_detached: bool,
}

#[tauri::command]
pub fn git_list_worktrees(root_path: Option<String>) -> Result<Vec<GitWorktree>, String> {
    git_list_worktrees_impl(root_path).map_err(|err| err.to_string())
}

fn git_list_worktrees_impl(root_path: Option<String>) -> Result<Vec<GitWorktree>> {
    let starting_path = root_path.map(PathBuf::from);
    let root = git_root(starting_path)?;

    // List all worktrees with porcelain format for easier parsing
    let output = run_git(&root, &["worktree", "list", "--porcelain"], false)?;

    let mut worktrees = Vec::new();
    let mut current_worktree: Option<GitWorktree> = None;

    for line in output.lines() {
        if line.starts_with("worktree ") {
            // Save previous worktree if exists
            if let Some(wt) = current_worktree.take() {
                worktrees.push(wt);
            }

            // Start new worktree
            let path = line.strip_prefix("worktree ").unwrap_or_default().to_string();
            current_worktree = Some(GitWorktree {
                path,
                branch: String::new(),
                commit_hash: String::new(),
                is_bare: false,
                is_detached: false,
            });
        } else if line.starts_with("HEAD ") {
            if let Some(ref mut wt) = current_worktree {
                wt.commit_hash = line.strip_prefix("HEAD ").unwrap_or_default().to_string();
            }
        } else if line.starts_with("branch ") {
            if let Some(ref mut wt) = current_worktree {
                wt.branch = line.strip_prefix("branch ").unwrap_or_default()
                    .trim_start_matches("refs/heads/")
                    .to_string();
            }
        } else if line == "bare" {
            if let Some(ref mut wt) = current_worktree {
                wt.is_bare = true;
            }
        } else if line == "detached" {
            if let Some(ref mut wt) = current_worktree {
                wt.is_detached = true;
            }
        }
    }

    // Don't forget the last worktree
    if let Some(wt) = current_worktree {
        worktrees.push(wt);
    }

    Ok(worktrees)
}

#[tauri::command]
pub fn git_add_worktree(
    path: String,
    branch_name: String,
    create_branch: Option<bool>,
    root_path: Option<String>,
) -> Result<String, String> {
    git_add_worktree_impl(path, branch_name, create_branch, root_path)
        .map_err(|err| err.to_string())
}

fn git_add_worktree_impl(
    path: String,
    branch_name: String,
    create_branch: Option<bool>,
    root_path: Option<String>,
) -> Result<String> {
    if path.trim().is_empty() {
        return Err(anyhow!("Worktree path cannot be empty"));
    }

    if branch_name.trim().is_empty() {
        return Err(anyhow!("Branch name cannot be empty"));
    }

    let starting_path = root_path.map(PathBuf::from);
    let root = git_root(starting_path)?;

    // Build worktree add command
    let mut args = vec!["worktree", "add"];

    // Add -b flag if creating new branch
    if create_branch.unwrap_or(false) {
        args.push("-b");
        args.push(&branch_name);
    }

    args.push(&path);

    // If not creating new branch, add branch name to checkout
    if !create_branch.unwrap_or(false) {
        args.push(&branch_name);
    }

    // Execute worktree add
    let output = run_git(&root, &args, false)?;

    Ok(format!("Worktree created at: {}", path))
}

#[tauri::command]
pub fn git_remove_worktree(
    path: String,
    force: Option<bool>,
    root_path: Option<String>,
) -> Result<(), String> {
    git_remove_worktree_impl(path, force, root_path).map_err(|err| err.to_string())
}

fn git_remove_worktree_impl(
    path: String,
    force: Option<bool>,
    root_path: Option<String>,
) -> Result<()> {
    if path.trim().is_empty() {
        return Err(anyhow!("Worktree path cannot be empty"));
    }

    let starting_path = root_path.map(PathBuf::from);
    let root = git_root(starting_path)?;

    // Build worktree remove command
    let mut args = vec!["worktree", "remove"];

    if force.unwrap_or(false) {
        args.push("--force");
    }

    args.push(&path);

    // Execute worktree remove
    run_git(&root, &args, false)?;

    Ok(())
}

#[tauri::command]
pub fn git_has_uncommitted_changes(root_path: Option<String>) -> Result<bool, String> {
    git_has_uncommitted_changes_impl(root_path).map_err(|err| err.to_string())
}

fn git_has_uncommitted_changes_impl(root_path: Option<String>) -> Result<bool> {
    let starting_path = root_path.map(PathBuf::from);
    let root = git_root(starting_path)?;

    // Check git status
    let output = run_git(&root, &["status", "--porcelain"], false)?;

    // If output is not empty, there are uncommitted changes
    Ok(!output.trim().is_empty())
}

#[tauri::command]
pub fn git_get_remote_url(root_path: Option<String>) -> Result<String, String> {
    git_get_remote_url_impl(root_path).map_err(|err| err.to_string())
}

fn git_get_remote_url_impl(root_path: Option<String>) -> Result<String> {
    let starting_path = root_path.map(PathBuf::from);
    let root = git_root(starting_path)?;

    // Get remote URL for origin
    let output = run_git(&root, &["config", "--get", "remote.origin.url"], false)?;

    Ok(output.trim().to_string())
}

#[tauri::command]
pub fn git_uncommitted_files_count(root_path: Option<String>) -> Result<usize, String> {
    git_uncommitted_files_count_impl(root_path).map_err(|err| err.to_string())
}

fn git_uncommitted_files_count_impl(root_path: Option<String>) -> Result<usize> {
    let starting_path = root_path.map(PathBuf::from);
    let root = git_root(starting_path)?;

    // Use git status --short to get a clean list of modified files
    // This counts each file once, even if it has multiple statuses (staged + modified)
    let output = run_git(&root, &["status", "--short"], false)?;

    // Count non-empty lines (each line = one modified file)
    let count = output
        .lines()
        .filter(|line| !line.trim().is_empty())
        .count();

    Ok(count)
}
