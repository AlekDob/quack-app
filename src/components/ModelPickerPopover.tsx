import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import {
  buildModelGroups,
  filterVisibleGroups,
  modelLabel,
  reorderGroupsFirst,
  splitFavoriteModels,
} from "../modelSelectorUtils";
import {
  getFavoriteModels,
  isModelEnabled,
  modelKey,
} from "../modelPrefs";
import { ModelPickerRow } from "./ModelPickerRow";
import { ModelPickerSkeleton } from "./ModelPickerSkeleton";
import { ModelPickerPlatformBanner } from "./modelPickerPlatform";
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
  /** Start a fresh chat (switch agentic platform). */
  onNewChat?: () => void;
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
  onNewChat,
}: Props) {
  const [openInternal, setOpenInternal] = useState(false);
  const open = openProp ?? openInternal;
  const setOpen = onOpenChange ?? setOpenInternal;
  const [query, setQuery] = useState("");
  const [prefsTick, setPrefsTick] = useState(0);
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

  const selectedProvider = parseQualifiedModel(selectedQualified)?.providerId;

  const scopedGroups = useMemo(() => {
    if (pinnedProviderId) {
      return groups.filter((g) => g.id === pinnedProviderId);
    }
    if (selectedProvider) {
      return reorderGroupsFirst(groups, selectedProvider);
    }
    return groups;
  }, [groups, pinnedProviderId, selectedProvider]);

  const visible = useMemo(() => {
    void prefsTick;
    return filterVisibleGroups(scopedGroups, query, isModelEnabled);
  }, [scopedGroups, query, prefsTick]);

  const { favorites, groupsNoFav } = useMemo(() => {
    void prefsTick;
    return splitFavoriteModels(visible, getFavoriteModels());
  }, [visible, prefsTick]);

  const isEmpty = favorites.length === 0 && groupsNoFav.length === 0;
  const hasModels = !isEmpty;
  const busy = loadingProp ?? false;
  /** Full skeleton only when catalogs are empty — cached rows stay visible. */
  const hydrating = open && busy && !hasModels;
  const refreshing = open && busy && hasModels;
  const showList = !hydrating;
  const parsed = parseQualifiedModel(selectedQualified);
  const label = modelLabel(allModels, selectedQualified);

  const applyPick = (model: ProviderModel) => {
    onSelect(makeQualifiedModel(model.providerId, model.modelId));
    setOpen(false);
    setQuery("");
  };

  const pick = (model: ProviderModel) => applyPick(model);

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
    if (btnRef.current) {
      setPopPos(
        clampPopPos(btnRef.current.getBoundingClientRect(), POP_W, POP_H),
      );
    }
    setOpen(true);
    onOpen?.();
  };

  const closePicker = () => {
    setOpen(false);
    setQuery("");
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
        className={`model-picker-pop${hydrating ? " is-hydrating" : ""}${refreshing ? " is-refreshing" : ""}`}
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
              placeholder={
                hydrating ? "Loading models…" : "Search models"
              }
              readOnly={hydrating}
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
        {pinnedProviderId && onNewChat && (
          <ModelPickerPlatformBanner
            pinnedProviderId={pinnedProviderId}
            onNewChat={() => {
              closePicker();
              onNewChat();
            }}
          />
        )}
        <div className="model-picker-scroll">
          {hydrating && <ModelPickerSkeleton rows={7} />}
          {showList && isEmpty && (
            <p className="model-picker-empty">
              No models available. Configure a provider or adjust filters
              in Manage models.
            </p>
          )}
          {showList && favorites.length > 0 && (
            <PickerSection
              title="Favorites"
              models={favorites}
              selectedQualified={selectedQualified}
              onPick={pick}
              onFavoriteChange={() => setPrefsTick((n) => n + 1)}
            />
          )}
          {showList &&
            groupsNoFav.map((group) => (
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
  ) : null;

  return (
    <>
      <div className="model-picker-wrap">
        <button
          ref={btnRef}
          type="button"
          className={`ai-model-chip${
            loadingProp && !open ? " ai-model-chip-loading" : ""
          }`}
          onClick={toggleOpen}
          onMouseEnter={() => onPrefetch?.()}
          onFocus={() => onPrefetch?.()}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-busy={loadingProp && !open ? true : undefined}
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
              <span className="ai-model-id">{label}</span>
            </>
          ) : (
            <span className="ai-model-btn-empty">Pick a model…</span>
          )}
          {loadingProp && !open ? (
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
