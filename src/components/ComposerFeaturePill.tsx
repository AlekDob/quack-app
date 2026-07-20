// Composer feature control — icon opens fuzzy list; pinned link shows a chip.
// Feature list loads only when the menu opens (infinite scroll, page size 24).

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  featureLabelFromSlug,
  listFeatures,
  type FeatureEntry,
} from "../featureCatalog";
import { openFeatureDocDrawer } from "../featureDocDrawer";
import {
  getFeatureInjectEnabled,
  setFeatureInjectEnabled,
} from "../featureTurnContext";
import { fuzzyMatch, normalizeFilterQuery } from "../fuzzyMatch";
import { useStore } from "../store";
import { Icon } from "./Icon";

const PAGE = 24;

type Props = {
  wsId: string;
  root: string;
  chatId: string;
};

export function ComposerFeaturePill({ wsId, root, chatId }: Props) {
  const featureId = useStore(
    (s) => s.loaded[wsId]?.aiChats[chatId]?.featureId,
  );
  const featureLabel = useStore(
    (s) => s.loaded[wsId]?.aiChats[chatId]?.featureLabel,
  );
  const featurePinned = useStore(
    (s) => !!s.loaded[wsId]?.aiChats[chatId]?.featurePinned,
  );
  const setFeature = useStore((s) => s.setAIChatFeature);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [list, setList] = useState<FeatureEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(PAGE);
  const [activeIndex, setActiveIndex] = useState(0);
  const [injectOn, setInjectOn] = useState(() =>
    getFeatureInjectEnabled(wsId),
  );
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    setVisible(PAGE);
    setLoading(true);
    void listFeatures(root)
      .then(setList)
      .finally(() => setLoading(false));
    requestAnimationFrame(() => searchRef.current?.focus());
  }, [open, root]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    window.addEventListener("mousedown", onDoc);
    return () => window.removeEventListener("mousedown", onDoc);
  }, [open]);

  const label =
    featureLabel ||
    (featureId ? featureLabelFromSlug(featureId) : null) ||
    "Feature";
  const showChip = !!(featureId && featurePinned);

  const filtered = useMemo(() => {
    const q = normalizeFilterQuery(query);
    const all = list ?? [];
    if (!q) return all;
    return all.filter(
      (f) =>
        fuzzyMatch(q, f.slug) ||
        fuzzyMatch(q, f.title) ||
        fuzzyMatch(q, f.path),
    );
  }, [list, query]);

  const shown = useMemo(
    () => filtered.slice(0, visible),
    [filtered, visible],
  );
  const hasMore = visible < filtered.length;

  useEffect(() => {
    setActiveIndex(0);
    setVisible(PAGE);
  }, [query]);

  useEffect(() => {
    if (!open || !hasMore) return;
    const rootEl = listRef.current;
    const sentinel = sentinelRef.current;
    if (!rootEl || !sentinel) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible((n) => Math.min(n + PAGE, filtered.length));
        }
      },
      { root: rootEl, rootMargin: "80px", threshold: 0 },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [open, hasMore, filtered.length, shown.length]);

  const pick = (f: FeatureEntry) => {
    setFeature(wsId, chatId, {
      id: f.slug,
      label: featureLabelFromSlug(f.slug),
      pinned: true,
    });
    setOpen(false);
  };

  const clear = () => {
    setFeature(wsId, chatId, null);
    setOpen(false);
  };

  const onSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => {
        const next = Math.min(i + 1, Math.max(0, shown.length - 1));
        if (next >= shown.length - 3 && hasMore) {
          setVisible((n) => Math.min(n + PAGE, filtered.length));
        }
        return next;
      });
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter" && shown[activeIndex]) {
      e.preventDefault();
      pick(shown[activeIndex]!);
    }
  };

  const menu =
    open && btnRef.current
      ? (() => {
          const r = btnRef.current!.getBoundingClientRect();
          const style: CSSProperties = {
            position: "fixed",
            left: Math.min(r.left, window.innerWidth - 340),
            bottom: window.innerHeight - r.top + 6,
            width: 320,
            zIndex: 1200,
          };
          return createPortal(
            <div
              ref={menuRef}
              className="ai-composer-feature-popover"
              style={style}
              role="listbox"
              aria-label="Link feature"
            >
              <div className="ai-composer-feature-popover-search">
                <Icon name="search" size={13} />
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onSearchKey}
                  placeholder="Fuzzy search features…"
                  aria-label="Search features"
                />
              </div>
              {featureId && featurePinned && (
                <div className="ai-composer-feature-popover-actions">
                  <button
                    type="button"
                    className="menu-item"
                    onClick={() => {
                      openFeatureDocDrawer({
                        wsId,
                        root,
                        featurePath: featureId.includes("/")
                          ? featureId
                          : `documentation/features/${featureId}.md`,
                        title: label,
                      });
                      setOpen(false);
                    }}
                  >
                    <span className="menu-item-label">
                      <Icon name="file-text" size={12} /> Open linked
                    </span>
                  </button>
                  <button
                    type="button"
                    className="menu-item"
                    onClick={clear}
                  >
                    <span className="menu-item-label">Clear link</span>
                  </button>
                  <button
                    type="button"
                    className="menu-item"
                    onClick={() => {
                      const next = !injectOn;
                      setFeatureInjectEnabled(wsId, next);
                      setInjectOn(next);
                    }}
                  >
                    <span className="menu-item-label">
                      Inject on send: {injectOn ? "On" : "Off"}
                    </span>
                  </button>
                </div>
              )}
              <div
                ref={listRef}
                className="ai-composer-feature-popover-list"
              >
                {loading && (
                  <div className="ai-composer-feature-empty">Loading…</div>
                )}
                {!loading && shown.length === 0 && (
                  <div className="ai-composer-feature-empty">No matches</div>
                )}
                {!loading &&
                  shown.map((f, i) => (
                    <button
                      key={f.slug}
                      type="button"
                      role="option"
                      aria-selected={i === activeIndex}
                      className={`ai-composer-feature-row${
                        i === activeIndex ? " active" : ""
                      }${featureId === f.slug ? " is-linked" : ""}`}
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => pick(f)}
                    >
                      <Icon name="file-text" size={13} />
                      <span className="ai-composer-feature-row-body">
                        <span className="ai-composer-feature-row-title">
                          {featureLabelFromSlug(f.slug)}
                        </span>
                        <span className="ai-composer-feature-row-meta">
                          {f.slug}
                        </span>
                      </span>
                    </button>
                  ))}
                {hasMore && (
                  <div
                    ref={sentinelRef}
                    className="ai-composer-feature-sentinel"
                  />
                )}
              </div>
            </div>,
            document.body,
          );
        })()
      : null;

  return (
    <>
      <div className={`ai-composer-feature-wrap${showChip ? " is-pinned" : ""}`}>
        <button
          ref={btnRef}
          type="button"
          className={`ai-composer-feature-pill${showChip ? " is-linked" : ""}`}
          onClick={() => setOpen((v) => !v)}
          title={
            showChip
              ? `Feature: ${label}`
              : "Link a feature doc to this chat"
          }
          aria-label={
            showChip
              ? `Feature: ${label}`
              : "Link a feature doc to this chat"
          }
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <Icon name="file-text" size={14} />
        </button>
        {showChip && (
          <div className="ai-composer-feature-chip" title={label}>
            <button
              type="button"
              className="ai-composer-feature-chip-main"
              onClick={() => setOpen((v) => !v)}
              aria-label={`Pinned feature: ${label}`}
            >
              <span className="ai-composer-feature-chip-label">{label}</span>
            </button>
            <button
              type="button"
              className="ai-composer-feature-chip-clear"
              title="Clear feature link"
              aria-label="Clear feature link"
              onClick={clear}
            >
              <Icon name="x" size={11} />
            </button>
          </div>
        )}
      </div>
      {menu}
    </>
  );
}
