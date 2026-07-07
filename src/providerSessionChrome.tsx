// Provider session id chip — copy + open interactive CLI in terminal.
// Surfaces the bridge between Quack chat ids and on-disk CLI session uuids.

import { Icon } from "./components/Icon";
import type { ChatSession } from "./chatHistory";
import { readProviderSessionIds } from "./providerSession";
import type { ProviderId } from "./providers/types";
import { info as toastInfo } from "./notify";
import { resumeProviderInTerminal } from "./providerSessionTerminal";

const PROVIDER_CHIP: Partial<Record<ProviderId, string>> = {
  "claude-code": "CC",
  "cursor-cli": "CU",
  "opencode-cli": "OC",
};

export function shortSessionId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}…`;
}

export function ccLinkedChatTitles(
  sessions: ChatSession[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const s of sessions) {
    const ccId = readProviderSessionIds(s)["claude-code"];
    if (ccId) map.set(ccId, s.title?.trim() || "Untitled chat");
  }
  return map;
}

interface ProviderSessionChipProps {
  providerId: ProviderId;
  sessionId: string;
  wsId: string;
  cwd: string;
}

export function ProviderSessionChip({
  providerId,
  sessionId,
  wsId,
  cwd,
}: ProviderSessionChipProps) {
  const label = PROVIDER_CHIP[providerId] ?? providerId;
  const canTerminal =
    providerId === "claude-code" || providerId === "cursor-cli";

  const copyId = () => {
    void navigator.clipboard.writeText(sessionId);
    toastInfo("Session id copied");
  };

  const openTerminal = () => {
    void resumeProviderInTerminal(wsId, cwd, providerId, sessionId);
  };

  return (
    <div className="ai-provider-session-wrap">
      <button
        type="button"
        className="ai-provider-session-chip"
        onClick={copyId}
        title={`${label} session ${sessionId} — click to copy`}
      >
        <span className="ai-provider-session-label">{label}</span>
        <code>{shortSessionId(sessionId)}</code>
        <Icon name="copy" size={11} />
      </button>
      {canTerminal && (
        <button
          type="button"
          className="ai-header-iconbtn ai-provider-session-term"
          onClick={openTerminal}
          title="Open this session in the bottom terminal (claude --resume)"
          aria-label="Open session in terminal"
        >
          <Icon name="terminal" size={13} />
        </button>
      )}
    </div>
  );
}
