import { UsageRing } from "./UsageRing";
import { fmtTokenCount } from "../contextUsage";

interface SessionUsageCircleProps {
  /** Ring fill — context window % only. */
  pct: number;
  contextPct: number;
  contextUsed: number;
  contextWindow: number;
  contextEstimate?: boolean;
  planPct?: number;
  planResetsIn?: string;
  onClick: () => void;
}

function buildTip(props: SessionUsageCircleProps): string {
  const est = props.contextEstimate ? " (est.)" : "";
  const hasCtx = props.contextUsed > 0 || props.contextPct > 0;
  const ctx = hasCtx
    ? `Context ${props.contextPct}% · ${fmtTokenCount(props.contextUsed)} / ${fmtTokenCount(props.contextWindow)}${est}`
    : null;
  const plan =
    props.planPct && props.planPct > 0
      ? `Plan 5hr ${Math.round(props.planPct)}% · resets ${props.planResetsIn ?? "—"}`
      : null;
  if (ctx && plan) return `${ctx} · ${plan}`;
  if (ctx) return `${ctx} — click for details`;
  if (plan) return `${plan} — click for details`;
  return "Session usage — click for details";
}

export function SessionUsageCircle(props: SessionUsageCircleProps) {
  const tip = buildTip(props);
  const ring = Math.min(100, Math.max(0, props.pct));

  return (
    <button
      type="button"
      className="session-circle-btn"
      onClick={props.onClick}
      title={tip}
      aria-label={tip}
    >
      <UsageRing pct={ring} />
    </button>
  );
}
