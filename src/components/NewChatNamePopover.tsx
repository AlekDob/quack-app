import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  closeNewChatNamePrompt,
  subscribeNewChatNamePrompt,
  type NewChatNameRequest,
} from "../newChatNamePrompt";
import { useStore } from "../store";

const POPOVER_W = 280;
const POPOVER_H = 148;
const PAD = 12;

function clampAnchor(anchor: { x: number; y: number }): {
  x: number;
  y: number;
} {
  const x = Math.max(
    PAD + POPOVER_W / 2,
    Math.min(anchor.x, window.innerWidth - PAD - POPOVER_W / 2),
  );
  const y = Math.min(anchor.y, window.innerHeight - POPOVER_H - PAD);
  return { x, y };
}

export function NewChatNamePopover() {
  const [req, setReq] = useState<NewChatNameRequest | null>(null);
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const renameAIChat = useStore((s) => s.renameAIChat);

  useEffect(() => subscribeNewChatNamePrompt(setReq), []);

  useEffect(() => {
    if (!req) return;
    setName("");
    const t = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => cancelAnimationFrame(t);
  }, [req]);

  useEffect(() => {
    if (!req) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeNewChatNamePrompt();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [req]);

  if (!req) return null;

  const pos = clampAnchor(req.anchor);

  const commit = () => {
    const trimmed = name.trim();
    if (trimmed) renameAIChat(req.wsId, req.chatId, trimmed);
    closeNewChatNamePrompt();
  };

  return createPortal(
    <>
      <div
        className="new-chat-name-overlay"
        onClick={() => closeNewChatNamePrompt()}
      />
      <div
        className="new-chat-name-popover liquid-glass"
        style={{ left: pos.x, top: pos.y }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-chat-name-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="new-chat-name-title" id="new-chat-name-title">
          Name this session
        </div>
        <p className="new-chat-name-hint">
          Pick a short label so you can spot it in the hub.
        </p>
        <input
          ref={inputRef}
          className="new-chat-name-input"
          value={name}
          placeholder="e.g. Refactor auth module"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
        />
        <div className="new-chat-name-actions">
          <button type="button" onClick={() => closeNewChatNamePrompt()}>
            Skip
          </button>
          <button type="button" className="primary" onClick={commit}>
            Start
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
