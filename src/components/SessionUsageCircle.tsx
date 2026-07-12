import { useRef, useState } from "react";
import { fmtTokenCount } from "../contextUsage";
import type { SessionUsageData } from "../sessionUsageLocal";
import { SessionUsagePopover } from "./SessionUsagePopover";
import { UsageRing } from "./UsageRing";

interface SessionUsageCircleProps {
  pct: number;
  contextPct: number;
  contextUsed: number;
  contextWindow: number;
  contextEstimate?: boolean;
  planPct?: number;
  planResetsIn?: string;
  data: SessionUsageData | null;
  root: string;
  onOpenDashboard: () => void;
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
  if (ctx) return `${ctx} — click for breakdown`;
  if (plan) return `${plan} — click for breakdown`;
  return "Context usage — click for breakdown";
}

export function SessionUsageCircle(props: SessionUsageCircleProps) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const tip = buildTip(props);
  const ring = Math.min(100, Math.max(0, props.pct));

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`session-circle-btn${open ? " open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        title={tip}
        aria-label={tip}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <UsageRing pct={ring} />
      </button>
      <SessionUsagePopover
        open={open}
        anchorRef={btnRef}
        data={props.data}
        root={props.root}
        onClose={() => setOpen(false)}
        onOpenDashboard={props.onOpenDashboard}
      />
    </>
  );
}
