// Task-manager backend: enumerate Quack's own process tree (the app,
// PTY shells, Claude Code CLI subprocesses, permission-hook node
// one-liners, language tooling they spawn…) with live CPU / RAM, and
// allow killing a runaway descendant.
//
// Also surfaces macOS WebKit WebContent / Networking / GPU helpers that
// host the WKWebView UI. Those run as XPC services under launchd (not
// as Quack descendants), so a tree-only view hid the real CPU/RAM hog.
// They are listed as related, non-killable rows.
//
// Scope is deliberately limited to THIS app's process tree (+ related
// WebKit UI) — Quack is not a system task manager, and `process_kill`
// refuses anything that isn't a strict descendant so a bug can never
// take out an unrelated process.
//
// The sysinfo `System` lives in managed state because CPU usage is a
// delta between two refreshes: the first call after launch reports 0%,
// every poll after that is accurate for the interval since the
// previous poll.

use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::sync::Mutex;
use sysinfo::{Pid, ProcessesToUpdate, System};

pub struct SysMonState(pub Mutex<System>);

impl Default for SysMonState {
    fn default() -> Self {
        SysMonState(Mutex::new(System::new()))
    }
}

#[derive(Serialize)]
pub struct ProcStat {
    pub pid: u32,
    pub parent: Option<u32>,
    /// Process image name (claude.exe, powershell.exe, node.exe …).
    pub name: String,
    /// Full command line, truncated — lets the UI distinguish "node
    /// (permission hook)" from "node (vite dev server)".
    pub cmd: String,
    /// Percent of one core since the previous poll (can exceed 100 on
    /// multi-threaded processes).
    pub cpu: f32,
    /// Resident memory in bytes.
    pub mem: u64,
    /// Tree depth below the app process (0 = Quack itself).
    /// Related WebKit rows use depth 1 for indent.
    pub depth: u32,
    /// False for Quack itself and for related WebKit UI (not in our tree).
    pub killable: bool,
    /// True when this is a WebKit helper attached as Quack UI (not a child).
    pub related: bool,
}

/// Collect pid -> children index, then walk down from `root`.
fn descendants(sys: &System, root: Pid) -> Vec<(Pid, u32)> {
    let mut children: HashMap<Pid, Vec<Pid>> = HashMap::new();
    for (pid, proc_) in sys.processes() {
        if let Some(parent) = proc_.parent() {
            children.entry(parent).or_default().push(*pid);
        }
    }
    let mut out = Vec::new();
    let mut stack = vec![(root, 0u32)];
    while let Some((pid, depth)) = stack.pop() {
        out.push((pid, depth));
        if depth > 16 {
            continue; // paranoia guard against parent-pid cycles
        }
        if let Some(kids) = children.get(&pid) {
            for k in kids {
                stack.push((*k, depth + 1));
            }
        }
    }
    out
}

fn truncate_cmd(p: &sysinfo::Process) -> String {
    let mut cmd = p
        .cmd()
        .iter()
        .map(|s| s.to_string_lossy().into_owned())
        .collect::<Vec<_>>()
        .join(" ");
    if cmd.len() > 240 {
        cmd.truncate(240);
        cmd.push('…');
    }
    cmd
}

fn to_stat(p: &sysinfo::Process, pid: Pid, depth: u32, killable: bool, related: bool) -> ProcStat {
    ProcStat {
        pid: pid.as_u32(),
        parent: p.parent().map(|pp| pp.as_u32()),
        name: p.name().to_string_lossy().into_owned(),
        cmd: truncate_cmd(p),
        cpu: p.cpu_usage(),
        mem: p.memory(),
        depth,
        killable,
        related,
    }
}

fn is_webkit_ui_name(name: &str) -> bool {
    let n = name.to_lowercase();
    n.contains("webkit.webcontent")
        || n.contains("com.apple.webkit.webcontent")
        || n.contains("webkit.networking")
        || n.contains("webkit.gpu")
        || n.contains("com.apple.webkit.networking")
        || n.contains("com.apple.webkit.gpu")
}

/// Best-effort: WebKit XPC helpers started at/after Quack, heaviest first.
/// Caps noise from Safari tabs when several WebContent processes exist.
fn related_webkit(sys: &System, me: Pid, tree_pids: &HashSet<u32>) -> Vec<ProcStat> {
    let quack_start = sys.process(me).map(|p| p.start_time()).unwrap_or(0);
    // Allow a few seconds of skew for XPC spawn after the app binary.
    let earliest = quack_start.saturating_sub(5);
    let mut candidates: Vec<(u64, Pid)> = Vec::new();
    for (pid, proc_) in sys.processes() {
        let id = pid.as_u32();
        if tree_pids.contains(&id) {
            continue;
        }
        let name = proc_.name().to_string_lossy();
        if !is_webkit_ui_name(&name) {
            continue;
        }
        if proc_.start_time() < earliest {
            continue;
        }
        candidates.push((proc_.memory(), *pid));
    }
    candidates.sort_by(|a, b| b.0.cmp(&a.0));
    candidates
        .into_iter()
        .take(4)
        .filter_map(|(_, pid)| {
            let p = sys.process(pid)?;
            Some(to_stat(p, pid, 1, false, true))
        })
        .collect()
}

#[tauri::command]
pub fn process_stats(state: tauri::State<'_, SysMonState>) -> Vec<ProcStat> {
    let mut sys = state.0.lock().unwrap();
    sys.refresh_processes(ProcessesToUpdate::All, true);
    let me = Pid::from_u32(std::process::id());
    let tree = descendants(&sys, me);
    let tree_pids: HashSet<u32> = tree.iter().map(|(p, _)| p.as_u32()).collect();
    let mut stats: Vec<ProcStat> = tree
        .into_iter()
        .filter_map(|(pid, depth)| {
            let p = sys.process(pid)?;
            Some(to_stat(p, pid, depth, depth > 0, false))
        })
        .collect();
    stats.extend(related_webkit(&sys, me, &tree_pids));
    // App first, then heaviest CPU, then heaviest memory.
    stats.sort_by(|a, b| {
        a.depth
            .cmp(&b.depth)
            .then(b.cpu.partial_cmp(&a.cpu).unwrap_or(std::cmp::Ordering::Equal))
            .then(b.mem.cmp(&a.mem))
    });
    stats
}

/// Kill a process — ONLY if it's a strict descendant of the app. The
/// app's own pid is refused (use the window close button), and so is
/// anything outside our tree (including related WebKit UI).
#[tauri::command]
pub fn process_kill(
    state: tauri::State<'_, SysMonState>,
    pid: u32,
) -> Result<bool, String> {
    let mut sys = state.0.lock().unwrap();
    sys.refresh_processes(ProcessesToUpdate::All, true);
    let me = Pid::from_u32(std::process::id());
    let target = Pid::from_u32(pid);
    if target == me {
        return Err("refusing to kill the app process".into());
    }
    let tree = descendants(&sys, me);
    if !tree.iter().any(|(p, _)| *p == target) {
        return Err("process is not part of Quack's tree".into());
    }
    match sys.process(target) {
        Some(p) => Ok(p.kill()),
        None => Ok(false),
    }
}
