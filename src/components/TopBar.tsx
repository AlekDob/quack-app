import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  commands,
  commandsForCategory,
  type CommandSpec,
} from "../actions";
import { useTheme, type ThemeMode, IS_MACOS } from "../theme";
import { getActiveEditor } from "../editorState";
import { Icon } from "./Icon";
import { AIIcon } from "./AIIcon";
import { useAgentMode, toggleAgentMode } from "../agentMode";

// Edit-menu actions delegate to the active Monaco editor when one is
// focused (its built-in commands handle the editor's undo stack +
// multi-cursor selections correctly). Falls back to document.execCommand
// for plain inputs/textareas, which still works there even though it's
// deprecated for contentEditable. The previous version called execCommand
// unconditionally, which silently no-op'd inside Monaco.
function runEditAction(
  monacoCmd: string,
  fallback: () => void,
): void {
  const ed = getActiveEditor();
  if (ed && ed.hasTextFocus && ed.hasTextFocus()) {
    try {
      ed.trigger("topbar-menu", monacoCmd, null);
      return;
    } catch {
      /* fall through to fallback below */
    }
  }
  fallback();
}

interface DropdownProps {
  label: string;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  /** Fired on hover so the menubar can switch open menus the way every
   *  native menubar does: once one menu is open, sliding the pointer
   *  across the bar opens siblings without extra clicks. */
  onHover?: () => void;
  children: React.ReactNode;
}

function MenuButton({
  label,
  open,
  onToggle,
  onClose,
  onHover,
  children,
}: DropdownProps) {
  return (
    <div className="menu-anchor" data-tauri-drag-region={false}>
      <button
        className={`menu-button ${open ? "open" : ""}`}
        onClick={onToggle}
        onMouseEnter={onHover}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${label} menu`}
      >
        {label}
      </button>
      {open && (
        <>
          <div className="menu-overlay" onClick={onClose} />
          <div className="menu-dropdown" role="menu">
            {children}
          </div>
        </>
      )}
    </div>
  );
}

/** Second-level menu. Opens on hover (with a small close grace so the
 *  diagonal move into the flyout doesn't shut it) and on click; ArrowRight
 *  / ArrowLeft open and close it from the keyboard.
 *
 *  The flyout PORTALS to document.body with fixed positioning — the
 *  parent .menu-dropdown is overflow-y:auto, so an in-flow absolute
 *  child gets clipped at the dropdown edge and merely inflates its
 *  scrollbar instead of floating beside it. Both the trigger and the
 *  portaled flyout share the same enter/leave grace timer so crossing
 *  the 2px gap doesn't flicker it closed. */
function SubMenu({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    maxHeight: number;
  } | null>(null);
  const closeTimer = useRef<number | null>(null);
  const enter = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const leave = () => {
    closeTimer.current = window.setTimeout(() => setOpen(false), 140);
  };
  useEffect(() => {
    return () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
  }, []);
  useEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = 240; // matches .menu-submenu min-width + padding
    // Open to the right of the trigger; flip to the left edge when the
    // viewport is too narrow. Clamp top so the flyout never runs off
    // the bottom of the window.
    const left =
      r.right + 2 + width > window.innerWidth
        ? Math.max(4, r.left - width - 2)
        : r.right + 2;
    const top = Math.max(4, Math.min(r.top - 5, window.innerHeight - 200));
    setPos({ top, left, maxHeight: window.innerHeight - top - 8 });
  }, [open]);
  return (
    <div
      className="menu-subanchor"
      onMouseEnter={enter}
      onMouseLeave={leave}
    >
      <button
        ref={triggerRef}
        className={`menu-item menu-sub-trigger ${open ? "open" : ""}`}
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            setOpen(true);
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            setOpen(false);
          }
        }}
      >
        <span className="menu-item-label">{label}</span>
        <span className="menu-item-accel">
          <Icon name="chevron-right" size={11} />
        </span>
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            className="menu-dropdown menu-submenu"
            role="menu"
            style={{
              top: pos.top,
              left: pos.left,
              maxHeight: pos.maxHeight,
            }}
            onMouseEnter={enter}
            onMouseLeave={leave}
          >
            {children}
          </div>,
          document.body,
        )}
    </div>
  );
}

function MenuItem({
  label,
  accel,
  onClick,
}: {
  label: string;
  accel?: string;
  onClick: () => void;
}) {
  return (
    <button className="menu-item" role="menuitem" onClick={onClick}>
      <span className="menu-item-label">{label}</span>
      {accel && <span className="menu-item-accel">{accel}</span>}
    </button>
  );
}

function MenuSeparator() {
  return <div className="menu-separator" role="separator" />;
}

interface TopBarProps {
  onOpenPalette: () => void;
}

export function TopBar({ onOpenPalette }: TopBarProps) {
  const [menu, setMenu] = useState<string | null>(null);
  const [theme, setTheme] = useTheme();
  const [maximized, setMaximized] = useState(false);
  const agentMode = useAgentMode();

  const closeMenu = () => setMenu(null);
  const toggleMenu = (k: string) => setMenu((cur) => (cur === k ? null : k));
  // Hover only SWITCHES between menus once one is open — it never opens
  // the first one (that's still a click), matching native menubars.
  const hoverMenu = (k: string) =>
    setMenu((cur) => (cur !== null && cur !== k ? k : cur));

  useEffect(() => {
    let unl: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        const win = getCurrentWindow();
        const update = async () => {
          try {
            const m = await win.isMaximized();
            if (!cancelled) setMaximized(m);
          } catch {
            /* ignore */
          }
        };
        await update();
        unl = await win.onResized(() => void update());
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
      unl?.();
    };
  }, []);

  useEffect(() => {
    if (!menu) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [menu]);

  const renderCategoryItems = (cat: CommandSpec["category"]) =>
    commandsForCategory(cat).map((cmd) => (
      <MenuItem
        key={cmd.id}
        label={cmd.label}
        accel={cmd.accel}
        onClick={() => {
          closeMenu();
          void cmd.run();
        }}
      />
    ));

  // Render specific registry commands by id, in the given order. The
  // grouped menus below are hand-curated id lists (a flat category dump
  // had grown to ~30 rows for View); pulling from the registry keeps
  // labels/accels in sync with the palette. Unknown ids are skipped so
  // a renamed command degrades to a missing row, not a crash.
  const commandById = useMemo(
    () => new Map(commands.map((c) => [c.id, c])),
    [],
  );
  const itemsFor = (ids: string[]) =>
    ids.map((id) => {
      const cmd = commandById.get(id);
      if (!cmd) return null;
      return (
        <MenuItem
          key={cmd.id}
          label={cmd.label}
          accel={cmd.accel}
          onClick={() => {
            closeMenu();
            void cmd.run();
          }}
        />
      );
    });

  // Every View command placed in a curated group below. Anything in the
  // View category but NOT in this set renders in a trailing "More"
  // section, so newly-registered commands stay reachable from the menu
  // without anyone remembering to update this file.
  const groupedViewIds = new Set([
    "view.quick_open",
    "view.goto_symbol",
    "view.search",
    "view.search_palette",
    "view.files",
    "view.source_control",
    "view.ai",
    "view.tasks",
    "view.todos",
    "view.notifications",
    "view.footprint",
    "view.close_tab",
    "view.next_tab",
    "view.prev_tab",
    "view.sort_tabs_alpha",
    "view.sort_tabs_recent",
    "view.reveal_in_tree",
    "edit.toggle_word_wrap",
    "view.toggle_minimap",
    "view.zoom_in",
    "view.zoom_out",
    "view.zoom_reset",
    "view.toggle_sidebar",
    "view.toggle_panel",
    "view.toggle_zen",
    "view.toggle_agent",
    "view.settings",
    "view.settings_ai_providers",
    "view.settings_ai_privacy",
    "view.reload",
  ]);
  const ungroupedView = commandsForCategory("View").filter(
    (c) => !groupedViewIds.has(c.id),
  );

  const themes: {
    mode: ThemeMode;
    label: string;
    icon: "sun" | "moon" | "monitor";
  }[] = [
    { mode: "light", label: "Light", icon: "sun" },
    { mode: "dark", label: "Dark", icon: "moon" },
    { mode: "system", label: "System", icon: "monitor" },
  ];

  const minimize = async () => {
    try {
      await getCurrentWindow().minimize();
    } catch {
      /* ignore */
    }
  };
  const toggleMaximize = async () => {
    try {
      await getCurrentWindow().toggleMaximize();
    } catch {
      /* ignore */
    }
  };
  const closeWindow = async () => {
    // The dirty-file guard lives in App.tsx's onCloseRequested handler
    // now, so it also covers Alt+F4 / taskbar close — close() here
    // routes through the same single confirm.
    try {
      await getCurrentWindow().close();
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="topbar" data-tauri-drag-region>
      {/* macOS moves the menubar into the native system menu bar (see
          nativeMenu.ts), so the in-window brand + menus + palette are
          hidden there — the titlebar is just a drag region + Agents. */}
      <div className="topbar-brand" data-tauri-drag-region>
        <span>Quack</span>
      </div>

      {!IS_MACOS && (
      <div className="topbar-menus" data-tauri-drag-region={false}>
        <MenuButton
          label="File"
          open={menu === "file"}
          onToggle={() => toggleMenu("file")}
          onClose={closeMenu}
          onHover={() => hoverMenu("file")}
        >
          {renderCategoryItems("File")}
          <MenuSeparator />
          {itemsFor(["workspace.open_recent"])}
        </MenuButton>

        <MenuButton
          label="Edit"
          open={menu === "edit"}
          onToggle={() => toggleMenu("edit")}
          onClose={closeMenu}
          onHover={() => hoverMenu("edit")}
        >
          <MenuItem
            label="Undo"
            accel="Ctrl+Z"
            onClick={() => {
              closeMenu();
              runEditAction("undo", () => document.execCommand("undo"));
            }}
          />
          <MenuItem
            label="Redo"
            accel="Ctrl+Y"
            onClick={() => {
              closeMenu();
              runEditAction("redo", () => document.execCommand("redo"));
            }}
          />
          <MenuSeparator />
          <MenuItem
            label="Cut"
            accel="Ctrl+X"
            onClick={() => {
              closeMenu();
              // Monaco emits the platform-native cut path via the
              // editor.action.clipboardCutAction id; falls back to
              // execCommand for plain inputs/textareas.
              runEditAction("editor.action.clipboardCutAction", () =>
                document.execCommand("cut"),
              );
            }}
          />
          <MenuItem
            label="Copy"
            accel="Ctrl+C"
            onClick={() => {
              closeMenu();
              runEditAction("editor.action.clipboardCopyAction", () =>
                document.execCommand("copy"),
              );
            }}
          />
          <MenuItem
            label="Paste"
            accel="Ctrl+V"
            onClick={() => {
              closeMenu();
              runEditAction("editor.action.clipboardPasteAction", () =>
                document.execCommand("paste"),
              );
            }}
          />
          <MenuItem
            label="Select All"
            accel="Ctrl+A"
            onClick={() => {
              closeMenu();
              runEditAction("editor.action.selectAll", () =>
                document.execCommand("selectAll"),
              );
            }}
          />
          <MenuSeparator />
          {/* Registry Edit commands — previously palette-only; the
              menu stopped at clipboard ops. */}
          {itemsFor([
            "edit.find_in_file",
            "edit.replace_in_file",
            "edit.goto_line",
            "edit.goto_symbol",
          ])}
          <MenuSeparator />
          {itemsFor(["edit.format_document", "edit.reopen_closed_tab"])}
          <SubMenu label="Folding">
            {itemsFor([
              "edit.fold",
              "edit.unfold",
              "edit.fold_all",
              "edit.unfold_all",
            ])}
          </SubMenu>
          <SubMenu label="Compare">
            {itemsFor([
              "edit.compare_with_clipboard",
              "edit.compare_with_file",
            ])}
          </SubMenu>
        </MenuButton>

        <MenuButton
          label="View"
          open={menu === "view"}
          onToggle={() => toggleMenu("view")}
          onClose={closeMenu}
          onHover={() => hoverMenu("view")}
        >
          {itemsFor([
            "view.quick_open",
            "view.goto_symbol",
            "view.search",
            "view.search_palette",
          ])}
          <MenuSeparator />
          <SubMenu label="Panels">
            {itemsFor([
              "view.files",
              "view.source_control",
              "view.ai",
              "view.tasks",
              "view.todos",
              "view.notifications",
              "view.footprint",
            ])}
          </SubMenu>
          <SubMenu label="Tabs">
            {itemsFor([
              "view.close_tab",
              "view.next_tab",
              "view.prev_tab",
              "view.reveal_in_tree",
              "view.sort_tabs_alpha",
              "view.sort_tabs_recent",
            ])}
          </SubMenu>
          <SubMenu label="Editor">
            {itemsFor(["edit.toggle_word_wrap", "view.toggle_minimap"])}
          </SubMenu>
          <SubMenu label="Zoom">
            {itemsFor(["view.zoom_in", "view.zoom_out", "view.zoom_reset"])}
          </SubMenu>
          <MenuSeparator />
          {itemsFor([
            "view.toggle_sidebar",
            "view.toggle_panel",
            "view.toggle_zen",
            "view.toggle_agent",
          ])}
          {ungroupedView.length > 0 && (
            <>
              <MenuSeparator />
              {ungroupedView.map((cmd) => (
                <MenuItem
                  key={cmd.id}
                  label={cmd.label}
                  accel={cmd.accel}
                  onClick={() => {
                    closeMenu();
                    void cmd.run();
                  }}
                />
              ))}
            </>
          )}
          <MenuSeparator />
          <SubMenu label="Theme">
            {themes.map((t) => (
              <button
                key={t.mode}
                className="menu-item topbar-theme-item"
                role="menuitem"
                onClick={() => {
                  closeMenu();
                  setTheme(t.mode);
                }}
              >
                <span className="menu-item-label topbar-theme-label">
                  <Icon name={t.icon} size={12} />
                  {t.label}
                </span>
                {theme === t.mode && (
                  <span className="menu-item-accel">
                    <Icon name="check" size={11} />
                  </span>
                )}
              </button>
            ))}
          </SubMenu>
          <SubMenu label="Settings">
            {itemsFor([
              "view.settings",
              "view.settings_ai_providers",
              "view.settings_ai_privacy",
            ])}
          </SubMenu>
          <MenuSeparator />
          {itemsFor(["view.reload"])}
        </MenuButton>

        <MenuButton
          label="Terminal"
          open={menu === "terminal"}
          onToggle={() => toggleMenu("terminal")}
          onClose={closeMenu}
          onHover={() => hoverMenu("terminal")}
        >
          {renderCategoryItems("Terminal")}
        </MenuButton>

        <MenuButton
          label="AI"
          open={menu === "ai"}
          onToggle={() => toggleMenu("ai")}
          onClose={closeMenu}
          onHover={() => hoverMenu("ai")}
        >
          {renderCategoryItems("AI")}
        </MenuButton>

        <MenuButton
          label="Help"
          open={menu === "help"}
          onToggle={() => toggleMenu("help")}
          onClose={closeMenu}
          onHover={() => hoverMenu("help")}
        >
          {renderCategoryItems("Help")}
        </MenuButton>
      </div>
      )}

      <div className="topbar-spacer" data-tauri-drag-region />

      <button
        className={`topbar-agent-toggle ${agentMode ? "active" : ""}`}
        onClick={() => toggleAgentMode()}
        title={
          agentMode
            ? "Switch back to the editor layout (Ctrl+Shift+A)"
            : "Switch to Agent Mode — sessions, chat & changes (Ctrl+Shift+A)"
        }
        aria-pressed={agentMode}
        data-tauri-drag-region={false}
      >
        <AIIcon size={13} />
        <span className="topbar-agent-toggle-label">Agents</span>
      </button>

      <button
          className="topbar-search"
          onClick={onOpenPalette}
          title="Command palette (Ctrl+P)"
          data-tauri-drag-region={false}
        >
          <span className="topbar-search-icon">
            <Icon name="command" size={12} />
          </span>
          <span className="topbar-search-text">
            Search commands & workspaces
          </span>
          <span className="topbar-search-kbd">{IS_MACOS ? "⌘P" : "Ctrl+P"}</span>
        </button>

      <div className="window-controls" data-tauri-drag-region={false}>
        <button
          className="winctl"
          title="Minimize"
          onClick={() => void minimize()}
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <rect x="0" y="4.5" width="10" height="1" fill="currentColor" />
          </svg>
        </button>
        <button
          className="winctl"
          title={maximized ? "Restore" : "Maximize"}
          onClick={() => void toggleMaximize()}
        >
          {maximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect
                x="0.5"
                y="2.5"
                width="7"
                height="7"
                fill="none"
                stroke="currentColor"
              />
              <rect
                x="2.5"
                y="0.5"
                width="7"
                height="7"
                fill="none"
                stroke="currentColor"
              />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect
                x="0.5"
                y="0.5"
                width="9"
                height="9"
                fill="none"
                stroke="currentColor"
              />
            </svg>
          )}
        </button>
        <button
          className="winctl winctl-close"
          title="Close"
          onClick={() => void closeWindow()}
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line
              x1="0"
              y1="0"
              x2="10"
              y2="10"
              stroke="currentColor"
              strokeWidth="1.2"
            />
            <line
              x1="10"
              y1="0"
              x2="0"
              y2="10"
              stroke="currentColor"
              strokeWidth="1.2"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
