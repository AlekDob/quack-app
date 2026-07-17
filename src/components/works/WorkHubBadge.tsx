// Cheap rail badge from chat metadata only — no feature/works hydrate.
// Feature rows stay short ("Feature") so the chat title remains readable;
// full label lives in the tooltip.

type Props = {
  workItemId?: string;
  storyId?: string;
  planning?: boolean;
  featureId?: string;
  featureLabel?: string;
};

export function WorkHubBadge({
  workItemId,
  storyId,
  planning,
  featureId,
  featureLabel,
}: Props) {
  if (!workItemId && !storyId && !featureId) return null;
  const label = planning
    ? "Plan"
    : featureId
      ? "Feature"
      : "Work";
  const tip =
    featureId && featureLabel
      ? featureLabel
      : featureId
        ? featureId
        : label;
  return (
    <span className="agent-hub-work-badge" title={tip}>
      {label}
    </span>
  );
}
