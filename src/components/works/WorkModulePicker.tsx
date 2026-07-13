import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { formatModuleLabel, sortWorkModules } from "../../worksUi";
import type { WorkModule } from "../../works";
import { Icon } from "../Icon";

const POP_W = 420;
const POP_H = 300;
const POP_MARGIN = 8;
const POP_GAP = 4;

function clampPos(btn: DOMRect, popW: number) {
  let left = btn.left;
  left = Math.max(
    POP_MARGIN,
    Math.min(left, window.innerWidth - popW - POP_MARGIN),
  );
  let top = btn.bottom + POP_GAP;
  if (top + POP_H > window.innerHeight - POP_MARGIN) {
    top = btn.top - POP_H - POP_GAP;
  }
  return { left, top: Math.max(POP_MARGIN, top) };
}

function moduleHaystack(m: WorkModule): string {
  const num =
    m.featureNum != null ? String(m.featureNum).padStart(3, "0") : "";
  return [num, m.name, m.featureSlug, m.featurePath, m.id]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

type Props = {
  modules: WorkModule[];
  value: string;
  onChange: (moduleId: string) => void;
  allowClear?: boolean;
};

export function WorkModulePicker({
  modules,
  value,
  onChange,
  allowClear = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [popPos, setPopPos] = useState({ left: 0, top: 0 });

  const sorted = useMemo(() => sortWorkModules(modules), [modules]);
  const selected = modules.find((m) => m.id === value);
  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!q) return sorted;
    return sorted.filter((m) => moduleHaystack(m).includes(q));
  }, [sorted, q]);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const btn = btnRef.current.getBoundingClientRect();
    const place = () => {
      const pop = popRef.current?.getBoundingClientRect();
      setPopPos(clampPos(btn, pop?.width ?? POP_W));
    };
    place();
    const id = window.requestAnimationFrame(place);
    return () => window.cancelAnimationFrame(id);
  }, [open, filtered.length]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  const popover =
    open &&
    createPortal(
      <>
        <div
          className="work-module-picker-overlay"
          onMouseDown={() => setOpen(false)}
        />
        <div
          ref={popRef}
          className="work-module-picker-pop liquid-glass"
          style={{ left: popPos.left, top: popPos.top, width: POP_W }}
          role="listbox"
          aria-label="Modules"
        >
          <div className="work-module-picker-head">
            <Icon name="search" size={14} />
            <input
              ref={inputRef}
              className="work-module-picker-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search modules…"
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
              }}
            />
          </div>
          <div className="work-module-picker-list">
            {allowClear && (
              <button
                type="button"
                className={`work-module-picker-row work-module-picker-row--none${
                  !value ? " active" : ""
                }`}
                onClick={() => pick("")}
              >
                <span className="work-module-picker-row-icon work-module-picker-row-icon--muted">
                  <Icon name="x" size={12} />
                </span>
                <span className="work-module-picker-row-name">No module</span>
                {!value ? (
                  <Icon name="check" size={12} className="work-module-check" />
                ) : null}
              </button>
            )}
            {allowClear && filtered.length > 0 ? (
              <div className="work-module-picker-divider" role="separator" />
            ) : null}
            {filtered.length === 0 && q ? (
              <p className="work-module-picker-empty">No modules match</p>
            ) : (
              filtered.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`work-module-picker-row${
                    m.id === value ? " active" : ""
                  }`}
                  onClick={() => pick(m.id)}
                  title={m.featurePath ?? undefined}
                >
                  <span className="work-module-picker-row-icon">
                    <Icon name="columns-2" size={12} />
                  </span>
                  <span className="work-module-picker-row-text">
                    <span className="work-module-picker-row-name">
                      {formatModuleLabel(m)}
                    </span>
                  </span>
                  {m.id === value ? (
                    <Icon name="check" size={12} className="work-module-check" />
                  ) : null}
                </button>
              ))
            )}
          </div>
        </div>
      </>,
      document.body,
    );

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="work-module-picker-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={selected?.featurePath ?? undefined}
      >
        <span className="work-module-picker-trigger-icon">
          <Icon name="columns-2" size={12} />
        </span>
        <span className="work-module-picker-trigger-name">
          {selected
            ? formatModuleLabel(selected)
            : value
              ? value
              : "No module"}
        </span>
        <Icon
          name="chevron-down"
          size={12}
          className="work-module-picker-caret"
        />
      </button>
      {popover}
    </>
  );
}
