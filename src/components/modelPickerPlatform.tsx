import { platformLabel } from "../chatPinnedProvider";
import type { ProviderId } from "../providers/types";

type BannerProps = {
  pinnedProviderId: ProviderId;
  onNewChat: () => void;
};

/** One-line hint when a chat is locked to an agentic CLI platform. */
export function ModelPickerPlatformBanner({
  pinnedProviderId,
  onNewChat,
}: BannerProps) {
  const name = platformLabel(pinnedProviderId);
  return (
    <div className="model-picker-platform-banner">
      <p>
        <strong>{name}</strong> session — start a new chat to switch platform.
      </p>
      <button
        type="button"
        className="model-picker-platform-action"
        onClick={onNewChat}
      >
        New chat
      </button>
    </div>
  );
}
