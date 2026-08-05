# Quack soft-fork of Synara

> Local clone path: `/Users/alekdob/Desktop/Dev/Personal/quack-20`  
> Upstream: [Emanuele-web04/synara](https://github.com/Emanuele-web04/synara)  
> Synara itself began as a clone of [T3Code](https://github.com/pingdotgg/t3code) (MIT; keep attribution).

This tree is intended as a **soft fork**: ship Quack branding on the surface, keep the Synara engine close to upstream so updates remain mergeable.

## Goal

- User-facing product name / look: **Quack**
- Runtime, packages, MCP tool surface, data layout: stay **Synara-compatible** unless there is a strong reason to diverge
- Periodically pull `upstream/main` without a rename war

## Git remotes

```sh
# This clone currently points origin at Synara. For a lasting Quack fork:
# 1. Create your GitHub fork of Emanuele-web04/synara
# 2. Point origin at that fork
# 3. Keep Synara as upstream

git remote -v
# origin    https://github.com/<you>/<quack-fork>.git
# upstream  https://github.com/Emanuele-web04/synara.git
```

Bootstrap (once):

```sh
git remote rename origin upstream   # if origin was still Synara
git remote add origin https://github.com/<you>/<quack-fork>.git
git push -u origin main
```

Or keep Synara as `origin` and add:

```sh
git remote add upstream https://github.com/Emanuele-web04/synara.git
```

…then push Quack work to a separate `quack` remote when the fork exists.

## Syncing Synara updates

Prefer **merge** over rebase on the product branch (fewer rewritten shared histories):

```sh
git fetch upstream
git checkout main          # or your Quack integration branch
git merge upstream/main
# resolve conflicts → prefer upstream for engine, keep Quack for brand/skin
git push origin main
```

Rules of thumb when resolving conflicts:

| Area                                                                  | Prefer                               |
| --------------------------------------------------------------------- | ------------------------------------ |
| `apps/*/`, orchestration, providers, contracts, tests                 | Upstream Synara                      |
| Icons, splash, product name, UI copy, theme tokens, release marketing | Quack                                |
| `LICENSE` / copyright headers                                         | Keep T3 Tools + Synara notices (MIT) |

Cherry-pick individual commits only when a full merge is too noisy.

## What to rebrand (safe)

Change these freely — low merge cost if kept in a small set of files:

- App display name, window title, About / marketing copy
- Icons, tray art, splash, duck / Quack visual identity
- CSS / design tokens (colors, radii, typography)
- Installer / release **display** names (not necessarily internal package ids)
- Website / docs that describe the Quack product

## What to leave Synara-shaped (hard)

Avoid mass rename. These create permanent upstream friction:

- npm / workspace packages (`@synara/*`)
- Internal path segments and binary names tied to Synara
- Default data home (e.g. `~/.synara`) unless you also migrate + dual-read
- MCP tool names (`synara_*`) and external integration contracts
- Protocol / contract identifiers that other tools already speak

**Rule:** brand = skin; engine = Synara. Quack wraps; it does not invent a parallel harness ID space unless you accept a hard fork.

## Synara vs T3 (why this fork exists)

Same DNA (local agent harness). Synara’s useful deltas vs T3 Code for Quack:

- More providers (e.g. Antigravity, Kilo, Factory Droid, Pi)
- MCP-native harness both ways (agents inside Synara + external MCP clients)
- Automations (heartbeat / standalone / dedicated)
- Shared visible browser + DOM annotations for agents
- Provider handoffs

T3 remains stronger on official mobile / remote control-surface packaging. Soft-forking Synara does not replace Quack desktop (`codetta`); it is an optional second product line.

## Relation to Quack desktop (`codetta`)

| Tree                  | Role                                                           |
| --------------------- | -------------------------------------------------------------- |
| `…/Personal/codetta`  | Quack desktop (Tauri) — primary light editor + AI              |
| `…/Personal/quack-20` | Soft-fork workspace of Synara — optional Quack-skinned harness |

Do **not** assume features auto-port between the two. Steal patterns deliberately; sync git only on this Synara-derived tree.

## License

MIT. Preserve copyright notices from T3 Tools Inc. and Synara contributors when redistributing. Rebranding the UI does not remove attribution obligations.

## Status (2026-08-03)

- [x] Cloned Synara into `quack-20`
- [ ] GitHub fork under Quack / personal org with `upstream` → Synara
- [x] Quack skin pass (name, icons, tokens) without engine rename
- [ ] First successful `merge upstream/main` after skin changes
