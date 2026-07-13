// Per-workspace Pinky Brain auto-inject gate controls.

import type { ReactNode } from "react";
import {
  getBrainGatePrefs,
  setBrainGatePrefs,
  type BrainGatePrefs,
} from "../brainGates";

interface Props {
  wsId: string;
  injectOn: boolean;
  prefs: BrainGatePrefs;
  onPrefsChange: (next: BrainGatePrefs) => void;
}

export function BrainInjectGates({
  wsId,
  injectOn,
  prefs,
  onPrefsChange,
}: Props) {
  const patch = (p: Partial<BrainGatePrefs>) => {
    setBrainGatePrefs(wsId, p);
    onPrefsChange(getBrainGatePrefs(wsId));
  };

  return (
    <section className="brain-inject-gates">
      <p className="brain-inject-hint">
        Type <kbd>#</kbd> in chat to cite brain docs explicitly.
      </p>
      {injectOn && (
        <div className="brain-gate-rows">
          <GateRow
            label="Score gate"
            hint="Skip weak matches below min score"
            on={prefs.score.enabled}
            onToggle={() =>
              patch({ score: { ...prefs.score, enabled: !prefs.score.enabled } })
            }
          >
            <label className="brain-gate-field">
              <span className="brain-gate-field-label">Min</span>
              <input
                type="number"
                className="brain-gate-input"
                min={0}
                max={1}
                step={0.005}
                value={prefs.score.min}
                disabled={!prefs.score.enabled}
                onChange={(e) => {
                  const min = Number(e.target.value);
                  if (!Number.isFinite(min)) return;
                  patch({ score: { ...prefs.score, min } });
                }}
              />
            </label>
          </GateRow>
          <GateRow
            label="Intent gate"
            hint="Skip status updates and short confirmations"
            on={prefs.intent.enabled}
            onToggle={() =>
              patch({ intent: { enabled: !prefs.intent.enabled } })
            }
          />
          <GateRow
            label="Thread-aware query"
            hint="Search from recent user turns + current message"
            on={prefs.thread.enabled}
            onToggle={() =>
              patch({ thread: { ...prefs.thread, enabled: !prefs.thread.enabled } })
            }
          >
            <label className="brain-gate-field">
              <span className="brain-gate-field-label">Turns</span>
              <select
                className="brain-gate-select"
                value={prefs.thread.turns}
                disabled={!prefs.thread.enabled}
                onChange={(e) => {
                  const turns = Number(e.target.value);
                  patch({ thread: { ...prefs.thread, turns } });
                }}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </GateRow>
        </div>
      )}
    </section>
  );
}

function GateRow({
  label,
  hint,
  on,
  onToggle,
  children,
}: {
  label: string;
  hint: string;
  on: boolean;
  onToggle: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="brain-gate-row">
      <button
        type="button"
        className={`brain-pill brain-gate-pill${on ? " on" : ""}`}
        onClick={onToggle}
        title={hint}
      >
        {label} {on ? "ON" : "OFF"}
      </button>
      <span className="brain-gate-hint">{hint}</span>
      {children}
    </div>
  );
}
