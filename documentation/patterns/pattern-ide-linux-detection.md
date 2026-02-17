---
type: pattern
tags: [ide, linux, detection, platform, xdg, desktop-files]
created: 2026-02-16
---

# Linux IDE Detection Pattern

## Problem

IDE detection on Linux returned 0 results. macOS uses `/Applications/*.app` paths, Windows uses `%LOCALAPPDATA%` / `%ProgramFiles%`, but the Linux code path was a stub returning `(false, String::new())`.

## Solution

Linux IDE detection uses two complementary methods:

1. **XDG `.desktop` file scanning** - Parse `.desktop` files from standard directories to extract the `Exec=` binary path
2. **CLI in PATH** - Check if the IDE's CLI command is available via PATH (pre-existing, already worked)

### Detection Flow

```
IDE_REGISTRY entry
  -> get_app_path() [Linux]
    -> get_linux_desktop_dirs()    // XDG_DATA_HOME, XDG_DATA_DIRS, Snap, Flatpak
    -> for each desktop_name:
      -> parse_desktop_exec()      // Read [Desktop Entry] section, extract Exec= binary
        -> find_in_path()          // Resolve non-absolute binaries via PATH (no subprocess)
  -> is_cli_available()            // Fallback: `which <cli>`
  -> app_exists || cli_available   // Either method is sufficient
```

### XDG Directories Scanned

| Source | Path |
|--------|------|
| `XDG_DATA_HOME` | `~/.local/share/applications/` (default) |
| `XDG_DATA_DIRS` | `/usr/local/share/applications/`, `/usr/share/applications/` |
| Snap | `/var/lib/snapd/desktop/applications/` |
| Flatpak (system) | `/var/lib/flatpak/exports/share/applications/` |
| Flatpak (user) | `~/.local/share/flatpak/exports/share/applications/` |

### `.desktop` File Parsing Rules

- Only reads `Exec=` from `[Desktop Entry]` section (ignores `[Desktop Action]` sections)
- Strips `env VAR=val` prefixes before the binary
- Resolves non-absolute binaries by walking `PATH` directories in Rust (no `which` subprocess)
- Returns the first valid match

## Supported IDEs on Linux

| IDE | CLI | `.desktop` Names |
|-----|-----|-----------------|
| VS Code | `code` | `code.desktop`, `code-oss.desktop`, `visual-studio-code.desktop` |
| Cursor | `cursor` | `cursor.desktop`, `cursor-url-handler.desktop` |
| Windsurf | `windsurf` | `windsurf.desktop` |
| Zed | `zed` | `zed.desktop`, `dev.zed.Zed.desktop` |
| Athas | `athas-code` | `athas-code.desktop` |
| IntelliJ IDEA | `idea` | `intellij-idea.desktop`, `jetbrains-idea.desktop`, `jetbrains-idea-ce.desktop` |
| WebStorm | `webstorm` | `webstorm.desktop`, `jetbrains-webstorm.desktop` |
| PyCharm | `pycharm` | `pycharm.desktop`, `jetbrains-pycharm.desktop`, `jetbrains-pycharm-ce.desktop` |
| GoLand | `goland` | `goland.desktop`, `jetbrains-goland.desktop` |
| RubyMine | `rubymine` | `rubymine.desktop`, `jetbrains-rubymine.desktop` |
| PhpStorm | `phpstorm` | `phpstorm.desktop`, `jetbrains-phpstorm.desktop` |
| Sublime Text | `subl` | `sublime_text.desktop`, `sublime-text.desktop` |
| Android Studio | `studio` | `android-studio.desktop`, `jetbrains-studio.desktop` |
| Antigravity | `antigravity` | `antigravity.desktop` |

**Excluded** (platform-specific): Xcode (macOS), Notepad++ (Windows)

## Linux Terminals & File Managers

Detected via `is_cli_available()` in `get_installed_apps()`:

| App | CLI | Working Dir Flag | Category |
|-----|-----|-----------------|----------|
| GNOME Terminal | `gnome-terminal` | `--working-directory` | terminal |
| Konsole | `konsole` | `--workdir` | terminal |
| Xfce Terminal | `xfce4-terminal` | `--working-directory` | terminal |
| Alacritty | `alacritty` | `--working-directory` | terminal |
| Kitty | `kitty` | `--directory` | terminal |
| WezTerm | `wezterm` | `start --cwd` | terminal |
| Ghostty | `ghostty` | `--working-directory` | terminal |
| Foot | `foot` | `--working-directory=` | terminal |
| Tilix | `tilix` | `--working-directory` | terminal |
| Nautilus | `nautilus` | (path arg) | finder |
| Dolphin | `dolphin` | (path arg) | finder |
| Thunar | `thunar` | (path arg) | finder |
| Nemo | `nemo` | (path arg) | finder |
| PCManFM | `pcmanfm` | (path arg) | finder |

## CLI-less Fallback (Flatpak/Snap)

When a vscode-style or Zed IDE has no CLI in PATH (e.g., Flatpak install), the Linux code falls back to the binary resolved from the `.desktop` file:

```
open_file_in_ide()
  -> CLI not available?
    -> [Linux] entry.get_app_path() -> resolved binary from .desktop
    -> Command::new(&app_path).arg(&file_path).spawn()
```

## Custom IDE Support

On Linux, custom IDEs are spawned directly via `Command::new(&app_path).arg(...)`. The frontend file picker (`addCustomIDE()`) detects Linux via `navigator.userAgent.includes('Linux')` and allows selecting any file (no `.exe` filter).

## Key Files

| File | Purpose |
|------|---------|
| `src-tauri/src/ide_integration.rs` | All detection, opening, and app management logic |
| `src/stores/ideStore.ts` | Frontend IDE store + custom IDE picker |
| `src-tauri/node-sdk/ide-mcp-server.js` | MCP server (uses `which` on Linux, works as-is) |

## Platform Guard Convention

Linux-specific blocks use `#[cfg(target_os = "linux")]`. The catch-all fallback was updated from:
```rust
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
```
to:
```rust
#[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
```

## Not Supported on Linux

- **Window management** (focus, arrange side-by-side, sync focus) - Requires `wmctrl`/`xdotool` (X11) or Wayland equivalents
- **Icon extraction** - macOS uses `sips`, Linux would need GTK icon theme parsing
