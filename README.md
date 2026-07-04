# Codetta

**A lightweight desktop code editor with first-class AI. Bring your own model — Anthropic, OpenAI, Ollama, or Claude Code.**

[![npm](https://img.shields.io/npm/v/codetta.svg?label=npm&color=cb3837)](https://www.npmjs.com/package/codetta)
[![Release](https://img.shields.io/github/v/release/getcodetta/codetta?include_prereleases&label=release&color=6ea8ff)](https://github.com/getcodetta/codetta/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/getcodetta/codetta/total.svg?color=22c55e)](https://github.com/getcodetta/codetta/releases)
[![License: FSL-1.1-ALv2](https://img.shields.io/badge/License-FSL--1.1--ALv2-blue.svg)](LICENSE)
[![Tauri 2](https://img.shields.io/badge/Tauri-2-24C8DB.svg)](https://tauri.app)
[![CI](https://img.shields.io/github/actions/workflow/status/getcodetta/codetta/release.yml?label=build)](https://github.com/getcodetta/codetta/actions)

Website · [codetta.dev](https://codetta.dev)
Issues · [github.com/getcodetta/codetta/issues](https://github.com/getcodetta/codetta/issues)

---

## What it is

Codetta is a small, fast desktop code editor that doesn't try to be VS Code. It ships in ~30 MB instead of 200+, has no telemetry, and treats AI as a first-class panel — *your* AI, with *your* keys.

**Highlights**

- **Agent Mode** — flip the window into an agent-centric workspace: a workspace rail, a sessions list, and a conversation-first chat as the main surface. Tool calls collapse into glanceable chips (quiet "read 16 files", loud "edited run.ts"), file edits roll into a Changes review card, and the agent's task list lives in a sidebar. Toggle with the title-bar **Agent** button or `Ctrl+Shift+A`. See [What's new](#whats-new-in-v05).
- **Best-in-class Claude Code integration** — uses your existing Claude Pro / Max subscription via the CLI. GUI permission cards (no more `--dangerously-skip-permissions`), session resume that hydrates the full prior transcript, branch from any past turn, plan-mode approval, and per-chat effort / thinking controls.
- **Plugins & MCP** — install Claude Code plugins from any GitHub marketplace (skills, commands, subagents, hooks, MCP servers), and add MCP servers in a click — a curated catalog plus manual add (stdio / HTTP / npm / pip / Docker), user or project scope.
- **BYOK AI panel** — Claude Code, Anthropic API, OpenAI, and local Ollama all in one chat. Switch models mid-conversation.
- **Multi-workspace** — open several projects side by side; each has its own isolated, persistent state (open files, terminals, layout, AI chat history).
- **Multi-terminal with pop-out** — drop terminals into the bottom panel, or pop them out into their own OS window and re-dock when done. PTY survives the move.
- **Drag-and-drop tab splits** — drop any tab onto an edge to split a pane horizontally or vertically.
- **Integrated git** — branch picker, source-control panel, line-level gutter markers, diff viewer.
- **Monaco editor** under the hood — same engine as VS Code, with syntax highlighting, find/replace, formatting.
- **~30 MB native** — Tauri 2 + Rust backend, no Electron, no Node runtime required to run.
- **No telemetry** — zero phone-home. Your code, your keys, your machine.

---

## What's new in v0.5

Agent Mode and a plugin system. Full notes in [CHANGELOG.md](CHANGELOG.md):

- **Agent Mode** — a dedicated, agent-centric layout (workspace rail + sessions list + conversation-first chat + Changes/Files panel). Toggle with the **Agent** button or `Ctrl+Shift+A`; sessions, changes, and tasks survive the toggle.
- **Conversation-first chat** — tool calls collapse into icon chips grouped by type; exploration (reads/searches) stays quiet, edits stand out. Click a chip to expand the diff/output, or an edit chip to open the file. Extended thinking folds inline.
- **Plugins** — add any Claude Code plugin marketplace by GitHub URL (the official catalog or your own repo) and install the plugins it offers — skills, commands, subagents, hooks, MCP servers. Backed by the `claude plugin` CLI.
- **Agent Customizations** — one tabbed panel for Instructions, Skills, Plugins, MCP servers, tool permissions, providers, and privacy exclusions.
- **MCP, your way** — the one-click catalog plus manual add: a stdio command, an HTTP/SSE remote URL, or an npm / pip / Docker package, with search and live install state.
- **Plan-mode approval** — when the agent finishes planning, review the plan in a card and **Approve & start** or **Keep planning**.
- **First-run welcome** + a richer "Nothing open here" pane that leads with New AI chat and Agent Mode (v0.5.1).

Earlier releases delivered the Claude Code integration overhaul (GUI permission cards, session resume, transcript hydration, the timeline scrubber, spend tracking) and the v0.4 power-user batch — all still here. See [CHANGELOG.md](CHANGELOG.md) for the history.

---

## Install (end users)

### Windows

Download the installer from the [latest release](https://github.com/getcodetta/codetta/releases/latest):

| File | Use this if… |
|---|---|
| `Codetta_{version}_x64-setup.exe` | **Recommended** — NSIS installer, adds Start Menu entry + uninstaller |
| `Codetta_{version}_x64_en-US.msi` | You're deploying via SCCM / Intune / GPO |
| `codetta.exe` | Portable — run without installing (single executable) |

After install, launch **Codetta** from the Start Menu. The first run prompts you to open a folder.

**Locations on disk**

| Item | Path |
|---|---|
| Binary (per-user install) | `%LocalAppData%\Codetta\` |
| Binary (system install) | `C:\Program Files\Codetta\` |
| Workspace state | `%AppData%\codetta\` |
| Uninstall | Settings → Apps → Codetta |

### macOS

Download `Quack_{version}_universal.dmg` from the [latest release](https://github.com/AlekDob/quack-app/releases/latest) — universal binary covers both Apple Silicon and Intel.

**Developers:** signed + notarized builds are produced locally (not in CI yet). See [README-MAC.md](README-MAC.md):

```bash
cp .env.example .env   # or copy from quack-app
npm run build:mac:release:universal
```

Output: `src-tauri/target/universal-apple-darwin/release/bundle/macos/Quack.dmg`

> CI releases may still be unsigned (Gatekeeper workaround: right-click → Open). Local notarized builds pass Gatekeeper without that step.

### Linux

| File | Use this if… |
|---|---|
| `codetta_{version}_amd64.AppImage` | **Recommended** — portable, runs on most distros. `chmod +x` then double-click. |
| `codetta_{version}_amd64.deb` | Debian / Ubuntu. `sudo apt install ./codetta_{version}_amd64.deb` |

---

## Setting up AI (one-time, per provider)

Open **Settings → AI Providers** and add a key for whichever provider(s) you want.

| Provider | What you need | Cost |
|---|---|---|
| **Claude Code CLI** ⭐ | Install [Claude Code](https://docs.claude.com/en/docs/claude-code) and `claude login` | **Uses your existing Claude.ai Pro / Max subscription — no extra billing.** Or pay-per-token if you log in with an API key. |
| **Anthropic Claude (API)** | API key from [console.anthropic.com](https://console.anthropic.com/) | Pay-per-token |
| **OpenAI** | API key from [platform.openai.com](https://platform.openai.com/api-keys) | Pay-per-token |
| **Ollama** (local) | [Install Ollama](https://ollama.com/download) and `ollama pull qwen2.5-coder:7b` (or any model) | Free, local |

> 💡 **Already pay for Claude Pro or Max?** Use the **Claude Code CLI** option instead of the API. After `claude login`, Codetta talks to Claude through the CLI, which runs against your subscription (5-hour usage caps per your plan tier) rather than the metered API. For most coding work this is significantly cheaper than per-token API billing.

You can mix providers freely — switch models from the chat panel's model picker mid-conversation.

---

## Develop / build from source

### Prerequisites

| | Version | Install |
|---|---|---|
| **Node.js** | 18+ | https://nodejs.org |
| **Rust toolchain** | 1.77+ stable | https://rustup.rs |
| **Tauri prerequisites** | per-OS | https://tauri.app/start/prerequisites/ |
| **(Windows) WebView2** | Auto-installed by Edge / Tauri bootstrapper | usually already present |

After installing Rust, make sure `cargo` is on your `PATH`. On Windows:

```powershell
[Environment]::SetEnvironmentVariable("PATH", $env:PATH + ";$env:USERPROFILE\.cargo\bin", "User")
```

Then close and reopen your terminal.

### Clone and run

```bash
git clone https://github.com/getcodetta/codetta.git
cd codetta
npm install
npm run tauri dev
```

The first run pulls Rust crates and builds the Tauri shell — expect 3–10 minutes. Subsequent runs are seconds (incremental).

### Build a release installer

```bash
npm run tauri build
```

Outputs land in `src-tauri/target/release/bundle/`:

- `nsis/Codetta_{version}_x64-setup.exe` — recommended Windows installer
- `msi/Codetta_{version}_x64_en-US.msi` — enterprise MSI
- `src-tauri/target/release/codetta.exe` — portable executable

### Project layout

```
codetta/
├── src/                      # React + TypeScript frontend
│   ├── components/           # UI: editor panes, terminal, AI chat, sidebar, etc.
│   ├── providers/            # AI provider adapters (anthropic, openai, ollama, claude-code)
│   ├── store.ts              # Zustand state (workspaces, panes, files, terminals)
│   ├── actions.ts            # Command palette commands
│   └── App.tsx               # App shell + popout-window routing
├── src-tauri/                # Rust backend
│   ├── src/
│   │   ├── lib.rs            # Tauri command registration
│   │   ├── pty.rs            # PTY (terminal) backend via portable-pty
│   │   ├── git.rs            # Git operations
│   │   ├── fs_ops.rs         # File system commands
│   │   ├── search.rs         # Workspace file listing & content search
│   │   ├── watcher.rs        # File-system change watcher
│   │   ├── workspace.rs      # Persistent workspace state
│   │   └── claude_code.rs    # Claude Code CLI bridge
│   ├── capabilities/         # Tauri 2 permission capabilities
│   └── tauri.conf.json       # Bundle / window config
├── index.html                # Vite entry
└── package.json
```

### Useful scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server only (no Tauri shell) |
| `npm run build` | Type-check + build the frontend (no Tauri) |
| `npm run tauri dev` | Full app with Rust backend + hot reload |
| `npm run tauri build` | Production installers |

---

## Contributing

Issues and PRs welcome at [github.com/getcodetta/codetta](https://github.com/getcodetta/codetta).

Please follow [DCO sign-off](https://developercertificate.org/) on commits (`git commit -s`) — no CLA required.

**Scope statement** — to keep Codetta lightweight and finishable, we deliberately do **not** plan to add a generic editor-extension API, language-server protocol support, an integrated debugger, telemetry, or built-in cloud sync. (Agent **plugins** are different — those are Claude Code plugins, installed through the agent, not a Codetta editor-extension marketplace.) The goal is a fast, focused editor that does its job well.

---

## License

[FSL-1.1-ALv2](LICENSE) © 2026 Codetta Maintainers

Codetta is **source-available** under the [Functional Source License](https://fsl.software). In short:

- ✅ **Free for personal use, internal company use, education, research, and non-commercial work** — read the source, modify it, build it, run it however you like.
- ✅ **Free to contribute** — fork, hack, send PRs.
- ❌ **You may not** repackage Codetta as a competing commercial product or hosted service.
- 🕒 **Auto-converts to Apache 2.0** two years after each release — so every version eventually becomes fully open source.

If you want to use Codetta in a way the FSL doesn't allow, get in touch at getcodetta@gmail.com.
