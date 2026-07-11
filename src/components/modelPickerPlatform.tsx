import { Icon } from "./Icon";
import {
  crossPlatformSwitchHint,
  platformLabel,
} from "../chatPinnedProvider";
import type { ProviderId } from "../providers/types";

type BannerProps = {
  pinnedProviderId: ProviderId;
  showAllPlatforms: boolean;
  onShowAll: () => void;
  onLockAgain: () => void;
};

/** Cursor-style quiet banner above the model list when a chat is platform-pinned. */
export function ModelPickerPlatformBanner({
  pinnedProviderId,
  showAllPlatforms,
  onShowAll,
  onLockAgain,
}: BannerProps) {
  const name = platformLabel(pinnedProviderId);
  return (
    <div
      className={`model-picker-platform-banner${
        showAllPlatforms ? " is-warn" : ""
      }`}
    >
      <Icon name="info" size={12} className="model-picker-platform-icon" />
      <div className="model-picker-platform-copy">
        {showAllPlatforms ? (
          <p>
            Other platforms start a <strong>new CLI session</strong>. Tool
            context does not carry over — only the Quack transcript.
          </p>
        ) : (
          <p>
            This chat uses <strong>{name}</strong>. Models are limited to this
            platform.
          </p>
        )}
      </div>
      {showAllPlatforms ? (
        <button
          type="button"
          className="model-picker-platform-action"
          onClick={onLockAgain}
        >
          Lock to {name}
        </button>
      ) : (
        <button
          type="button"
          className="model-picker-platform-action"
          onClick={onShowAll}
        >
          Change platform…
        </button>
      )}
    </div>
  );
}

type ConfirmProps = {
  from: ProviderId;
  to: ProviderId;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ModelPickerPlatformConfirm({
  from,
  to,
  onConfirm,
  onCancel,
}: ConfirmProps) {
  return (
    <div className="model-picker-platform-confirm">
      <p>{crossPlatformSwitchHint(from, to)}</p>
      <div className="model-picker-platform-confirm-actions">
        <button
          type="button"
          className="model-picker-platform-cancel"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className="model-picker-platform-ok"
          onClick={onConfirm}
        >
          Switch to {platformLabel(to)}
        </button>
      </div>
    </div>
  );
}
