// Settings → Providers section: lets the user map each abstract preset
// tier (reasoning/balanced/fast) to a concrete model for backends whose
// catalog is DISCOVERED LIVE (cursor-cli, opencode-cli) rather than
// shipped as a fixed list — capabilities.ts can only offer a "default"
// sentinel for those, which is why switching preset never changed the
// model on them. Persists to lcp.tierModelMap.v1 via presets/tierModelOverrides;
// resolvePresetConfigFor prefers this override over the static default.
import { useEffect, useState } from "react";
import {
  getProvider,
  makeQualifiedModel,
  parseQualifiedModel,
  type ProviderModel,
} from "../providers";
import {
  getTierModelOverrides,
  setTierModelOverride,
  type ModelTier,
} from "../presets";

type DynamicBackendId = "cursor-cli" | "opencode-cli";

const DYNAMIC_BACKENDS: { id: DynamicBackendId; label: string }[] = [
  { id: "cursor-cli", label: "Cursor CLI" },
  { id: "opencode-cli", label: "OpenCode" },
];

const TIERS: { id: ModelTier; label: string; hint: string }[] = [
  { id: "reasoning", label: "Reasoning", hint: "Debugger and other high-effort presets" },
  { id: "balanced", label: "Balanced", hint: "Builder, Reviewer, and Jack by default" },
  { id: "fast", label: "Fast", hint: "Reserved for quick/cheap presets" },
];

export function TierModelSettings() {
  return (
    <div className="settings-row settings-row-col">
      <div className="settings-row-hint">
        Cursor CLI and OpenCode discover their model list live, so Quack
        can't ship fixed model names for them. Map each tier below to a
        real model so switching agents (Milo/Nora/Vera) actually changes
        the model — otherwise these backends keep using their own default.
      </div>
      {DYNAMIC_BACKENDS.map((b) => (
        <BackendTierRow key={b.id} backendId={b.id} label={b.label} />
      ))}
    </div>
  );
}

function BackendTierRow({
  backendId,
  label,
}: {
  backendId: DynamicBackendId;
  label: string;
}) {
  const [models, setModels] = useState<ProviderModel[] | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    void getProvider(backendId)
      .listModels()
      .then((list) => {
        if (alive) setModels(list);
      })
      .catch(() => {
        if (alive) setModels([]);
      });
    return () => {
      alive = false;
    };
  }, [backendId]);

  const overrides = getTierModelOverrides(backendId);
  void tick; // re-read on every commit after setTierModelOverride bumps it

  return (
    <div className="settings-tier-backend">
      <div className="settings-tier-backend-label">{label}</div>
      {models === null ? (
        <div className="settings-row-hint">Loading models…</div>
      ) : models.length === 0 ? (
        <div className="settings-row-hint">
          No models found — is {label} installed and reachable?
        </div>
      ) : (
        TIERS.map((t) => (
          <label key={t.id} className="settings-tier-select-row">
            <span className="settings-tier-select-label" title={t.hint}>
              {t.label}
            </span>
            <select
              className="settings-select"
              value={parseQualifiedModel(overrides[t.id] ?? "")?.modelId ?? ""}
              onChange={(e) => {
                const modelId = e.target.value;
                setTierModelOverride(
                  backendId,
                  t.id,
                  modelId ? makeQualifiedModel(backendId, modelId) : null,
                );
                setTick((n) => n + 1);
              }}
            >
              <option value="">Use {label} default</option>
              {models.map((m) => (
                <option key={m.modelId} value={m.modelId}>
                  {m.displayName}
                </option>
              ))}
            </select>
          </label>
        ))
      )}
    </div>
  );
}
