---
type: gotcha
project: quack-app
created: 2026-05-27
last_verified: 2026-05-27
tags: [skills, include_str, rust, build, quack-remote]
---

# Built-in skills are bundled via include_str! — changes require rebuild

Built-in skills (like `quack-remote`) are embedded into the Rust binary at compile time via `include_str!("../templates/skills/quack-remote.md")` in `skills.rs:10`. Editing the template file on disk has **zero effect** on running Quack instances — agents will continue to see the old skill content until the binary is rebuilt.

**Trigger**: after modifying any file under `src-tauri/templates/skills/`, always rebuild (`pnpm tauri dev` or `pnpm tauri build`) before testing with agents.

**Incident**: WS5 added `/api/terminals` endpoints and documented them in the `quack-remote` skill template, but an external agent couldn't see the new endpoints because it was reading the old bundled skill from a stale binary.
