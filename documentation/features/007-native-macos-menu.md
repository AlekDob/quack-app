---
type: feature-doc
project: quack-desktop
stack: Tauri 2 (Rust + React 19)
created: 2026-06-28
last_verified: 2026-07-06
tags: [menubar, macos, native-menu, tauri-menu, topbar, accelerators, theme, quack-v1]
---

## Native macOS menu bar

**Purpose:** On macOS the OS convention is a real system menu bar at the top of the screen
(the window already uses `titleBarStyle: Overlay` + `hiddenTitle`). The in-window custom
menubar (`TopBar`) is redundant there, so on macOS we **hide it** and build a **native Tauri
menu** from the **same command registry** (`actions.ts`) — one source of truth. Windows/Linux
have no system menu bar, so they keep the in-window `TopBar` menus unchanged.
**Stack:** `@tauri-apps/api/menu` (built in JS, not Rust), React 19, the existing command registry.

### Where things live
| Concern | File |
|---|---|
| Native menu builder (macOS only) | `src/nativeMenu.ts` |
| Install at boot + focus re-bind | `src/App.tsx` (`installNativeMenu()`, `refreshNativeMenuBinding()` on `onFocusChanged`) |
| Quit teardown (Dock + popouts) | `src/appQuit.ts` |
| Quit command | `src/actions.ts` (`file.quit` → `teardownBeforeQuit` + `closeMainWindow`) |
| Hide in-window brand/menus/palette on macOS | `src/components/TopBar.tsx` (`IS_MACOS` guards) |
| Platform flag + imperative theme setter | `src/theme.ts` (`IS_MACOS`, `setTheme`, `onThemeChange`) |
| Command registry (single source of truth) | `src/actions.ts` (`commands`, `commandsForCategory`, `runCommand`) |

### Menu structure (macOS)
| Menu | Source |
|---|---|
| **Quack** (app menu) | About + Services + Hide/HideOthers/ShowAll (predefined) + **Quit → `file.quit`** (keeps the unsaved-changes guard, not the predefined hard quit) |
| **File** | `commandsForCategory("File")` minus `file.quit` |
| **Edit** | Predefined Undo/Redo/Cut/Copy/Paste/SelectAll **+** `commandsForCategory("Edit")` |
| **View** | `commandsForCategory("View")` + **Theme** submenu (Light/Dark/System) |
| **Terminal / AI / Help** | `commandsForCategory(...)` |
| **Window** | Predefined Minimize/Maximize/CloseWindow |

### Gotchas (read before touching)
- **Edit needs the predefined clipboard items.** Setting a custom app menu *replaces* the OS
  default Edit menu, so ⌘Z/⌘X/⌘C/⌘V/⌘A stop working in inputs and Monaco unless the native Edit
  submenu re-adds `Undo/Redo/Cut/Copy/Paste/SelectAll` (predefined). This is why `editSubmenu()`
  prepends them.
- **No double dispatch.** App.tsx has a JS `keydown` dispatcher (`accelMatches`). Native ⌘
  key-equivalents are consumed by AppKit *before* the webview, so they don't double-fire with it.
  Literal `Ctrl`-combos on macOS still go through the JS dispatcher (harmless, same command).
- **Accelerators are whitelisted.** `toTauriAccel()` only emits accelerators for letters, digits
  and F-keys (+ converts `Ctrl`→`CmdOrCtrl`). Chords (`Ctrl+K S`), symbols (`Ctrl+,`) and
  PageUp/Down are **omitted** so an unparseable accel never rejects the whole menu build — those
  shortcuts keep working via the JS dispatcher, just without a menu hint.
- **Theme was only in `TopBar` View > Theme.** It is NOT a registry command, so hiding the
  in-window menu on macOS would have removed the only way to switch theme. The native View menu
  adds a Theme submenu (`themeSubmenu()`) that calls `setTheme()` and re-installs the menu to
  refresh the check marks. `setTheme`/`onThemeChange` keep `useTheme()` consumers in sync.
- **Permissions already granted.** `core:default` → `core:menu:default` already includes
  `allow-set-as-app-menu`. Quit teardown also needs `core:window:allow-destroy` so Dock/popout
  `WebviewWindow.close()` succeeds in **release** builds (dev is permissive). See `010-project-dock.md`.
- **App-menu title.** macOS forces the first submenu's title to the process/bundle name
  (`productName: "Quack"`), so the `"Quack"` text on `appSubmenu()` is cosmetic.
- **Dock / popout focus kills custom menu callbacks (Tauri 2).** After the Dock or a terminal
  popout takes focus, JS `action` handlers on custom menu items stop firing — predefined items
  (Hide, About) still work. Fix: cache the `Menu` in `nativeMenu.ts` and call
  `refreshNativeMenuBinding()` (`setAsAppMenu()` again) when `main` regains focus and after
  `openDock()` on boot.
- **Quit flow:** `file.quit` / window close → `confirmDiscardUnsaved` → `teardownBeforeQuit()`
  (close Dock + all non-`main` webviews) → `closeMainWindow()`. `onCloseRequested` shares the
  same teardown via `quitArmed()` to avoid a double confirm.

### Manual verification (needs a real macOS build)
1. `npm run tauri dev` on macOS → menu bar shows **Quack / File / Edit / View / Terminal / AI /
   Window / Help** at the top of the screen; the window titlebar is empty (drag + Agents toggle only).
2. ⌘O / ⌘S / ⌘F / ⌘P etc. work and show hints in the menus.
3. ⌘C/⌘V/⌘X/⌘Z work in Monaco and inputs (predefined Edit items).
4. View > Theme switches theme and the check mark follows.
5. On Windows/Linux the in-window `TopBar` menubar is unchanged.
6. **Release build:** ⌘Q / Quit Quack closes main + Dock (no `window.destroy not allowed` in console).
7. Click the Dock, return to main, ⌘S / custom File commands still work (menu re-bound).
