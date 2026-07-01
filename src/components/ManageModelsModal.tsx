import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useModalFocus } from "../useModalFocus";
import { Icon } from "./Icon";
import {
  buildModelGroups,
  type ProviderGroup,
} from "../modelSelectorUtils";
import {
  isModelEnabled,
  modelKey,
  toggleModelEnabled,
} from "../modelPrefs";
import type { ProviderId, ProviderModel } from "../providers/types";

interface Props {
  open: boolean;
  onClose: () => void;
  cloudModels: ProviderModel[];
  ollamaModels: ProviderModel[];
  hasKey: Record<ProviderId, boolean>;
  onConfigureProviders: () => void;
}

export function ManageModelsModal({
  open,
  onClose,
  cloudModels,
  ollamaModels,
  hasKey,
  onConfigureProviders,
}: Props) {
  const [query, setQuery] = useState("");
  const [prefsTick, setPrefsTick] = useState(0);
  const modalRef = useRef<HTMLDivElement | null>(null);
  useModalFocus(modalRef, open);

  const groups = useMemo(
    () => buildModelGroups(cloudModels, ollamaModels, hasKey),
    [cloudModels, ollamaModels, hasKey],
  );

  const filtered = useMemo(() => {
    void prefsTick;
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        models: g.models.filter(
          (m) =>
            m.modelId.toLowerCase().includes(q) ||
            m.displayName.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.models.length > 0);
  }, [groups, query, prefsTick]);

  if (!open) return null;

  return createPortal(
    <div className="settings-backdrop" onMouseDown={onClose}>
      <div
        ref={modalRef}
        tabIndex={-1}
        className="model-browser liquid-glass manage-models-modal"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-models-title"
      >
        <div className="model-browser-head model-browser-head-stacked">
          <div>
            <span className="model-browser-title" id="manage-models-title">
              Manage models
            </span>
            <p className="model-browser-head-sub">
              Choose which models appear in the selector.
            </p>
          </div>
          <div className="model-browser-head-actions">
            <button
              type="button"
              className="model-browser-configure"
              onClick={onConfigureProviders}
            >
              <Icon name="plus" size={12} />
              Configure providers
            </button>
            <button
              type="button"
              className="settings-close"
              onClick={onClose}
              title="Close (Esc)"
              aria-label="Close manage models"
            >
              <Icon name="x" size={14} />
            </button>
          </div>
        </div>
        <div className="model-browser-toolbar">
          <input
            className="model-browser-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search models"
            autoFocus
          />
        </div>
        <div className="model-browser-list">
          {filtered.length === 0 ? (
            <p className="model-browser-empty">No models match.</p>
          ) : (
            filtered.map((group) => (
              <ManageGroup
                key={group.id}
                group={group}
                onToggle={() => setPrefsTick((n) => n + 1)}
              />
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ManageGroup({
  group,
  onToggle,
}: {
  group: ProviderGroup;
  onToggle: () => void;
}) {
  return (
    <div className="model-browser-section">
      <p className="model-browser-section-title">{group.name}</p>
      {group.models.map((model) => {
        const qualified = modelKey(model.providerId, model.modelId);
        const enabled = isModelEnabled(qualified);
        return (
          <div key={qualified} className="manage-models-row">
            <span className="manage-models-row-label">{model.displayName}</span>
            <button
              type="button"
              className={`settings-toggle ${enabled ? "on" : ""}`}
              role="switch"
              aria-checked={enabled}
              aria-label={`Show ${model.displayName} in selector`}
              onClick={() => {
                toggleModelEnabled(qualified);
                onToggle();
              }}
            >
              <span className="settings-toggle-knob" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
