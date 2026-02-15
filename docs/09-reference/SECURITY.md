# Quack Security

This document summarizes threats, attack surfaces, and mitigations.

## Attack Surface

- **Local PTY**: User shell execution
- **File system**: Content reading for preview
- **Git**: Local CLI invocation
- **Local HTTP**: Axum server on 127.0.0.1:6768
- **OS Notifications**: Runtime permissions

## Principles

- No external networking by default
- Hooks on loopback only (127.0.0.1)
- Minimum necessary privileges and permissions
- No persistence of secrets/credentials

## Details

- **PTY**
  - Spawns the shell defined in `SHELL` or `/bin/bash`
  - Output forwarded as text; no interpretation on the app side
  - Process closed with `kill` + `wait`; state propagated via `terminal-exit`
- **File system**
  - `read_file_content`: 5MB limit; rejects directories
  - `list_directory`: canonical path, no execution
- **Git**
  - Uses the machine's `git` binary; errors shown to the user
  - Repo root found by traversing up from `current_dir`; does not cross non-git boundaries
- **HTTP hook**
  - Only `POST /terminal/status` on loopback
  - Validated input: `status` in {busy, idle}; `id`/`label` optional but non-empty
  - Event emission only on valid input
- **Notifications**
  - Runtime permission request; silent fallback if denied

## Recommended Configuration

- **Production**: Set CSP in `tauri.conf.json` (if remote content is enabled)
- **Logging**: Limit to info in dev, reduce verbosity in prod
- **Signing & notarization**: Follow Tauri guidelines for releases

## Known Threats and Mitigations

- Malicious processes started by the user in the PTY -> confined to the user itself (no elevated privileges)
- CSRF attacks on the hook: not exposed on external network interfaces; only accepts simple payloads and does not mutate the filesystem
- Local DoS via event flooding -> events do not write to disk; UI stays responsive, but rate limiting can be introduced in the future

## Disclosure

If you discover a vulnerability, open a private channel with the maintainers or send an email (TBD). Avoid opening public issues with exploit details.
