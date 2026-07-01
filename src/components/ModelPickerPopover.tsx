import { useMemo, useRef, useState } from "react";
import { Icon } from "./Icon";
import {
  buildModelGroups,
  filterVisibleGroups,
  modelLabel,
  splitFavoriteModels,
} from "../modelSelectorUtils";
import {
  getFavoriteModels,
  isModelEnabled,
  modelKey,
} from "../modelPrefs";
import { ModelPickerRow } from "./ModelPickerRow";
import {
  makeQualifiedModel,
  parseQualifiedModel,
  type ProviderId,
  type ProviderModel,
} from "../providers/types";

interface Props {
  selectedQualified: string;
  dotColor?: string;
  onSelect: (qualified: string) => void;
  cloudModels: ProviderModel[];
  ollamaModels: ProviderModel[];
  hasKey: Record<ProviderId, boolean>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onConfigureProviders: () => void;
  /** Opens the full model catalog modal (Choose a model). */
  onOpenFullBrowser: () => void;
}

export function ModelPickerPopover({
  selectedQualified,
  dotColor,
  onSelect,
  cloudModels,
  ollamaModels,
  hasKey,
  open: openProp,
  onOpenChange,
  onConfigureProviders,
  onOpenFullBrowser,
}: Props) {
  const [openInternal, setOpenInternal] = useState(false);
  const open = openProp ?? openInternal;
  const setOpen = onOpenChange ?? setOpenInternal;
  const [query, setQuery] = useState("");
  const [prefsTick, setPrefsTick] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const allModels = useMemo(
    () => [...ollamaModels, ...cloudModels],
    [ollamaModels, cloudModels],
  );

  const groups = useMemo(
    () => buildModelGroups(cloudModels, ollamaModels, hasKey),
    [cloudModels, ollamaModels, hasKey],
  );

  const visible = useMemo(() => {
    void prefsTick;
    return filterVisibleGroups(groups, query, isModelEnabled);
  }, [groups, query, prefsTick]);

  const { favorites, groupsNoFav } = useMemo(() => {
    void prefsTick;
    return splitFavoriteModels(visible, getFavoriteModels());
  }, [visible, prefsTick]);

  const isEmpty = favorites.length === 0 && groupsNoFav.length === 0;
  const parsed = parseQualifiedModel(selectedQualified);
  const label = modelLabel(allModels, selectedQualified);

  const pick = (model: ProviderModel) => {
    onSelect(makeQualifiedModel(model.providerId, model.modelId));
    setOpen(false);
    setQuery("");
  };

  return (
    <>
      <div className="model-picker-wrap" ref={wrapRef}>
        <button
          type="button"
          className="ai-model-chip"
          onClick={() => setOpen(!open)}
          aria-haspopup="listbox"
          aria-expanded={open}
          title={
            selectedQualified
              ? `${label} — click to switch`
              : "Pick a model"
          }
        >
          {parsed ? (
            <>
              <span
                className="ai-model-dot"
                style={dotColor ? { background: dotColor } : undefined}
                aria-hidden="true"
              />
              <span className="ai-model-id">{parsed.modelId}</span>
            </>
          ) : (
            <span className="ai-model-btn-empty">Pick a model…</span>
          )}
          <span className="ai-model-btn-caret">▾</span>
        </button>
        {open && (
          <>
            <div
              className="ai-flag-menu-overlay"
              onClick={() => setOpen(false)}
            />
            <div className="model-picker-pop" role="listbox">
              <div className="model-picker-pop-head">
                <div className="model-picker-search-wrap">
                  <Icon name="search" size={14} />
                  <input
                    autoFocus
                    className="model-picker-search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search models"
                  />
                </div>
                <button
                  type="button"
                  className="model-picker-icon-btn"
                  title="Configure providers"
                  onClick={() => {
                    setOpen(false);
                    onConfigureProviders();
                  }}
                >
                  <Icon name="plus" size={14} />
                </button>
                <button
                  type="button"
                  className="model-picker-icon-btn"
                  title="Browse all models"
                  onClick={() => {
                    setOpen(false);
                    onOpenFullBrowser();
                  }}
                >
                  <Icon name="settings" size={14} />
                </button>
              </div>
              <div className="model-picker-scroll">
                {isEmpty && (
                  <p className="model-picker-empty">
                    No models available. Configure a provider or adjust filters
                    in Manage models.
                  </p>
                )}
                {favorites.length > 0 && (
                  <PickerSection
                    title="Favorites"
                    models={favorites}
                    selectedQualified={selectedQualified}
                    onPick={pick}
                    onFavoriteChange={() => setPrefsTick((n) => n + 1)}
                  />
                )}
                {groupsNoFav.map((group) => (
                  <PickerSection
                    key={group.id}
                    title={group.name}
                    models={group.models}
                    selectedQualified={selectedQualified}
                    onPick={pick}
                    onFavoriteChange={() => setPrefsTick((n) => n + 1)}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function PickerSection({
  title,
  models,
  selectedQualified,
  onPick,
  onFavoriteChange,
}: {
  title: string;
  models: ProviderModel[];
  selectedQualified: string;
  onPick: (model: ProviderModel) => void;
  onFavoriteChange: () => void;
}) {
  return (
    <div className="model-picker-section">
      <p className="model-picker-section-title">{title}</p>
      {models.map((model) => {
        const qualified = modelKey(model.providerId, model.modelId);
        return (
          <ModelPickerRow
            key={qualified}
            model={model}
            selected={qualified === selectedQualified}
            onPick={() => onPick(model)}
            onFavoriteChange={onFavoriteChange}
          />
        );
      })}
    </div>
  );
}
