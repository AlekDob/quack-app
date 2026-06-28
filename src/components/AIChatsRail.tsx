import { useRef, useState } from "react";
import {
  aiKey,
  findTabsPaneByTab,
  useStore,
  type WorkspaceData,
} from "../store";
import { AIIcon } from "./AIIcon";
import { Icon } from "./Icon";

interface Props {
  wsId: string;
  ws: WorkspaceData;
}

// Map a qualified model id like "claude-code:default" or "openai:gpt-4o"
// to a 2-char provider badge + tooltip-friendly model name.
function modelBadge(model: string | undefined): {
  short: string;
  className: string;
  full: string;
} {
  if (!model) return { short: "··", className: "badge-none", full: "No model selected" };
  const colon = model.indexOf(":");
  const provider = colon > 0 ? model.slice(0, colon) : model;
  const id = colon > 0 ? model.slice(colon + 1) : "";
  switch (provider) {
    case "claude-code":
      return { short: "CC", className: "badge-claude-code", full: `Claude Code · ${id || "default"}` };
    case "anthropic":
      return { short: "Cl", className: "badge-anthropic", full: `Anthropic API · ${id}` };
    case "openai":
      return { short: "AI", className: "badge-openai", full: `OpenAI · ${id}` };
    case "ollama":
      return { short: "OL", className: "badge-ollama", full: `Ollama · ${id}` };
    default:
      return { short: provider.slice(0, 2).toUpperCase(), className: "badge-other", full: model };
  }
}

export function AIChatsRail({ wsId, ws }: Props) {
  const setActiveTab = useStore((s) => s.setActiveTab);
  const addAIChat = useStore((s) => s.addAIChat);
  const closeAIChat = useStore((s) => s.closeAIChat);
  const reorderAIChat = useStore((s) => s.reorderAIChat);
  const setAIRailExpanded = useStore((s) => s.setAIRailExpanded);

  const chats = Object.values(ws.aiChats).sort(
    (a, b) => a.createdAt - b.createdAt,
  );
  const layout = ws.layout;
  const expanded = layout.aiRailExpanded;

  const [drag, setDrag] = useState<{
    id: string;
    target: string | "end" | null;
  } | null>(null);
  const dragRef = useRef<{ id: string; target: string | "end" | null } | null>(
    null,
  );

  let activeChatId: string | null = null;
  if (layout.activePaneId) {
    const visit = (p: typeof layout.editorRoot): string | null => {
      if (p.kind === "tabs") {
        if (p.id === layout.activePaneId && p.active?.startsWith("ai:")) {
          return p.active.slice(3);
        }
        return null;
      }
      return visit(p.first) ?? visit(p.second);
    };
    activeChatId = visit(layout.editorRoot);
    if (!activeChatId && layout.bottomRoot) {
      activeChatId = visit(layout.bottomRoot);
    }
  }

  const focusChat = (chatId: string) => {
    const k = aiKey(chatId);
    const editorPane = findTabsPaneByTab(layout.editorRoot, k);
    const bottomPane = layout.bottomRoot
      ? findTabsPaneByTab(layout.bottomRoot, k)
      : null;
    const pane = editorPane ?? bottomPane;
    if (!pane) {
      addAIChat(wsId, "editor");
      return;
    }
    setActiveTab(wsId, pane.id, k);
  };

  const onItemDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
    dragRef.current = { id, target: null };
    setDrag({ id, target: null });
  };

  const onItemDragOver = (e: React.DragEvent, overId: string) => {
    if (!dragRef.current) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const below = e.clientY > rect.top + rect.height / 2;
    const sortedIds = chats.map((c) => c.id);
    const overIdx = sortedIds.indexOf(overId);
    let target: string | "end" | null;
    if (below) {
      target = overIdx >= sortedIds.length - 1 ? "end" : sortedIds[overIdx + 1];
    } else {
      target = overId;
    }
    const fromIdx = sortedIds.indexOf(dragRef.current.id);
    const beforeIdx = target === "end" ? sortedIds.length : sortedIds.indexOf(target);
    if (fromIdx === beforeIdx || fromIdx + 1 === beforeIdx) {
      target = null;
    }
    if (dragRef.current.target !== target) {
      dragRef.current.target = target;
      setDrag({ id: dragRef.current.id, target });
    }
  };

  const onItemDrop = () => {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!d || d.target === null) return;
    const beforeId = d.target === "end" ? null : d.target;
    reorderAIChat(wsId, d.id, beforeId);
  };

  const onItemDragEnd = () => {
    dragRef.current = null;
    setDrag(null);
  };

  return (
    <div
      className={`ai-chats-rail ${expanded ? "expanded" : ""}`}
      data-rail-side={layout.sidebarSide === "left" ? "right" : "left"}
    >
      <div className="ai-chats-rail-header">
        <button
          className="ai-chats-rail-add"
          onClick={() => addAIChat(wsId, "editor")}
          title="New AI chat"
          aria-label="New AI chat"
        >
          {/* Avatar più grande da collassata (è l'unico elemento del bottone);
             resta 14px da espansa, dove affianca la label "New chat". */}
          <AIIcon size={expanded ? 14 : 22} />
          {/* Il "+" sovrapposto serve solo da collassata: da espansa la label "New chat" basta. */}
          {!expanded && (
            <span className="ai-chats-rail-plus" aria-hidden="true">
              <Icon name="plus" size={10} />
            </span>
          )}
          {expanded && <span className="ai-chats-rail-add-label">New chat</span>}
          {expanded && (
            <span className="ai-chats-rail-add-hint" aria-hidden="true">
              <Icon name="plus" size={12} />
            </span>
          )}
        </button>
        <button
          className="ai-chats-rail-toggle"
          onClick={() => setAIRailExpanded(wsId, !expanded)}
          title={expanded ? "Collapse rail" : "Expand rail to show chat titles"}
          aria-label={expanded ? "Collapse AI chat rail" : "Expand AI chat rail"}
          aria-expanded={expanded}
        >
          <Icon
            name={
              (expanded && layout.sidebarSide === "left") ||
              (!expanded && layout.sidebarSide !== "left")
                ? "chevron-right"
                : "chevron-left"
            }
            size={12}
          />
        </button>
      </div>
      <div className="ai-chats-rail-list" role="tablist" aria-label="AI chats">
        {chats.length === 0 &&
          (expanded ? (
            <div className="ai-chats-rail-empty" title="No AI chats yet">
              <AIIcon size={32} className="ai-chats-rail-empty-mark" />
              <span className="ai-chats-rail-empty-title">No chats yet</span>
              <span className="ai-chats-rail-empty-hint">
                Start a new one with the button above.
              </span>
            </div>
          ) : (
            <div className="ai-chats-rail-empty collapsed" title="No AI chats yet">
              ·
            </div>
          ))}
        {chats.map((chat) => {
          const isActive = chat.id === activeChatId;
          const isDragging = drag?.id === chat.id;
          const dropAbove = drag?.target === chat.id;
          const badge = modelBadge(chat.model);
          return (
            <div key={chat.id}>
              {dropAbove && <div className="ai-chats-rail-drop" />}
              <div
                className={`ai-chats-rail-item ${isActive ? "active" : ""} ${
                  isDragging ? "dragging" : ""
                }`}
                draggable
                role="tab"
                tabIndex={0}
                aria-selected={isActive}
                aria-label={`${chat.title} — ${badge.full}`}
                onDragStart={(e) => onItemDragStart(e, chat.id)}
                onDragOver={(e) => onItemDragOver(e, chat.id)}
                onDrop={onItemDrop}
                onDragEnd={onItemDragEnd}
                onClick={() => focusChat(chat.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    focusChat(chat.id);
                  } else if (
                    (e.key === "Delete" || e.key === "Backspace") &&
                    !e.repeat
                  ) {
                    e.preventDefault();
                    closeAIChat(wsId, chat.id);
                  }
                }}
                title={`${chat.title}\n${badge.full}`}
              >
                <span
                  className={`ai-chats-rail-badge ${badge.className}`}
                  aria-hidden="true"
                >
                  {badge.short}
                </span>
                {expanded && (
                  <span className="ai-chats-rail-item-title">
                    {chat.title}
                  </span>
                )}
                <button
                  className="ai-chats-rail-item-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeAIChat(wsId, chat.id);
                  }}
                  title="Close chat"
                  aria-label={`Close chat ${chat.title}`}
                >
                  <Icon name="x" size={10} />
                </button>
              </div>
            </div>
          );
        })}
        {drag?.target === "end" && <div className="ai-chats-rail-drop" />}
      </div>
    </div>
  );
}
