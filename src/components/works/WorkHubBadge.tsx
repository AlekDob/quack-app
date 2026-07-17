// Cheap rail badge from chat metadata only — no works hydrate/subscribe.

type Props = {
  workItemId?: string;
  storyId?: string;
  planning?: boolean;
};

export function WorkHubBadge({ workItemId, storyId, planning }: Props) {
  if (!workItemId && !storyId) return null;
  const label = planning ? "Plan" : "Work";
  return (
    <span className="agent-hub-work-badge" title={label}>
      {label}
    </span>
  );
}
