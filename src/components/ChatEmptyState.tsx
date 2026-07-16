import { useEffect, useRef, useState } from "react";
import { AIIcon } from "./AIIcon";
import { useStore } from "../store";

const STARTERS = [
  {
    label: "Explain this code",
    desc: "Walk through what it does",
    prompt: "Explain what this file does, in simple terms.",
  },
  {
    label: "Find bugs",
    desc: "Spot logic errors and edge cases",
    prompt: "Are there bugs or logic errors in this file? Be specific.",
  },
  {
    label: "Suggest refactor",
    desc: "Improve readability or correctness",
    prompt:
      "Suggest a refactor that would improve readability or correctness. Show the proposed change.",
  },
  {
    label: "Write tests",
    desc: "Generate unit tests",
    prompt: "Suggest unit tests for the functions in this file.",
  },
  {
    label: "Add types",
    desc: "Improve type annotations",
    prompt: "Suggest type annotations or improvements to existing types.",
  },
  {
    label: "Summarize",
    desc: "Key responsibilities in 3–5 bullets",
    prompt: "Summarize the key responsibilities of this file in 3-5 bullets.",
  },
] as const;

type Props = {
  wsId: string;
  chatId?: string;
  onPickStarter: (prompt: string) => void;
};

/** Cursor-style empty chat — always-editable session label + starter grid. */
export function ChatEmptyState({ wsId, chatId, onPickStarter }: Props) {
  const chatTitle = useStore((s) =>
    chatId ? (s.loaded[wsId]?.aiChats[chatId]?.title ?? "") : "",
  );
  const namePending = useStore((s) =>
    chatId ? !!s.loaded[wsId]?.aiChats[chatId]?.namePending : false,
  );
  const renameAIChat = useStore((s) => s.renameAIChat);
  const setAIChatNamePending = useStore((s) => s.setAIChatNamePending);

  const [name, setName] = useState(chatTitle);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(chatTitle);
  }, [chatTitle]);

  // Fresh tab: focus + select once, then drop the flag (field stays visible).
  useEffect(() => {
    if (!chatId || !namePending) return;
    const t = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
      setAIChatNamePending(wsId, chatId, false);
    });
    return () => cancelAnimationFrame(t);
  }, [chatId, namePending, wsId, setAIChatNamePending]);

  const commitName = () => {
    if (!chatId) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === chatTitle) return;
    renameAIChat(wsId, chatId, trimmed);
  };

  return (
    <div className="ai-empty-hero">
      <div className="ai-empty-hero-mark" aria-hidden="true">
        <AIIcon size={28} />
      </div>
      {chatId ? (
        <div className="ai-empty-hero-name">
          <input
            ref={inputRef}
            className="ai-empty-hero-name-input"
            value={name}
            placeholder="Session name"
            aria-label="Session name"
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitName();
                inputRef.current?.blur();
              }
            }}
          />
        </div>
      ) : (
        <h2 className="ai-empty-hero-title">New session</h2>
      )}
      <p className="ai-empty-hero-lead">
        Ask anything about the active file — its contents are sent as context.
      </p>
      <div className="ai-empty-starters" role="list">
        {STARTERS.map((q) => (
          <button
            key={q.label}
            type="button"
            className="ai-empty-starter"
            role="listitem"
            onClick={() => onPickStarter(q.prompt)}
          >
            <span className="ai-empty-starter-label">{q.label}</span>
            <span className="ai-empty-starter-desc">{q.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
