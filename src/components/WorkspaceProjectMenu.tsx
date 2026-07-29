import { homeDir } from "@tauri-apps/api/path";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { addNewAIChat } from "../addNewAIChat";
import { fuzzyMatch, normalizeFilterQuery } from "../fuzzyMatch";
import { displayTildePath } from "../pathUtils";
import type { WorkspaceMeta } from "../ipc";
import { useStore } from "../store";
import {
  getWorkspaceColor,
  subscribeWorkspaceColors,
} from "../workspaceColors";
import { Icon } from "./Icon";

const RECENT_CAP = 20;

export type ChatAnchor = { x: number; y: number };

/** Open/switch to a workspace and start a new chat there. */
export async function createChatInProject(
  id: string,
  root: string,
  anchor: ChatAnchor,
  onNewChat?: (wsId: string, anchor: ChatAnchor) => void,
): Promise<void> {
  const { openIds, setActiveWorkspace, openWorkspace } = useStore.getState();
  if (openIds.includes(id)) {
    if (onNewChat) {
      onNewChat(id, anchor);
      return;
    }
    await setActiveWorkspace(id);
    addNewAIChat(id, "editor", anchor);
    return;
  }
  await openWorkspace(root);
  const targetId = useStore.getState().activeId;
  if (!targetId) return;
  if (onNewChat) onNewChat(targetId, anchor);
  else addNewAIChat(targetId, "editor", anchor);
}

export async function createChatFromFolderDialog(
  anchor: ChatAnchor,
  onNewChat?: (wsId: string, anchor: ChatAnchor) => void,
): Promise<void> {
  const sel = await openDialog({ directory: true, multiple: false });
  if (typeof sel !== "string") return;
  await useStore.getState().openWorkspace(sel);
  const targetId = useStore.getState().activeId;
  if (!targetId) return;
  if (onNewChat) onNewChat(targetId, anchor);
  else addNewAIChat(targetId, "editor", anchor);
}

export function useHomeDir(): string | null {
  const [home, setHome] = useState<string | null>(null);
  useEffect(() => {
    void homeDir()
      .then(setHome)
      .catch(() => setHome(null));
  }, []);
  return home;
}

/** Recents MRU by last_opened (most recent first). */
export function useRecentWorkspaces(cap = RECENT_CAP): WorkspaceMeta[] {
  const recent = useStore((s) => s.recent);
  return useMemo(
    () =>
      [...recent]
        .sort((a, b) => b.last_opened - a.last_opened)
        .slice(0, cap),
    [recent, cap],
  );
}

function useColorTick(): number {
  const [tick, setTick] = useState(0);
  useEffect(
    () => subscribeWorkspaceColors(() => setTick((n) => n + 1)),
    [],
  );
  return tick;
}

function matchesRecent(
  w: WorkspaceMeta,
  q: string,
  home: string | null,
): boolean {
  if (!q) return true;
  const path = displayTildePath(w.root, home);
  return (
    fuzzyMatch(q, w.name) || fuzzyMatch(q, path) || fuzzyMatch(q, w.root)
  );
}

interface MenuBodyProps {
  currentWsId: string;
  home: string | null;
  recents: WorkspaceMeta[];
  onPick: (id: string, root: string) => void;
  onOpenFolder: () => void;
  /** Show check on current project (composer). Hub new-chat may hide it. */
  showActiveCheck?: boolean;
  onClose?: () => void;
}

/** Search + Recents list (scroll) + Open folder… fixed at the bottom. */
export function WorkspaceProjectMenuBody({
  currentWsId,
  home,
  recents,
  onPick,
  onOpenFolder,
  showActiveCheck = true,
  onClose,
}: MenuBodyProps) {
  const colorTick = useColorTick();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => searchRef.current?.focus());
  }, []);

  const filtered = useMemo(() => {
    const q = normalizeFilterQuery(query);
    return recents.filter((w) => matchesRecent(w, q, home));
    // colorTick: re-render rows when a project color changes
  }, [recents, query, home, colorTick]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      if (query) setQuery("");
      else onClose?.();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(0, filtered.length - 1)));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter" && filtered[activeIndex]) {
      e.preventDefault();
      const w = filtered[activeIndex]!;
      onPick(w.id, w.root);
    }
  };

  const emptyLabel = query.trim()
    ? "No matching projects"
    : "No recent projects";

  return (
    <>
      <div className="ai-composer-ctx-menu-search">
        <Icon name="search" size={12} />
        <input
          ref={searchRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onSearchKey}
          placeholder="Search projects…"
          aria-label="Search projects"
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <div className="ai-composer-ctx-menu-scroll">
        {filtered.length > 0 && !query.trim() && (
          <div className="menu-section-title">Recents</div>
        )}
        {filtered.map((w, i) => (
          <RecentProjectRow
            key={w.id}
            w={w}
            home={home}
            active={w.id === currentWsId}
            highlighted={i === activeIndex}
            showActiveCheck={showActiveCheck}
            onPick={onPick}
            onHover={() => setActiveIndex(i)}
          />
        ))}
        {filtered.length === 0 && (
          <div className="ai-composer-ctx-menu-empty">{emptyLabel}</div>
        )}
      </div>
      <div className="ai-composer-ctx-menu-foot">
        <button
          type="button"
          className="menu-item ai-composer-ctx-open"
          onClick={onOpenFolder}
          role="menuitem"
        >
          <span className="menu-item-label">
            <Icon name="folder" size={11} />
            Open folder…
          </span>
        </button>
      </div>
    </>
  );
}

interface RecentRowProps {
  w: WorkspaceMeta;
  home: string | null;
  active: boolean;
  highlighted: boolean;
  showActiveCheck: boolean;
  onPick: (id: string, root: string) => void;
  onHover: () => void;
}

function RecentProjectRow({
  w,
  home,
  active,
  highlighted,
  showActiveCheck,
  onPick,
  onHover,
}: RecentRowProps) {
  const color = getWorkspaceColor(w.id);
  const folderStyle = color
    ? ({ "--ws-color": color.hex } as CSSProperties)
    : undefined;
  const cls = [
    "menu-item",
    active ? "active" : "",
    highlighted ? "is-highlight" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      type="button"
      className={cls}
      onClick={() => onPick(w.id, w.root)}
      onMouseEnter={onHover}
      title={w.root}
      role="menuitem"
    >
      <span className="menu-item-label">
        <span
          className={`ai-composer-ctx-folder${color ? " has-color" : ""}`}
          style={folderStyle}
        >
          <Icon name="folder" size={11} />
        </span>
        <span className="ai-composer-ctx-path">
          {displayTildePath(w.root, home)}
        </span>
      </span>
      {showActiveCheck && active && (
        <span className="menu-item-accel ai-composer-ctx-check">
          <Icon name="check" size={12} />
        </span>
      )}
    </button>
  );
}
