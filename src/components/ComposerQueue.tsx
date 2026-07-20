import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import type { QueuedComposerMessage } from "../composerQueue";
import { queuePromptText } from "../composerQueue";

type Props = {
  messages: QueuedComposerMessage[];
  turnActive: boolean;
  /** Resolve agent avatar for a queued item (legacy → live session). */
  resolveAvatar: (msg: QueuedComposerMessage) => string | null;
  onSendNow: () => void;
  onMultitask: () => void;
  onRemove: (index: number) => void;
};

function previewText(text: string, max = 240): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max - 1)}…`;
}

function cardPreview(item: QueuedComposerMessage): string {
  const text = previewText(item.text);
  if (text) return text;
  const n = item.images?.length ?? 0;
  if (n === 1) return "1 image";
  if (n > 1) return `${n} images`;
  return "";
}

export function ComposerQueue({
  messages,
  turnActive,
  resolveAvatar,
  onSendNow,
  onMultitask,
  onRemove,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  if (messages.length === 0) return null;

  const count = messages.length;
  const label = count === 1 ? "1 Queued" : `${count} Queued`;

  return (
    <div className="ai-queue-stack" aria-live="polite">
      {messages.map((msg, i) => {
        const avatar = resolveAvatar(msg);
        return (
          <div
            key={`${i}:${queuePromptText(msg).slice(0, 24)}:${msg.images?.[0]?.id ?? ""}:${msg.presetId ?? ""}`}
            className="ai-queue-card"
          >
            {i === 0 && (
              <div className="ai-queue-card-head">
                <span className="ai-queue-badge">{label}</span>
                <span className="ai-queue-hint">
                  <kbd className="ai-queue-kbd" aria-hidden="true">
                    ↵
                  </kbd>
                  <span>to Send</span>
                </span>
                <div className="ai-queue-card-spacer" />
                {turnActive && (
                  <div className="ai-queue-menu-wrap" ref={menuRef}>
                    <button
                      type="button"
                      className="ai-queue-multitask-btn"
                      onClick={() => setMenuOpen((v) => !v)}
                      aria-expanded={menuOpen}
                      aria-haspopup="menu"
                    >
                      <span>Start Multitasking</span>
                      <Icon name="chevron-down" size={12} />
                    </button>
                    {menuOpen && (
                      <div className="ai-queue-menu" role="menu">
                        <button
                          type="button"
                          className="ai-queue-menu-item"
                          role="menuitem"
                          onClick={() => {
                            setMenuOpen(false);
                            onMultitask();
                          }}
                        >
                          <span className="ai-queue-menu-label">New chat</span>
                          <span className="ai-queue-menu-desc">
                            Send in parallel without stopping this turn
                          </span>
                        </button>
                        <button
                          type="button"
                          className="ai-queue-menu-item"
                          role="menuitem"
                          onClick={() => {
                            setMenuOpen(false);
                            onSendNow();
                          }}
                        >
                          <span className="ai-queue-menu-label">Send now</span>
                          <span className="ai-queue-menu-desc">
                            Stop the current turn and send next
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  className="ai-queue-remove"
                  onClick={() => onRemove(i)}
                  title="Remove from queue"
                  aria-label="Remove from queue"
                >
                  <Icon name="x" size={12} />
                </button>
              </div>
            )}
            <div className="ai-queue-body">
              <p className="ai-queue-text">{cardPreview(msg)}</p>
              {avatar ? (
                <img
                  className="ai-queue-agent-avatar ai-agent-avatar"
                  src={avatar}
                  alt=""
                  aria-hidden="true"
                />
              ) : null}
            </div>
            {msg.images && msg.images.length > 0 && (
              <div className="ai-queue-thumbs" aria-hidden="true">
                {msg.images.map((img) =>
                  img.thumb ? (
                    <img
                      key={img.id}
                      className="ai-queue-thumb"
                      src={img.thumb}
                      alt={img.name}
                    />
                  ) : (
                    <span
                      key={img.id}
                      className="ai-queue-thumb ai-queue-thumb--placeholder"
                    >
                      <Icon name="image" size={14} />
                    </span>
                  ),
                )}
              </div>
            )}
            {i > 0 && (
              <div className="ai-queue-card-foot">
                <button
                  type="button"
                  className="ai-queue-remove-inline"
                  onClick={() => onRemove(i)}
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
