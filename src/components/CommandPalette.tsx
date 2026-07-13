import { useEffect, useMemo, useRef, useState } from "react";
import { commands, type CommandSpec } from "../actions";
import { useStore } from "../store";
import { search, type SymbolHit } from "../ipc";
import { setEditorGoto } from "../editorState";
import { relPath } from "../pathUtils";
import { recordCommand, scoreCommand } from "../commandHistory";
import { Icon } from "./Icon";
import { fuzzyMatch as fuzzy } from "../fuzzyMatch";

// Map a result's category to a leading icon (Cursor-style rows). Falls back
// to the generic command glyph for menu commands.
function iconForCategory(cat: string): Parameters<typeof Icon>[0]["name"] {
  const c = cat.toLowerCase();
  if (c.includes("workspace")) return "folder";
  if (c.includes("file")) return "file-text";
  if (c.includes("symbol")) return "code";
  if (c.includes("git")) return "git-branch";
  if (c.includes("search")) return "search";
  return "command";
}

interface PaletteEntry {
  key: string;
  label: string;
  hint?: string;
  category: string;
  run: () => void | Promise<void>;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /**
   * Optional initial query — used when the user opens the palette via a
   * specific shortcut that wants a particular mode (e.g. Ctrl+Shift+F
   * pre-fills "? " for text-search).
   */
  initialQuery?: string;
}

export function CommandPalette({ open, onClose, initialQuery }: Props) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const recent = useStore((s) => s.recent);
  const openIds = useStore((s) => s.openIds);
  const activeId = useStore((s) => s.activeId);
  const setActive = useStore((s) => s.setActiveWorkspace);
  const openWs = useStore((s) => s.openWorkspace);
  const ws = useStore((s) =>
    s.activeId ? s.loaded[s.activeId] : null,
  );

  const [files, setFiles] = useState<string[]>([]);
  const [textHits, setTextHits] = useState<
    { path: string; line: number; col: number; text: string }[]
  >([]);
  const [symbols, setSymbols] = useState<SymbolHit[]>([]);
  const [searching, setSearching] = useState(false);

  const trimmed = query.trimStart();
  const mode: "search" | "commands" | "symbols" | "default" =
    trimmed.startsWith("?")
      ? "search"
      : trimmed.startsWith(">")
        ? "commands"
        : trimmed.startsWith("@")
          ? "symbols"
          : "default";
  const subQuery =
    mode === "search" || mode === "commands" || mode === "symbols"
      ? trimmed.slice(1).trim()
      : trimmed;

  // On open: reset, focus, lazy-fetch files for current workspace.
  // Symbols are NOT fetched here — they're heavier (regex per file)
  // so we wait until the user actually types `@`. Once fetched they
  // stay in state until the palette closes, so subsequent edits to
  // the @ query filter the cached list instead of refetching.
  useEffect(() => {
    if (!open) return;
    setQuery(initialQuery ?? "");
    setIndex(0);
    setSymbols([]);
    requestAnimationFrame(() => inputRef.current?.focus());
    if (ws) {
      void search
        .listFiles(ws.meta.root, 5000)
        .then((list) => setFiles(list))
        .catch(() => setFiles([]));
    }
  }, [open, initialQuery, ws]);

  // Symbol scan triggered the first time the user enters @ mode in
  // this palette session. We deliberately don't refresh on every @
  // keystroke — symbol lists barely change between palette opens, and
  // the scan is the slowest IPC the palette makes.
  useEffect(() => {
    if (!open || mode !== "symbols" || !ws) return;
    if (symbols.length > 0) return;
    let cancelled = false;
    void search
      .findSymbols(ws.meta.root, 5000)
      .then((s) => {
        if (!cancelled) setSymbols(s);
      })
      .catch(() => {
        if (!cancelled) setSymbols([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, mode, ws, symbols.length]);

  // Debounced text search.
  useEffect(() => {
    if (!open || mode !== "search" || !ws) {
      setTextHits([]);
      setSearching(false);
      return;
    }
    if (subQuery.length < 1) {
      setTextHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const root = ws.meta.root;
    const handle = window.setTimeout(async () => {
      try {
        const hits = await search.searchText(root, subQuery, false, 200);
        setTextHits(hits);
      } catch {
        setTextHits([]);
      } finally {
        setSearching(false);
      }
    }, 220);
    return () => window.clearTimeout(handle);
  }, [open, mode, subQuery, ws]);

  const entries: PaletteEntry[] = useMemo(() => {
    if (!open) return [];
    const out: PaletteEntry[] = [];
    const wsRoot = ws?.meta.root;

    if (mode === "search") {
      for (const h of textHits) {
        out.push({
          key: `hit:${h.path}:${h.line}:${h.col}`,
          label: h.text.trim().slice(0, 200),
          hint: `${wsRoot ? relPath(h.path, wsRoot) : h.path}:${h.line}`,
          category: "Match",
          run: async () => {
            if (activeId) {
              await useStore.getState().openFile(activeId, h.path);
              setEditorGoto(h.line, h.col);
            }
          },
        });
      }
      return out;
    }

    if (mode === "symbols") {
      for (const s of symbols) {
        out.push({
          key: `sym:${s.path}:${s.line}:${s.name}`,
          label: s.name,
          hint: `${s.kind} · ${wsRoot ? relPath(s.path, wsRoot) : s.path}:${s.line}`,
          category: "Symbol",
          run: async () => {
            if (activeId) {
              await useStore.getState().openFile(activeId, s.path);
              setEditorGoto(s.line, 1);
            }
          },
        });
      }
      return out;
    }

    if (mode === "default" || mode === "commands") {
      if (mode === "default") {
        for (const id of openIds) {
          out.push({
            key: "switch:" + id,
            label: "Switch to workspace",
            hint: id === activeId ? "(active)" : id,
            category: "Workspace",
            run: () => void setActive(id),
          });
        }
        for (const w of recent) {
          if (openIds.includes(w.id)) continue;
          out.push({
            key: "open-recent:" + w.id,
            label: `Open recent: ${w.name}`,
            hint: w.root,
            category: "Workspace",
            run: () => void openWs(w.root),
          });
        }
        if (activeId && wsRoot) {
          for (const f of files) {
            out.push({
              key: "file:" + f,
              label: relPath(f, wsRoot),
              hint: undefined,
              category: "File",
              run: async () => {
                await useStore.getState().openFile(activeId, f);
              },
            });
          }
        }
      }
      // Sort commands by recency-weighted usage so the bits the user
      // touches every day rise to the top of the default-mode list.
      // Stable secondary sort on label keeps unseen commands in
      // alphabetical order rather than registration order.
      const sorted = [...(commands as CommandSpec[])].sort((a, b) => {
        const sb = scoreCommand(b.id) - scoreCommand(a.id);
        if (sb !== 0) return sb;
        return a.label.localeCompare(b.label);
      });
      for (const c of sorted) {
        out.push({
          key: c.id,
          label: c.label,
          // Descriptive `hint` wins over the keyboard shortcut so actions
          // like "Open Whiteboard" can advertise their purpose; commands
          // without a hint fall back to showing the accel.
          hint: c.hint ?? c.accel,
          category: c.category,
          run: c.run,
        });
      }
    }
    return out;
  }, [
    open,
    mode,
    textHits,
    symbols,
    files,
    openIds,
    recent,
    activeId,
    setActive,
    openWs,
    ws,
  ]);

  const filtered = useMemo(() => {
    if (mode === "search") return entries; // already filtered server-side
    if (!subQuery) return entries.slice(0, 200);
    return entries
      .filter(
        (e) =>
          fuzzy(subQuery, e.label) ||
          (e.hint && fuzzy(subQuery, e.hint)) ||
          fuzzy(subQuery, e.category),
      )
      .slice(0, 200);
  }, [entries, subQuery, mode]);

  useEffect(() => {
    if (index >= filtered.length) setIndex(0);
  }, [filtered, index]);

  // Keep the highlighted row visible as the user arrows through long
  // result lists (text-search hits, recent files, full command set).
  // Without this, ArrowDown past the visible window leaves the active
  // marker invisible and breaks the navigation feel.
  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    if (!list) return;
    const node = list.children[index] as HTMLElement | undefined;
    if (node) node.scrollIntoView({ block: "nearest" });
  }, [open, index]);

  if (!open) return null;

  const activate = (idx: number) => {
    const item = filtered[idx];
    if (!item) return;
    onClose();
    // Only command entries (registered via actions.ts) feed the
    // recency log — file/symbol/search hits are already keyed off
    // their own surfaces (recentFiles, etc.). Detect a command entry
    // by its key matching a registered id; cheap O(commands.length).
    if ((commands as CommandSpec[]).some((c) => c.id === item.key)) {
      recordCommand(item.key);
    }
    void item.run();
  };

  const placeholder =
    mode === "search"
      ? "Search file contents…"
      : mode === "commands"
        ? "Run a command…"
        : mode === "symbols"
          ? "Go to symbol — function / class / interface / type…"
          : "Type ? content,  > commands,  @ symbols,  or just a file/command name…";

  return (
    <>
      <div className="palette-backdrop" onMouseDown={onClose} />
      <div className="palette" role="dialog" aria-label="Command palette">
        <div className="palette-input-row">
          {mode !== "default" && (
            <span className={`palette-mode mode-${mode}`}>
              {mode === "search"
                ? "Search"
                : mode === "symbols"
                  ? "Symbol"
                  : "Command"}
            </span>
          )}
          <input
            ref={inputRef}
            className="palette-input"
            value={query}
            placeholder={placeholder}
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
            onKeyDown={(e) => {
              const last = Math.max(0, filtered.length - 1);
              if (e.key === "Escape") {
                onClose();
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                setIndex((i) => Math.min(last, i + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setIndex((i) => Math.max(0, i - 1));
              } else if (e.key === "PageDown") {
                e.preventDefault();
                setIndex((i) => Math.min(last, i + 10));
              } else if (e.key === "PageUp") {
                e.preventDefault();
                setIndex((i) => Math.max(0, i - 10));
              } else if (e.key === "Home") {
                e.preventDefault();
                setIndex(0);
              } else if (e.key === "End") {
                e.preventDefault();
                setIndex(last);
              } else if (e.key === "Enter") {
                e.preventDefault();
                activate(index);
              }
            }}
          />
        </div>
        {mode === "search" && (
          <div className="palette-status">
            {searching
              ? "Searching…"
              : subQuery
                ? `${textHits.length} match${textHits.length === 1 ? "" : "es"}`
                : "Type to search file contents"}
          </div>
        )}
        <div className="palette-list" ref={listRef}>
          {filtered.length === 0 && (
            <div className="palette-empty">
              {mode === "search" && subQuery && !searching
                ? "No matches"
                : mode === "search"
                  ? ""
                  : "No matches"}
            </div>
          )}
          {filtered.map((e, i) => (
            <button
              key={e.key}
              className={`palette-item ${i === index ? "active" : ""}`}
              onMouseEnter={() => setIndex(i)}
              onClick={() => activate(i)}
            >
              <span className="palette-item-icon" aria-hidden="true">
                <Icon name={iconForCategory(e.category)} size={15} />
              </span>
              <span className="palette-item-label">{e.label}</span>
              {e.hint && (
                <span className="palette-item-hint">{e.hint}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
