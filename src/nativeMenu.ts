// Native macOS menu bar.
//
// On macOS the system convention is a real menu bar at the top of the
// screen — the window already uses titleBarStyle: Overlay + hiddenTitle,
// so the in-window custom menubar (TopBar) is redundant there. On macOS we
// hide that bar (see TopBar) and build a NATIVE Tauri menu from the SAME
// command registry (actions.ts) — one source of truth, no duplicated
// labels. Win/Linux have no system menu bar, so they keep the in-window
// TopBar menus and installNativeMenu() is a no-op there.
//
// Accelerators: native key equivalents (⌘…) are consumed by AppKit before
// the webview, so they don't double-fire with the JS keydown dispatcher in
// App.tsx (which still owns literal Ctrl-combos and chords). We only emit
// accelerators we're certain Tauri parses — letters, digits and F-keys —
// and omit the rest (symbols, PageUp/Down, chords); those keep working via
// the JS dispatcher, just without a menu hint.

import {
  Menu,
  type MenuItemOptions,
  type SubmenuOptions,
  type PredefinedMenuItemOptions,
  type CheckMenuItemOptions,
} from "@tauri-apps/api/menu";
import {
  commandsForCategory,
  runCommand,
  type CommandSpec,
} from "./actions";
import { parseChordAccel } from "./accelMatch";
import { IS_MACOS, readStoredTheme, setTheme, type ThemeMode } from "./theme";

const APP_NAME = "Quack";

type ItemOpts =
  | MenuItemOptions
  | SubmenuOptions
  | PredefinedMenuItemOptions
  | CheckMenuItemOptions;

// Convert a registry accel ("Ctrl+Shift+W", "F11") to a Tauri accelerator
// ("CmdOrCtrl+Shift+W"). Returns undefined for chords and any key we don't
// whitelist, so an unparseable accel never rejects the whole menu build.
function toTauriAccel(accel?: string): string | undefined {
  if (!accel || parseChordAccel(accel)) return undefined;
  const segs = accel.split("+");
  const key = segs[segs.length - 1];
  if (!/^([A-Za-z0-9]|F([1-9]|1[0-2]))$/.test(key)) return undefined;
  const mods: string[] = [];
  for (const m of segs.slice(0, -1)) {
    const l = m.toLowerCase();
    if (l === "ctrl" || l === "cmd" || l === "meta") mods.push("CmdOrCtrl");
    else if (l === "alt" || l === "option") mods.push("Alt");
    else if (l === "shift") mods.push("Shift");
    else return undefined; // unknown modifier — bail, JS handler keeps it
  }
  return [...mods, key].join("+");
}

// A registry command → native menu item. Menu clicks always run (the
// skipWhenTyping guard only governs the JS keyboard dispatcher).
function toItem(c: CommandSpec): MenuItemOptions {
  return {
    id: `menu:${c.id}`,
    text: c.label,
    accelerator: toTauriAccel(c.accel),
    action: () => runCommand(c.id),
  };
}

function categoryItems(cat: CommandSpec["category"]): MenuItemOptions[] {
  return commandsForCategory(cat).map(toItem);
}

// Theme picker — the theme is only reachable from this menu on macOS
// (the in-window View > Theme is hidden), so it lives here natively.
function themeSubmenu(): SubmenuOptions {
  const current = readStoredTheme();
  const opt = (mode: ThemeMode, label: string): CheckMenuItemOptions => ({
    id: `menu:theme:${mode}`,
    text: label,
    checked: current === mode,
    // Re-install so the check marks reflect the new selection.
    action: () => {
      setTheme(mode);
      void installNativeMenu();
    },
  });
  return {
    text: "Theme",
    items: [opt("light", "Light"), opt("dark", "Dark"), opt("system", "System")],
  };
}

// App menu (the bold "Quack" menu). Quit routes through file.quit so it
// keeps the unsaved-changes guard, rather than the predefined hard quit.
function appSubmenu(): SubmenuOptions {
  return {
    text: APP_NAME,
    items: [
      { item: { About: { name: APP_NAME } } },
      { item: "Separator" },
      { item: "Services" },
      { item: "Separator" },
      { item: "Hide" },
      { item: "HideOthers" },
      { item: "ShowAll" },
      { item: "Separator" },
      {
        id: "menu:file.quit",
        text: `Quit ${APP_NAME}`,
        accelerator: "CmdOrCtrl+Q",
        action: () => runCommand("file.quit"),
      },
    ],
  };
}

// Standard macOS Window menu (predefined items handle the native behaviour).
function windowSubmenu(): SubmenuOptions {
  return {
    text: "Window",
    items: [
      { item: "Minimize" },
      { item: "Maximize" },
      { item: "Separator" },
      { item: "CloseWindow" },
    ],
  };
}

// Edit needs the predefined clipboard items so ⌘Z/⌘X/⌘C/⌘V/⌘A keep working
// in inputs and Monaco — setting a custom app menu replaces the OS default
// Edit menu that normally provides them.
function editSubmenu(): SubmenuOptions {
  const clipboard: PredefinedMenuItemOptions[] = [
    { item: "Undo" },
    { item: "Redo" },
    { item: "Separator" },
    { item: "Cut" },
    { item: "Copy" },
    { item: "Paste" },
    { item: "SelectAll" },
  ];
  const rest = categoryItems("Edit");
  const items: ItemOpts[] = rest.length
    ? [...clipboard, { item: "Separator" }, ...rest]
    : clipboard;
  return { text: "Edit", items };
}

/** Build the native menu and set it as the app menu. macOS only — no-op
 *  elsewhere. Safe to call again (e.g. on theme change) — it replaces the
 *  current app menu. */
export async function installNativeMenu(): Promise<void> {
  if (!IS_MACOS) return;
  const menu = await Menu.new({
    items: [
      appSubmenu(),
      { text: "File", items: categoryItems("File").filter(notQuit) },
      editSubmenu(),
      { text: "View", items: [...categoryItems("View"), themeSubmenu()] },
      { text: "Terminal", items: categoryItems("Terminal") },
      { text: "AI", items: categoryItems("AI") },
      windowSubmenu(),
      { text: "Help", items: categoryItems("Help") },
    ],
  });
  await menu.setAsAppMenu();
}

// file.quit moves to the app menu (Quit Quack), so drop it from File.
function notQuit(i: MenuItemOptions): boolean {
  return i.id !== "menu:file.quit";
}
