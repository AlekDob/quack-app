import { Icon } from "./Icon";
import {
  getActivityBarView,
  type ActivityBarIconId,
} from "../activityBarViews";

interface Props {
  id: ActivityBarIconId;
  active: boolean;
  disabled?: boolean;
  gitChangeCount?: number;
  className?: string;
  onClick: () => void;
}

export function ActivityBarIconButton({
  id,
  active,
  disabled,
  gitChangeCount = 0,
  className = "",
  onClick,
}: Props) {
  const def = getActivityBarView(id);
  const gitActive = def.showGitBadge && gitChangeCount > 0;
  const gitTitle =
    def.id === "git" && gitChangeCount > 0
      ? `${def.title} — ${gitChangeCount} changed file${gitChangeCount === 1 ? "" : "s"}`
      : def.title;
  const gitLabel =
    def.id === "git" && gitChangeCount > 0
      ? `${def.label}, ${gitChangeCount} pending changes`
      : def.label;

  return (
    <button
      type="button"
      className={`activity-icon activity-icon--${def.kind} ${
        def.id === "git" ? "activity-icon--git" : ""
      }${gitActive ? " has-changes" : ""} ${active ? "active" : ""} ${className}`.trim()}
      title={gitTitle}
      aria-label={gitLabel}
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon name={def.icon} size={20} />
      {gitActive && (
        <span className="activity-badge" aria-hidden="true">
          {gitChangeCount > 99 ? "99+" : gitChangeCount}
        </span>
      )}
    </button>
  );
}
