import { Icon } from "./Icon";
import { MarkdownPreview } from "./MarkdownPreview";
import { useUserBarSticky } from "../hooks/useUserBarSticky";

type ChatImage = { path: string; name: string; thumb: string };

type BarProps = {
  content: string;
  images?: ChatImage[];
  actionsDisabled: boolean;
  showBranch: boolean;
  onCopy: () => void;
  onRegen: () => void;
  onBranch: () => void;
  onImageClick: (img: ChatImage) => void;
};

type TurnProps = BarProps & {
  zIndex: number;
  anchorIdx: number;
  dimmed?: boolean;
};

type StickyState = ReturnType<typeof useUserBarSticky>;

function UserBarActions({
  actionsDisabled,
  showBranch,
  canToggle,
  expanded,
  onToggleExpand,
  onCopy,
  onRegen,
  onBranch,
}: Omit<BarProps, "content" | "images" | "onImageClick"> & {
  canToggle: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  return (
    <div className="ai-user-bar-actions">
      {canToggle && (
        <button
          type="button"
          className="ai-user-bar-btn ai-user-bar-expand"
          title={expanded ? "Collapse prompt" : "Expand prompt"}
          aria-label={expanded ? "Collapse prompt" : "Expand prompt"}
          aria-expanded={expanded}
          onClick={onToggleExpand}
        >
          <Icon name={expanded ? "chevron-up" : "chevron-down"} size={12} />
        </button>
      )}
      <button
        type="button"
        className="ai-user-bar-btn"
        title="Copy message"
        aria-label="Copy message"
        onClick={onCopy}
      >
        <Icon name="copy" size={12} />
      </button>
      <button
        type="button"
        className="ai-user-bar-btn"
        title="Re-send — wipes everything below"
        aria-label="Re-send this message"
        onClick={onRegen}
        disabled={actionsDisabled}
      >
        <Icon name="refresh" size={12} />
      </button>
      {showBranch && (
        <button
          type="button"
          className="ai-user-bar-btn"
          title="Branch from here"
          aria-label="Branch from this message"
          onClick={onBranch}
          disabled={actionsDisabled}
        >
          <Icon name="branch" size={12} />
        </button>
      )}
    </div>
  );
}

function UserMessageBarInner({
  content,
  images,
  sticky,
  ...barProps
}: BarProps & { sticky: StickyState }) {
  const { mainRef, isCompact, canToggle, expanded, toggleExpanded } = sticky;
  const barClass = [
    "ai-user-bar",
    isCompact ? "is-compact" : "",
    expanded ? "is-expanded" : "",
    canToggle ? "is-stuck" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={barClass}>
      <div ref={mainRef} className="ai-user-bar-main">
        {images && images.length > 0 && (
          <div className="ai-msg-images">
            {images.map((img, idx) => (
              <img
                key={idx}
                className="ai-msg-image"
                src={img.thumb}
                alt={img.name}
                title={img.name}
                onClick={() => barProps.onImageClick(img)}
              />
            ))}
          </div>
        )}
        <MarkdownPreview content={content} />
      </div>
      <UserBarActions
        {...barProps}
        canToggle={canToggle}
        expanded={expanded}
        onToggleExpand={toggleExpanded}
      />
    </div>
  );
}

/** Sentinel + sticky wrapper + bar — one turn's user prompt. */
export function UserTurnBar({
  zIndex,
  anchorIdx,
  dimmed,
  content,
  images,
  ...barProps
}: TurnProps) {
  const sticky = useUserBarSticky(content, images?.length ?? 0);

  return (
    <>
      <div ref={sticky.sentinelRef} className="ai-user-bar-sentinel" aria-hidden />
      <div
        className={`ai-msg ai-msg-user${dimmed ? " ai-msg-scrubbed-past" : ""}`}
        style={{ zIndex }}
        data-anchor-idx={anchorIdx}
        data-anchor-role="user"
        data-anchor-preview={content.slice(0, 120)}
      >
        <UserMessageBarInner content={content} sticky={sticky} {...barProps} />
      </div>
    </>
  );
}

export function UserMessageBar(props: BarProps) {
  const sticky = useUserBarSticky(props.content, props.images?.length ?? 0);
  return <UserMessageBarInner {...props} sticky={sticky} />;
}
