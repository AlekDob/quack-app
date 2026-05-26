import { useFileAttributionStore } from '../stores/fileAttributionStore';
import { getAvatarUrl, getDuckdroidUrl } from '../utils/agentAvatars';
import './ChangesPanel.css';

const MAX_VISIBLE_AVATARS = 3;

interface Props {
  filePath: string;
}

function formatRelativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const min = Math.round(diffMs / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export default function FileAttributionAvatars({ filePath }: Props) {
  const entries = useFileAttributionStore(s => s.byPath.get(filePath));
  if (!entries || entries.size === 0) return null;

  const list = Array.from(entries.values()).sort((a, b) => b.lastTs - a.lastTs);
  const visible = list.slice(0, MAX_VISIBLE_AVATARS);
  const overflow = list.length - visible.length;

  return (
    <div className="changes-file-avatars" aria-label={`Modified by ${list.length} agent session(s)`}>
      {visible.map(e => (
        <img
          key={e.sessionId}
          className="changes-file-avatar"
          src={e.agentAvatar ? getAvatarUrl(e.agentAvatar) : getDuckdroidUrl()}
          alt={e.agentName}
          title={`${e.agentName} · ${e.editCount} edit${e.editCount !== 1 ? 's' : ''} · ${formatRelativeTime(e.lastTs)}`}
          loading="lazy"
        />
      ))}
      {overflow > 0 && (
        <span
          className="changes-file-avatars-more"
          title={list.slice(MAX_VISIBLE_AVATARS).map(e => e.agentName).join(', ')}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
