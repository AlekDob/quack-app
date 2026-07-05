// Task-manager backend: enumerate Codetta's own process tree (the app,
// PTY shells, Claude Code CLI subprocesses, permission-hook node
// one-liners, language tooling they spawn…) with live CPU / RAM, and
// allow killing a runaway descendant.
//
// Scope is deliberately limited to THIS app's process tree — Codetta is
// not a system task manager, and `process_kill` refuses anything that
// isn't a strict descendant so a bug can never take out an unrelated
// process.
//
// The sysinfo `System` lives in managed state because CPU usage is a
// delta between two refreshes: the first call after launch reports 0%,
// every poll after that is accurate for the interval since the
// previous poll.

use serde::Serialize;
use std::collections::HashMap;
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
    /// Tree depth below the app process (0 = Codetta itself).
    pub depth: u32,
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

#[tauri::command]
pub fn process_stats(state: tauri::State<'_, SysMonState>) -> Vec<ProcStat> {
    let mut sys = state.0.lock().unwrap();
    sys.refresh_processes(ProcessesToUpdate::All, true);
    let me = Pid::from_u32(std::process::id());
    let mut stats: Vec<ProcStat> = descendants(&sys, me)
        .into_iter()
        .filter_map(|(pid, depth)| {
            let p = sys.process(pid)?;
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
            Some(ProcStat {
                pid: pid.as_u32(),
                parent: p.parent().map(|pp| pp.as_u32()),
                name: p.name().to_string_lossy().into_owned(),
                cmd,
                cpu: p.cpu_usage(),
                mem: p.memory(),
                depth,
            })
        })
        .collect();
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
/// anything outside our tree.
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
