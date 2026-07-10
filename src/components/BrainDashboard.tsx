// Empty-state dashboard for the Brain tab — animated charts + telemetry.

import { Icon } from "./Icon";
import type { PinkyTelemetry, PinkyValueStats } from "../pinky";
import type { BrainCumulative } from "../brainUsageStore";
import { openBrainDoc } from "../brainInject";
import { useCountUp } from "../hooks/useCountUp";
import {
  BrainAnimatedBars,
  BrainCoverageDonut,
  BrainSavingsGauge,
  BrainUsageSparkline,
} from "./brain/BrainCharts";

type Props = {
  wsId: string;
  root: string;
  value: PinkyValueStats | null;
  telemetry: PinkyTelemetry | null;
  cumulative: BrainCumulative;
  injectOn: boolean;
};

function topTypes(byType: Record<string, number>, limit = 8): [string, number][] {
  return Object.entries(byType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

export function BrainDashboard({
  wsId,
  root,
  value,
  telemetry,
  cumulative,
  injectOn,
}: Props) {
  const usage = value?.usage;
  const types = value ? topTypes(value.by_type) : [];
  const entries = value?.entries ?? 0;
  const neverUsed = value?.never_used ?? 0;
  const active = Math.max(entries - neverUsed, 0);
  const chunksN = useCountUp(value?.chunks ?? 0, 1100);

  const openPath = (rel: string) => {
    void openBrainDoc(wsId, root, rel);
  };

  const typeRows = types.map(([type, count]) => ({
    key: type,
    label: type,
    value: count,
  }));

  const retrievalRows =
    telemetry?.most_used.slice(0, 8).map((row) => ({
      key: row.path,
      label: row.title,
      value: row.count,
      meta: row.path,
    })) ?? [];

  const coveragePct =
    entries > 0 ? Math.round((active / entries) * 100) : 0;

  return (
    <div className="brain-dashboard">
      <div className="brain-dash-hero">
        {value && (
          <BrainCoverageDonut
            active={active}
            dormant={neverUsed}
            label={`${coveragePct}% of indexed docs have been retrieved`}
            sublabel={`${chunksN.toLocaleString()} searchable chunks`}
          />
        )}
        {usage && (
          <BrainUsageSparkline
            hits={usage.hits}
            served={usage.served_entries}
            sessions={usage.sessions}
            usefulHits={usage.useful_hits}
          />
        )}
        <BrainSavingsGauge
          turns={cumulative.turns}
          savedTokens={cumulative.savedTokens}
          savedMs={cumulative.savedMs}
        />
        {!cumulative.turns && (
          <div className="brain-chart-card brain-inject-hint">
            <h3 className="brain-dash-heading">Pre-turn inject</h3>
            <p className={`brain-inject-status${injectOn ? " on" : ""}`}>
              {injectOn ? "ON" : "OFF"}
            </p>
            <p className="brain-muted">
              Send a chat message to see token &amp; time savings vs Grep +
              Read tool loops.
            </p>
          </div>
        )}
      </div>

      {typeRows.length > 0 && (
        <BrainAnimatedBars title="By type" rows={typeRows} />
      )}

      {retrievalRows.length > 0 && (
        <BrainAnimatedBars
          title="Most retrieved"
          rows={retrievalRows}
          onRowClick={openPath}
        />
      )}

      <p className="brain-muted brain-dash-foot">
        <Icon name="brain" size={12} /> Local hybrid search (BM25 + vector).
        Charts animate on load; click a retrieval row to open the doc.
      </p>
    </div>
  );
}
