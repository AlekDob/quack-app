use serde::Serialize;
use std::path::Path;
use std::process::Command;

fn run_git(cwd: &str, args: &[&str]) -> Result<String, String> {
    let mut cmd = Command::new("git");
    cmd.args(args).current_dir(cwd);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        // CREATE_NO_WINDOW = 0x08000000 — don't pop a console for `git`.
        cmd.creation_flags(0x08000000);
    }
    let out = cmd.output().map_err(|e| e.to_string())?;
    let stdout = String::from_utf8_lossy(&out.stdout).into_owned();
    let stderr = String::from_utf8_lossy(&out.stderr).into_owned();
    if !out.status.success() {
        let mut msg = stderr.trim().to_string();
        if msg.is_empty() {
            msg = stdout.trim().to_string();
        }
        if msg.is_empty() {
            msg = format!("git {} failed", args.join(" "));
        }
        return Err(msg);
    }
    if stdout.is_empty() && !stderr.is_empty() {
        Ok(stderr)
    } else {
        Ok(stdout)
    }
}

// Every command in this file shells out to `git`, and Tauri dispatches
// non-async commands on the MAIN thread — so a slow `git push` (or even
// the ~50ms of process spawn on Windows) used to freeze the entire UI.
// All commands below are async wrappers that run their blocking body on
// the spawn_blocking pool, same pattern as scan_todos in search.rs.
async fn off_thread<T: Send + 'static>(
    f: impl FnOnce() -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(f)
        .await
        .map_err(|e| e.to_string())?
}

fn is_repo(path: &str) -> bool {
    if !Path::new(path).exists() {
        return false;
    }
    run_git(path, &["rev-parse", "--is-inside-work-tree"]).is_ok()
}

#[derive(Serialize)]
pub struct GitFile {
    pub path: String,
    pub index_status: String,
    pub worktree_status: String,
    pub staged: bool,
    pub modified: bool,
    /// True for merge-conflict XY pairs (UU, AA, AU, …). These files
    /// look "staged" in porcelain terms but presenting them as staged
    /// work (with an Unstage button) mid-merge is misleading — the UI
    /// gives them their own section.
    pub conflicted: bool,
}

#[derive(Serialize)]
pub struct GitStatus {
    pub is_repo: bool,
    pub branch: Option<String>,
    pub upstream: Option<String>,
    pub ahead: u32,
    pub behind: u32,
    pub files: Vec<GitFile>,
}

#[tauri::command]
pub async fn git_is_repo(path: String) -> bool {
    tauri::async_runtime::spawn_blocking(move || is_repo(&path))
        .await
        .unwrap_or(false)
}

fn parse_branch_line(line: &str) -> (Option<String>, Option<String>, u32, u32) {
    // line begins with "## "
    let rest = line.trim_start_matches("## ").to_string();
    if rest.starts_with("HEAD (no branch)") {
        return (Some("HEAD (detached)".to_string()), None, 0, 0);
    }
    if let Some(stripped) = rest.strip_prefix("No commits yet on ") {
        let name = stripped.split_whitespace().next().unwrap_or("").to_string();
        return (Some(name), None, 0, 0);
    }
    let mut upstream: Option<String> = None;
    let mut ahead: u32 = 0;
    let mut behind: u32 = 0;

    let main = rest.split(" [").next().unwrap_or(&rest);
    let branch = if let Some((b, u)) = main.split_once("...") {
        upstream = Some(u.to_string());
        b.to_string()
    } else {
        main.to_string()
    };

    if let Some(start) = rest.find('[') {
        if let Some(end) = rest[start..].find(']') {
            let inside = &rest[start + 1..start + end];
            for part in inside.split(',') {
                let part = part.trim();
                if let Some(n) = part.strip_prefix("ahead ") {
                    ahead = n.parse().unwrap_or(0);
                } else if let Some(n) = part.strip_prefix("behind ") {
                    behind = n.parse().unwrap_or(0);
                }
            }
        }
    }

    (Some(branch), upstream, ahead, behind)
}

fn git_status_blocking(path: String) -> Result<GitStatus, String> {
    if !is_repo(&path) {
        return Ok(GitStatus {
            is_repo: false,
            branch: None,
            upstream: None,
            ahead: 0,
            behind: 0,
            files: vec![],
        });
    }
    let out = run_git(&path, &["status", "--porcelain", "--branch"])?;
    let mut lines = out.lines();
    let branch_line = lines.next().unwrap_or("");
    let (branch, upstream, ahead, behind) = if branch_line.starts_with("## ") {
        parse_branch_line(branch_line)
    } else {
        (None, None, 0, 0)
    };

    let mut files = Vec::new();
    for raw in lines {
        if raw.len() < 3 {
            continue;
        }
        let bytes = raw.as_bytes();
        let x = bytes[0] as char;
        let y = bytes[1] as char;
        let rest = &raw[3..];
        // Renames look like "R  old -> new"
        let path_part = if let Some(idx) = rest.find(" -> ") {
            rest[idx + 4..].to_string()
        } else {
            rest.to_string()
        };
        let path_part = path_part.trim_matches('"').to_string();
        let conflicted = matches!(
            (x, y),
            ('D', 'D') | ('A', 'U') | ('U', 'D') | ('U', 'A') | ('D', 'U') | ('A', 'A') | ('U', 'U')
        );
        let staged = !conflicted && x != ' ' && x != '?';
        let modified = y != ' ';
        files.push(GitFile {
            path: path_part,
            index_status: x.to_string(),
            worktree_status: y.to_string(),
            staged,
            modified,
            conflicted,
        });
    }

    Ok(GitStatus {
        is_repo: true,
        branch,
        upstream,
        ahead,
        behind,
        files,
    })
}

#[tauri::command]
pub async fn git_status(path: String) -> Result<GitStatus, String> {
    off_thread(move || git_status_blocking(path)).await
}

#[tauri::command]
pub async fn git_stage(path: String, files: Vec<String>) -> Result<String, String> {
    off_thread(move || {
        if files.is_empty() {
            return Ok(String::new());
        }
        let mut args: Vec<&str> = vec!["add", "--"];
        for f in &files {
            args.push(f.as_str());
        }
        run_git(&path, &args)
    })
    .await
}

#[tauri::command]
pub async fn git_unstage(path: String, files: Vec<String>) -> Result<String, String> {
    off_thread(move || {
        if files.is_empty() {
            return Ok(String::new());
        }
        let mut args: Vec<&str> = vec!["reset", "HEAD", "--"];
        for f in &files {
            args.push(f.as_str());
        }
        run_git(&path, &args)
    })
    .await
}

#[tauri::command]
pub async fn git_commit(path: String, message: String) -> Result<String, String> {
    off_thread(move || run_git(&path, &["commit", "-m", &message])).await
}

#[tauri::command]
pub async fn git_pull(path: String) -> Result<String, String> {
    off_thread(move || run_git(&path, &["pull"])).await
}

#[tauri::command]
pub async fn git_push(path: String, set_upstream: Option<bool>) -> Result<String, String> {
    off_thread(move || {
        if set_upstream.unwrap_or(false) {
            // Publish flow for branches with no upstream: push -u so
            // the new branch starts tracking origin/<branch>.
            let branch = run_git(&path, &["rev-parse", "--abbrev-ref", "HEAD"])?;
            let branch = branch.trim().to_string();
            run_git(&path, &["push", "-u", "origin", &branch])
        } else {
            run_git(&path, &["push"])
        }
    })
    .await
}

#[tauri::command]
pub async fn git_fetch(path: String) -> Result<String, String> {
    off_thread(move || run_git(&path, &["fetch", "--all", "--prune"])).await
}

#[tauri::command]
pub async fn git_init(path: String) -> Result<String, String> {
    off_thread(move || run_git(&path, &["init"])).await
}

#[tauri::command]
pub async fn git_diff(path: String, file: Option<String>) -> Result<String, String> {
    off_thread(move || {
        if let Some(f) = file {
            run_git(&path, &["diff", "--", &f])
        } else {
            run_git(&path, &["diff"])
        }
    })
    .await
}

#[derive(Serialize)]
pub struct GitFileDiffStat {
    pub path: String,
    pub insertions: u32,
    pub deletions: u32,
}

#[derive(Serialize)]
pub struct GitDiffStat {
    pub insertions: u32,
    pub deletions: u32,
    pub files: Vec<GitFileDiffStat>,
}

fn parse_numstat_line(line: &str) -> Option<GitFileDiffStat> {
    let parts: Vec<&str> = line.split('\t').collect();
    if parts.len() < 3 {
        return None;
    }
    let ins = if parts[0] == "-" {
        0
    } else {
        parts[0].parse().unwrap_or(0)
    };
    let del = if parts[1] == "-" {
        0
    } else {
        parts[1].parse().unwrap_or(0)
    };
    Some(GitFileDiffStat {
        path: parts[2].to_string(),
        insertions: ins,
        deletions: del,
    })
}

fn git_diff_stat_blocking(path: String) -> Result<GitDiffStat, String> {
    if !is_repo(&path) {
        return Ok(GitDiffStat {
            insertions: 0,
            deletions: 0,
            files: vec![],
        });
    }
    let out = run_git(&path, &["diff", "HEAD", "--numstat"])?;
    let mut insertions = 0u32;
    let mut deletions = 0u32;
    let mut files = Vec::new();
    for line in out.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let Some(row) = parse_numstat_line(line) else {
            continue;
        };
        insertions += row.insertions;
        deletions += row.deletions;
        files.push(row);
    }
    Ok(GitDiffStat {
        insertions,
        deletions,
        files,
    })
}

#[tauri::command]
pub async fn git_diff_stat(path: String) -> Result<GitDiffStat, String> {
    off_thread(move || git_diff_stat_blocking(path)).await
}

#[tauri::command]
pub async fn git_diff_staged(path: String, file: Option<String>) -> Result<String, String> {
    off_thread(move || {
        if let Some(f) = file {
            run_git(&path, &["diff", "--cached", "--", &f])
        } else {
            run_git(&path, &["diff", "--cached"])
        }
    })
    .await
}

#[tauri::command]
pub async fn git_show(path: String, refspec: String, file: String) -> Result<String, String> {
    off_thread(move || {
        let target = format!("{}:{}", refspec, file);
        match run_git(&path, &["show", &target]) {
            Ok(s) => Ok(s),
            Err(e) => {
                let lower = e.to_lowercase();
                // "exists on disk, but not in <ref>" / "does not exist" →
                // file absent at that ref (e.g. newly added): diff against
                // empty. "unknown revision"/"ambiguous argument" shows up
                // for `:path` on never-committed repos — same treatment.
                if lower.contains("exists on disk, but not in")
                    || lower.contains("does not exist")
                    || lower.contains("unknown revision")
                    || lower.contains("ambiguous argument")
                {
                    Ok(String::new())
                } else {
                    Err(e)
                }
            }
        }
    })
    .await
}

#[tauri::command]
pub async fn git_discard(path: String, files: Vec<String>) -> Result<String, String> {
    off_thread(move || {
        if files.is_empty() {
            return Ok(String::new());
        }
        let mut args: Vec<&str> = vec!["checkout", "HEAD", "--"];
        for f in &files {
            args.push(f.as_str());
        }
        run_git(&path, &args)
    })
    .await
}

/// Resolve a merge conflict by taking one side wholesale, then stage
/// the result. side: "ours" | "theirs".
#[tauri::command]
pub async fn git_resolve_conflict(
    path: String,
    file: String,
    side: String,
) -> Result<String, String> {
    off_thread(move || {
        let flag = match side.as_str() {
            "ours" => "--ours",
            "theirs" => "--theirs",
            _ => return Err("side must be 'ours' or 'theirs'".to_string()),
        };
        match run_git(&path, &["checkout", flag, "--", &file]) {
            Ok(_) => run_git(&path, &["add", "--", &file]),
            Err(e) if e.contains("does not have") => {
                // Delete/modify conflicts (DU/UD/AU/DD): the chosen side
                // has no version — accepting it means removing the file.
                run_git(&path, &["rm", "-f", "--", &file])
            }
            Err(e) => Err(e),
        }
    })
    .await
}

/// Remove untracked files. `git checkout HEAD --` (git_discard) fails on
/// files git has never seen ("pathspec did not match"), so the discard
/// flow routes ?? files here instead.
#[tauri::command]
pub async fn git_clean(path: String, files: Vec<String>) -> Result<String, String> {
    off_thread(move || {
        if files.is_empty() {
            return Ok(String::new());
        }
        // -d: porcelain reports an untracked directory as a single
        // "?? dir/" entry; without -d `git clean -f` skips directories
        // but still exits 0 — a false "Deleted" success.
        let mut args: Vec<&str> = vec!["clean", "-fd", "--"];
        for f in &files {
            args.push(f.as_str());
        }
        run_git(&path, &args)
    })
    .await
}

#[tauri::command]
pub async fn git_branches(path: String) -> Result<Vec<String>, String> {
    off_thread(move || {
        let out = run_git(&path, &["branch", "--format=%(refname:short)"])?;
        Ok(out
            .split('\n')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect())
    })
    .await
}

#[tauri::command]
pub async fn git_checkout_branch(path: String, branch: String) -> Result<String, String> {
    off_thread(move || run_git(&path, &["checkout", &branch])).await
}

#[derive(Serialize)]
pub struct GitCommit {
    /// Short hash (7 chars) suitable for display + git-show resolution.
    pub hash: String,
    /// Full hash, for stable refs across UI sessions.
    pub full_hash: String,
    /// First line of the commit message.
    pub subject: String,
    pub author_name: String,
    pub author_email: String,
    /// Commit time as Unix seconds. Frontend formats this — different
    /// surfaces want different representations ("2h ago" vs ISO).
    pub timestamp: i64,
    /// Comma-joined parent short-hashes. Useful for the merge-graph
    /// hint in the UI; empty for the very first commit.
    pub parents: String,
}

// Use ASCII unit separator (\x1f) between fields and record separator
// (\x1e) between commits. Avoids the "what if a commit subject
// contains a tab" bug git's --format docs warn about.
const LOG_FORMAT: &str = "%h\x1f%H\x1f%an\x1f%ae\x1f%ct\x1f%P\x1f%s\x1e";

fn parse_log_output(out: &str) -> Vec<GitCommit> {
    let mut commits = Vec::new();
    for raw in out.split('\x1e') {
        let trimmed = raw.trim_start_matches('\n').trim_end_matches('\n');
        if trimmed.is_empty() {
            continue;
        }
        let parts: Vec<&str> = trimmed.split('\x1f').collect();
        if parts.len() < 7 {
            continue;
        }
        let timestamp = parts[4].parse::<i64>().unwrap_or(0);
        commits.push(GitCommit {
            hash: parts[0].to_string(),
            full_hash: parts[1].to_string(),
            author_name: parts[2].to_string(),
            author_email: parts[3].to_string(),
            timestamp,
            parents: parts[5].to_string(),
            subject: parts[6].to_string(),
        });
    }
    commits
}

fn git_log_blocking(path: String, limit: Option<u32>) -> Result<Vec<GitCommit>, String> {
    if !is_repo(&path) {
        return Ok(vec![]);
    }
    let n = limit.unwrap_or(50).min(500);
    let limit_arg = format!("-n{}", n);
    let out = run_git(
        &path,
        &[
            "log",
            "--no-decorate",
            "--no-color",
            &limit_arg,
            &format!("--format={}", LOG_FORMAT),
        ],
    )?;
    Ok(parse_log_output(&out))
}

#[tauri::command]
pub async fn git_log(path: String, limit: Option<u32>) -> Result<Vec<GitCommit>, String> {
    off_thread(move || git_log_blocking(path, limit)).await
}

fn git_file_log_blocking(
    path: String,
    file: String,
    limit: Option<u32>,
) -> Result<Vec<GitCommit>, String> {
    if !is_repo(&path) {
        return Ok(vec![]);
    }
    let n = limit.unwrap_or(50).min(500);
    let limit_arg = format!("-n{}", n);
    // --follow keeps history flowing across renames; without it the
    // listing dead-ends at the most recent `git mv`.
    let out = run_git(
        &path,
        &[
            "log",
            "--follow",
            "--no-decorate",
            "--no-color",
            &limit_arg,
            &format!("--format={}", LOG_FORMAT),
            "--",
            &file,
        ],
    )?;
    Ok(parse_log_output(&out))
}

/// Commit history for a single file (pathspec-limited git log).
#[tauri::command]
pub async fn git_file_log(
    path: String,
    file: String,
    limit: Option<u32>,
) -> Result<Vec<GitCommit>, String> {
    off_thread(move || git_file_log_blocking(path, file, limit)).await
}

#[tauri::command]
pub async fn git_create_branch(
    path: String,
    name: String,
    base: Option<String>,
    checkout: Option<bool>,
) -> Result<String, String> {
    off_thread(move || {
        let trimmed = name.trim();
        if trimmed.is_empty() {
            return Err("Branch name is empty.".to_string());
        }
        // git's own ref-name rules disallow these. Catch the common
        // typos before the shell-out so the error message is friendlier
        // than git's generic "is not a valid branch name".
        if trimmed.contains("..")
            || trimmed.contains(' ')
            || trimmed.contains('~')
            || trimmed.contains('^')
            || trimmed.contains(':')
            || trimmed.contains('?')
            || trimmed.contains('*')
            || trimmed.contains('[')
            || trimmed.contains('\\')
            || trimmed.starts_with('/')
            || trimmed.starts_with('-')
            || trimmed.ends_with('/')
            || trimmed.ends_with('.')
        {
            return Err(format!(
                "Invalid branch name '{}': git doesn't allow spaces, '..', '~^:?*[\\\\]', leading '-' or '/', or trailing '/' / '.'.",
                trimmed
            ));
        }
        let want_checkout = checkout.unwrap_or(true);
        if want_checkout {
            let mut args: Vec<&str> = vec!["checkout", "-b", trimmed];
            if let Some(b) = base.as_deref() {
                if !b.trim().is_empty() {
                    args.push(b);
                }
            }
            run_git(&path, &args)
        } else {
            let mut args: Vec<&str> = vec!["branch", trimmed];
            if let Some(b) = base.as_deref() {
                if !b.trim().is_empty() {
                    args.push(b);
                }
            }
            run_git(&path, &args)
        }
    })
    .await
}

#[tauri::command]
pub async fn git_delete_branch(
    path: String,
    name: String,
    force: Option<bool>,
) -> Result<String, String> {
    off_thread(move || {
        let trimmed = name.trim();
        if trimmed.is_empty() {
            return Err("Branch name is empty.".to_string());
        }
        let flag = if force.unwrap_or(false) { "-D" } else { "-d" };
        run_git(&path, &["branch", flag, trimmed])
    })
    .await
}

#[derive(Serialize)]
pub struct GitStash {
    /// stash@{N} — used as the refspec for pop/apply/drop/show.
    pub ref_spec: String,
    /// Branch the stash was created on, e.g. "main".
    pub branch: String,
    /// User-provided or auto-generated message.
    pub message: String,
    /// Commit time as Unix seconds.
    pub timestamp: i64,
}

fn git_stash_list_blocking(path: String) -> Result<Vec<GitStash>, String> {
    if !is_repo(&path) {
        return Ok(vec![]);
    }
    // %gd  → stash ref (stash@{0})
    // %gs  → reflog message ("On main: WIP work")
    // %ct  → committer date as Unix seconds
    // Same control-char delimiters as git_log to avoid collision with
    // stash messages that contain tabs.
    let format = "%gd\x1f%gs\x1f%ct\x1e";
    let out = run_git(
        &path,
        &["stash", "list", &format!("--format={}", format)],
    )?;
    let mut stashes = Vec::new();
    for raw in out.split('\x1e') {
        let trimmed = raw.trim_start_matches('\n').trim_end_matches('\n');
        if trimmed.is_empty() {
            continue;
        }
        let parts: Vec<&str> = trimmed.split('\x1f').collect();
        if parts.len() < 3 {
            continue;
        }
        let ts = parts[2].parse::<i64>().unwrap_or(0);
        // %gs reflog message looks like "WIP on <branch>: <subject>" or
        // "On <branch>: <user message>". Split out the branch + the
        // human-readable message for the UI.
        let raw_msg = parts[1];
        let (branch, message) = if let Some(rest) = raw_msg.strip_prefix("WIP on ") {
            if let Some((b, m)) = rest.split_once(": ") {
                (b.to_string(), m.to_string())
            } else {
                ("(unknown)".to_string(), rest.to_string())
            }
        } else if let Some(rest) = raw_msg.strip_prefix("On ") {
            if let Some((b, m)) = rest.split_once(": ") {
                (b.to_string(), m.to_string())
            } else {
                ("(unknown)".to_string(), rest.to_string())
            }
        } else {
            ("(unknown)".to_string(), raw_msg.to_string())
        };
        stashes.push(GitStash {
            ref_spec: parts[0].to_string(),
            branch,
            message,
            timestamp: ts,
        });
    }
    Ok(stashes)
}

#[tauri::command]
pub async fn git_stash_list(path: String) -> Result<Vec<GitStash>, String> {
    off_thread(move || git_stash_list_blocking(path)).await
}

#[tauri::command]
pub async fn git_stash_push(
    path: String,
    message: Option<String>,
    include_untracked: Option<bool>,
) -> Result<String, String> {
    off_thread(move || {
        let mut args: Vec<String> = vec!["stash".into(), "push".into()];
        if include_untracked.unwrap_or(false) {
            args.push("--include-untracked".into());
        }
        if let Some(m) = message.as_deref() {
            if !m.trim().is_empty() {
                args.push("-m".into());
                args.push(m.to_string());
            }
        }
        let str_args: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
        run_git(&path, &str_args)
    })
    .await
}

#[tauri::command]
pub async fn git_stash_pop(path: String, ref_spec: String) -> Result<String, String> {
    off_thread(move || run_git(&path, &["stash", "pop", &ref_spec])).await
}

#[tauri::command]
pub async fn git_stash_apply(path: String, ref_spec: String) -> Result<String, String> {
    off_thread(move || run_git(&path, &["stash", "apply", &ref_spec])).await
}

#[tauri::command]
pub async fn git_stash_drop(path: String, ref_spec: String) -> Result<String, String> {
    off_thread(move || run_git(&path, &["stash", "drop", &ref_spec])).await
}

#[tauri::command]
pub async fn git_show_commit(path: String, refspec: String) -> Result<String, String> {
    off_thread(move || {
        // git show with full diff. We use --stat for a header summary line
        // followed by --patch to get the full unified diff. Limits diff
        // size implicitly via run_git's stdout buffering — git itself caps
        // at no fixed size, but Rust's String::from_utf8_lossy will grow
        // happily for typical commits.
        run_git(
            &path,
            &[
                "show",
                "--stat",
                "--patch",
                "--no-color",
                "--no-decorate",
                &refspec,
            ],
        )
    })
    .await
}
