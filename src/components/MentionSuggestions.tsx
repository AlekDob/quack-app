import { basename, dirname } from "../pathUtils";
import { fileIconName } from "../fileIcons";
import type { SubagentDef } from "../subagents";
import type { WorkItem } from "../works";
import { Icon } from "./Icon";
import { MentionPathPreview } from "./MentionPathPreview";

export type MentionItem =
  | { type: "agent"; agent: SubagentDef }
  | { type: "file"; abs: string; rel: string }
  | { type: "work"; work: WorkItem };

type Props = {
  matches: MentionItem[];
  activeIndex: number;
  onPick: (item: MentionItem) => void;
  onHover: (index: number) => void;
};

export function MentionSuggestions({
  matches,
  activeIndex,
  onPick,
  onHover,
}: Props) {
  const active = matches[activeIndex];
  const previewFile = active?.type === "file" ? active : null;

  return (
    <div className="ai-mention-popover">
      <div className="ai-mention-list ai-slash-suggestions">
        {matches.map((m, i) => (
          <button
            key={
              m.type === "agent"
                ? `agent:${m.agent.name}`
                : m.type === "work"
                  ? `work:${m.work.id}`
                  : m.abs
            }
            type="button"
            className={`ai-slash-item ai-mention-item ${i === activeIndex ? "active" : ""}`}
            onMouseEnter={() => onHover(i)}
            onClick={() => onPick(m)}
          >
            {m.type === "agent" ? (
              <>
                <img
                  className="ai-mention-avatar"
                  src={m.agent.avatar}
                  alt=""
                  aria-hidden="true"
                />
                <span className="ai-slash-name">@{m.agent.name}</span>
                <span className="ai-slash-hint">
                  {m.agent.description
                    ? m.agent.description.slice(0, 60)
                    : `subagent · ${m.agent.source}`}
                </span>
              </>
            ) : m.type === "work" ? (
              <>
                <span className="ai-mention-file-icon">
                  <Icon name="check-square" size={14} />
                </span>
                <span className="ai-mention-file-label">
                  <span className="ai-mention-file-name">@{m.work.shortId}</span>
                  <span className="ai-mention-file-dir">{m.work.title}</span>
                </span>
              </>
            ) : (
              <>
                <span className="ai-mention-file-icon">
                  <Icon name={fileIconName(basename(m.rel))} size={14} />
                </span>
                <span className="ai-mention-file-label">
                  <span className="ai-mention-file-name">{basename(m.rel)}</span>
                  <span className="ai-mention-file-dir">{dirname(m.rel)}</span>
                </span>
              </>
            )}
          </button>
        ))}
      </div>
      {previewFile && <MentionPathPreview rel={previewFile.rel} />}
    </div>
  );
}
