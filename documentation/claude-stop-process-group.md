---
type: gotcha
project: quack-desktop
created: 2026-06-29
last_verified: 2026-06-29
tags: [claude-code, process, kill, performance, rust, tauri]
---
# Stop su una chat Claude Code: uccidere il gruppo, non lockare il Child

**Sintomo**: avviata una chat (Claude Code CLI), premendo **Stop** l'app diventava
lentissima / si bloccava. In Attività un processo `bfs` a ~524% CPU con pochi MB di RAM.
`bfs` (breadth-first `find`) NON è nel repo Quack: è un **figlio orfano** di Claude Code.

## Le due cause (in `src-tauri/src/claude_code.rs`)

1. **Lock tenuto per tutta la run.** Il thread waiter faceva
   `child.lock().wait()`: il `MutexGuard` di `parking_lot` resta preso finché il
   processo non esce. Quindi `claude_code_kill` (`child.lock()`) e il watchdog
   (`try_wait`) si bloccavano dietro quel lock → **lo Stop non poteva uccidere**
   una run in corso finché non finiva da sola.
2. **Kill del solo padre.** `std::process::Child::kill()` manda SIGKILL al solo
   processo `claude` (node). I sottoprocessi dei tool (Bash, ricerche file come
   `bfs`/`rg`/`find`) restano **orfani** (reparented a pid 1) e continuano a
   girare → CPU pinnata, macchina ingolfata.

## Il fix (pattern da riusare per ogni subprocess di lunga durata)

- Lancia il processo in un **process group dedicato**:
  `cmd.process_group(0)` (unix) / `CREATE_NEW_PROCESS_GROUP` (windows).
- Per fermarlo, **segnala l'intero gruppo**, non il singolo pid:
  `kill_process_tree(pid)` → `libc::kill(-(pid as i32), SIGKILL)` su unix
  (pid negato = gruppo), `taskkill /PID <pid> /T /F` su windows.
- **Non lockare mai il `Child`** dai path di kill/watchdog: la mappa di stato
  tiene solo il `u32` pid; il `Child` è di proprietà del solo thread `wait()`.
  Watchdog e waiter si coordinano con un `AtomicBool finished`.
- Dep unix aggiunta: `libc` (per `killpg` via pid negato).

Breadcrumb nel codice: `// Brain: claude-stop-kills-process-group`.
