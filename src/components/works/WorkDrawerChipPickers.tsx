import { useRef, useState } from "react";
import { ComposerCtxMenu } from "../../composerCtxMenu";
import { Icon } from "../Icon";
import {
  statusLabel,
  type WorkPriority,
  type WorkStatus,
} from "../../works";
import {
  workPriorityIcon,
  workPriorityLabel,
  workStatusIcon,
} from "../../workDrawerMeta";

const STATUSES: WorkStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "done",
  "cancelled",
];

const PRIORITIES: WorkPriority[] = ["urgent", "high", "medium", "low"];

type StatusProps = {
  value: WorkStatus;
  onChange: (next: WorkStatus) => void;
};

export function WorkStatusPicker({ value, onChange }: StatusProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={ref}
        type="button"
        className={`work-drawer-meta-chip works-state-pill works-state-${value}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Icon name={workStatusIcon(value)} size={12} />
        <span>{statusLabel(value)}</span>
        <Icon name="chevron-down" size={10} className="work-drawer-meta-caret" />
      </button>
      <ComposerCtxMenu
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={ref}
        estimateHeight={200}
      >
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            className={`menu-item${s === value ? " active" : ""}`}
            onClick={() => {
              onChange(s);
              setOpen(false);
            }}
          >
            <span className="menu-item-label work-drawer-menu-chip">
              <span
                className={`work-drawer-meta-chip works-state-pill works-state-${s}`}
              >
                <Icon name={workStatusIcon(s)} size={12} />
                {statusLabel(s)}
              </span>
            </span>
          </button>
        ))}
      </ComposerCtxMenu>
    </>
  );
}

type PriorityProps = {
  value: WorkPriority;
  onChange: (next: WorkPriority) => void;
};

export function WorkPriorityPicker({ value, onChange }: PriorityProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={ref}
        type="button"
        className={`work-drawer-meta-chip work-drawer-priority-chip work-drawer-priority-${value}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Icon name={workPriorityIcon(value)} size={12} />
        <span>{workPriorityLabel(value)}</span>
        <Icon name="chevron-down" size={10} className="work-drawer-meta-caret" />
      </button>
      <ComposerCtxMenu
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={ref}
        estimateHeight={168}
      >
        {PRIORITIES.map((p) => (
          <button
            key={p}
            type="button"
            className={`menu-item${p === value ? " active" : ""}`}
            onClick={() => {
              onChange(p);
              setOpen(false);
            }}
          >
            <span className="menu-item-label work-drawer-menu-chip">
              <span
                className={`work-drawer-meta-chip work-drawer-priority-chip work-drawer-priority-${p}`}
              >
                <Icon name={workPriorityIcon(p)} size={12} />
                {workPriorityLabel(p)}
              </span>
            </span>
          </button>
        ))}
      </ComposerCtxMenu>
    </>
  );
}
