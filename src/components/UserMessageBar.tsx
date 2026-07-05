import { Icon } from "./Icon";
import { MarkdownPreview } from "./MarkdownPreview";

type ChatImage = { path: string; name: string; thumb: string };

type Props = {
  content: string;
  images?: ChatImage[];
  actionsDisabled: boolean;
  showBranch: boolean;
  onCopy: () => void;
  onRegen: () => void;
  onBranch: () => void;
  onImageClick: (img: ChatImage) => void;
};

function UserBarActions({
  actionsDisabled,
  showBranch,
  onCopy,
  onRegen,
  onBranch,
}: Pick<
  Props,
  "actionsDisabled" | "showBranch" | "onCopy" | "onRegen" | "onBranch"
>) {
  return (
    <div className="ai-user-bar-actions">
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

export function UserMessageBar({
  content,
  images,
  actionsDisabled,
  showBranch,
  onCopy,
  onRegen,
  onBranch,
  onImageClick,
}: Props) {
  return (
    <div className="ai-user-bar">
      <div className="ai-user-bar-main">
        {images && images.length > 0 && (
          <div className="ai-msg-images">
            {images.map((img, idx) => (
              <img
                key={idx}
                className="ai-msg-image"
                src={img.thumb}
                alt={img.name}
                title={img.name}
                onClick={() => onImageClick(img)}
              />
            ))}
          </div>
        )}
        <MarkdownPreview content={content} />
      </div>
      <UserBarActions
        actionsDisabled={actionsDisabled}
        showBranch={showBranch}
        onCopy={onCopy}
        onRegen={onRegen}
        onBranch={onBranch}
      />
    </div>
  );
}
