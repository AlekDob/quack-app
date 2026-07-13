import { Icon } from "./Icon";
import { MarkdownPreview } from "./MarkdownPreview";
import { useUserBarSticky } from "../hooks/useUserBarSticky";
import { userMessageDisplayText } from "../imageAttach";

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

function UserMessageImageDeck({
  images,
  onImageClick,
}: {
  images: ChatImage[];
  onImageClick: (img: ChatImage) => void;
}) {
  return (
    <div
      className="ai-user-msg-images"
      aria-label={`${images.length} attached image${images.length === 1 ? "" : "s"}`}
      data-count={images.length}
    >
      {images.map((img, idx) =>
        img.thumb ? (
          <button
            key={`${img.path}:${idx}`}
            type="button"
            className="ai-user-msg-image"
            style={{ "--fan-index": idx } as React.CSSProperties}
            title={img.name}
            aria-label={img.name}
            onClick={() => onImageClick(img)}
          >
            <img src={img.thumb} alt="" />
          </button>
        ) : (
          <span
            key={`${img.path}:${idx}`}
            className="ai-user-msg-image ai-user-msg-image--placeholder"
            style={{ "--fan-index": idx } as React.CSSProperties}
            title={img.name}
            aria-hidden
          >
            <Icon name="image" size={12} />
          </span>
        ),
      )}
    </div>
  );
}

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
  const imageCount = images?.length ?? 0;
  const displayText = userMessageDisplayText(content, imageCount);
  const barClass = [
    "ai-user-bar",
    imageCount > 0 ? "has-images" : "",
    isCompact ? "is-compact" : "",
    expanded ? "is-expanded" : "",
    canToggle ? "is-stuck" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={barClass}>
      <div ref={mainRef} className="ai-user-bar-main">
        {displayText ? <MarkdownPreview content={displayText} /> : null}
      </div>
      <div className="ai-user-bar-aside">
        {imageCount > 0 && images && (
          <UserMessageImageDeck
            images={images}
            onImageClick={barProps.onImageClick}
          />
        )}
        <UserBarActions
          {...barProps}
          canToggle={canToggle}
          expanded={expanded}
          onToggleExpand={toggleExpanded}
        />
      </div>
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
  const sticky = useUserBarSticky(content);

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
        <UserMessageBarInner
          content={content}
          images={images}
          sticky={sticky}
          {...barProps}
        />
      </div>
    </>
  );
}

export function UserMessageBar(props: BarProps) {
  const sticky = useUserBarSticky(props.content);
  return <UserMessageBarInner {...props} sticky={sticky} />;
}
