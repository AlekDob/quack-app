import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
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
import { ModelPickerSkeleton } from "./ModelPickerSkeleton";
import {
  ModelPickerPlatformBanner,
  ModelPickerPlatformConfirm,
} from "./modelPickerPlatform";
import { isCrossPlatformPick } from "../chatPinnedProvider";
import {
  makeQualifiedModel,
  parseQualifiedModel,
  type ProviderId,
  type ProviderModel,
} from "../providers/types";

const POP_GAP = 6;
const POP_MARGIN = 8;
const POP_W = 288;
const POP_H = 340;

function clampPopPos(
  btn: DOMRect,
  popW: number,
  popH: number,
): { left: number; top: number } {
  let left = btn.left;
  if (left + popW + POP_MARGIN > window.innerWidth) {
    left = Math.max(POP_MARGIN, btn.right - popW);
  }
  left = Math.max(POP_MARGIN, left);
  let top = btn.top - popH - POP_GAP;
  if (top < POP_MARGIN) top = btn.bottom + POP_GAP;
  return { left, top };
}

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
  /** Lazy-load heavy CLI model catalogs when the popover opens. */
  onOpen?: () => void;
  /** Warm catalogs on chip hover — before the user clicks. */
  onPrefetch?: () => void;
  /** External loading flag (catalog probe / CLI refresh in flight). */
  loading?: boolean;
  /** When set, default to models on this platform only (044). */
  pinnedProviderId?: ProviderId | null;
  /** Called when the user confirms a cross-platform model switch. */
  onPlatformPin?: (providerId: ProviderId) => void;
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
  onOpen,
  onPrefetch,
  loading: loadingProp,
  pinnedProviderId = null,
  onPlatformPin,
}: Props) {
  const [openInternal, setOpenInternal] = useState(false);
  const open = openProp ?? openInternal;
  const setOpen = onOpenChange ?? setOpenInternal;
  const [query, setQuery] = useState("");
  const [prefsTick, setPrefsTick] = useState(0);
  const [opening, setOpening] = useState(false);
  const [showAllPlatforms, setShowAllPlatforms] = useState(false);
  const [pendingModel, setPendingModel] = useState<ProviderModel | null>(null);
  const [popPos, setPopPos] = useState({ left: 0, top: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const allModels = useMemo(
    () => [...ollamaModels, ...cloudModels],
    [ollamaModels, cloudModels],
  );

  const groups = useMemo(
    () => buildModelGroups(cloudModels, ollamaModels, hasKey),
    [cloudModels, ollamaModels, hasKey],
  );

  const scopedGroups = useMemo(() => {
    if (!pinnedProviderId || showAllPlatforms) return groups;
    return groups.filter((g) => g.id === pinnedProviderId);
  }, [groups, pinnedProviderId, showAllPlatforms]);

  const visible = useMemo(() => {
    void prefsTick;
    return filterVisibleGroups(scopedGroups, query, isModelEnabled);
  }, [scopedGroups, query, prefsTick]);

  const { favorites, groupsNoFav } = useMemo(() => {
    void prefsTick;
    return splitFavoriteModels(visible, getFavoriteModels());
  }, [visible, prefsTick]);

  const isEmpty = favorites.length === 0 && groupsNoFav.length === 0;
  const busy = opening || (loadingProp ?? false);
  const showFullSkeleton = busy && isEmpty;
  const showTailSkeleton = busy && !isEmpty;
  const parsed = parseQualifiedModel(selectedQualified);
  const label = modelLabel(allModels, selectedQualified);

  useEffect(() => {
    if (!open) {
      setOpening(false);
      setShowAllPlatforms(false);
      setPendingModel(null);
      return;
    }
    if (!loadingProp) setOpening(false);
  }, [open, loadingProp]);

  const applyPick = (model: ProviderModel) => {
    const crossPlatform = pendingModel !== null;
    onSelect(makeQualifiedModel(model.providerId, model.modelId));
    if (crossPlatform) onPlatformPin?.(model.providerId);
    setOpen(false);
    setQuery("");
    setOpening(false);
    setPendingModel(null);
    setShowAllPlatforms(false);
  };

  const pick = (model: ProviderModel) => {
    if (
      pinnedProviderId &&
      isCrossPlatformPick(pinnedProviderId, model.providerId)
    ) {
      setPendingModel(model);
      return;
    }
    applyPick(model);
  };

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const btn = btnRef.current.getBoundingClientRect();
    const place = () => {
      const pop = popRef.current?.getBoundingClientRect();
      setPopPos(clampPopPos(btn, pop?.width ?? POP_W, pop?.height ?? POP_H));
    };
    place();
    const id = window.requestAnimationFrame(place);
    return () => window.cancelAnimationFrame(id);
  }, [open, favorites.length, groupsNoFav.length, query, busy]);

  const openPicker = () => {
    const pos = btnRef.current
      ? clampPopPos(btnRef.current.getBoundingClientRect(), POP_W, POP_H)
      : popPos;
    flushSync(() => {
      setOpening(true);
      setPopPos(pos);
      setOpen(true);
    });
    onOpen?.();
  };

  const closePicker = () => {
    setOpen(false);
    setOpening(false);
    setQuery("");
    setShowAllPlatforms(false);
    setPendingModel(null);
  };

  const toggleOpen = () => {
    if (open) closePicker();
    else openPicker();
  };

  const popover = open ? (
    <>
      <div className="ai-flag-menu-overlay" onClick={closePicker} />
      <div
        ref={popRef}
        className={`model-picker-pop${busy ? " model-picker-pop-busy" : ""}`}
        role="listbox"
        aria-busy={busy}
        style={{ left: popPos.left, top: popPos.top }}
      >
        <div className="model-picker-pop-head">
          <div className="model-picker-search-wrap">
            {busy ? (
              <span className="ai-spinner ai-spinner-sm model-picker-head-spin" />
            ) : (
              <Icon name="search" size={14} />
            )}
            <input
              autoFocus
              className="model-picker-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={busy ? "Loading models…" : "Search models"}
            />
          </div>
          <button
            type="button"
            className="model-picker-icon-btn"
            title="Configure providers"
            onClick={() => {
              closePicker();
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
              closePicker();
              onOpenFullBrowser();
            }}
          >
            <Icon name="settings" size={14} />
          </button>
        </div>
        {pinnedProviderId && !pendingModel && (
          <ModelPickerPlatformBanner
            pinnedProviderId={pinnedProviderId}
            showAllPlatforms={showAllPlatforms}
            onShowAll={() => setShowAllPlatforms(true)}
            onLockAgain={() => setShowAllPlatforms(false)}
          />
        )}
        {pinnedProviderId && pendingModel && (
          <ModelPickerPlatformConfirm
            from={pinnedProviderId}
            to={pendingModel.providerId}
            onConfirm={() => applyPick(pendingModel)}
            onCancel={() => setPendingModel(null)}
          />
        )}
        <div className="model-picker-scroll">
          {showFullSkeleton && <ModelPickerSkeleton rows={6} />}
          {!showFullSkeleton && isEmpty && !busy && (
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
          {showTailSkeleton && (
            <ModelPickerSkeleton
              rows={3}
              label="Loading more providers…"
            />
          )}
        </div>
      </div>
    </>
  ) : null;

  return (
    <>
      <div className="model-picker-wrap">
        <button
          ref={btnRef}
          type="button"
          className={`ai-model-chip${busy ? " ai-model-chip-loading" : ""}${
            opening ? " ai-model-chip-opening" : ""
          }`}
          onClick={toggleOpen}
          onMouseEnter={() => onPrefetch?.()}
          onFocus={() => onPrefetch?.()}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-busy={busy || undefined}
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
          {busy ? (
            <span className="ai-spinner ai-spinner-sm" aria-hidden="true" />
          ) : (
            <span className="ai-model-btn-caret">▾</span>
          )}
        </button>
        {popover && createPortal(popover, document.body)}
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
