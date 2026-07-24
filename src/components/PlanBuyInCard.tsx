import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { MarkdownPreview } from "./MarkdownPreview";
import { duckAvatarFor } from "../subagents";

const MILO_AVATAR = duckAvatarFor("builder", "duck3");

/** Cursor-style buy-in after ExitPlanMode — hand off to Milo to build. */
export function PlanBuyInCard({
  plan,
  featureLabel,
  onBuild,
  onKeepDiscussing,
  onOpenPlan,
}: {
  plan: string;
  featureLabel?: string | null;
  onBuild: () => void | Promise<void>;
  onKeepDiscussing: () => void | Promise<void>;
  /** Focus the full Plan preview (Agent Mode tab / IDE drawer or plan: tab). */
  onOpenPlan?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const preview = planPreview(plan);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (busy) return;
      const t = e.target as HTMLElement | null;
      const typing =
        !!t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable);
      if (typing) return;
      if (e.key === "Escape") {
        e.preventDefault();
        void onKeepDiscussing();
      } else if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void runBuild();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, onBuild, onKeepDiscussing]);

  const runBuild = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onBuild();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ai-plan-buyin" role="region" aria-label="Plan ready">
      <div className="ai-plan-buyin-head">
        <Icon name="file-text" size={14} />
        <div className="ai-plan-buyin-titles">
          <span className="ai-plan-buyin-title">Plan ready</span>
          {featureLabel ? (
            <span className="ai-plan-buyin-feat">{featureLabel}</span>
          ) : null}
        </div>
      </div>
      {preview ? (
        <div className="ai-plan-buyin-preview">
          <MarkdownPreview content={preview} />
        </div>
      ) : null}
      <div className="ai-plan-buyin-actions">
        {onOpenPlan ? (
          <button
            type="button"
            className="ai-plan-buyin-open"
            disabled={busy}
            onClick={onOpenPlan}
            title="Open the full plan in the side panel"
          >
            <Icon name="columns-2" size={14} />
            <span>Open Plan</span>
          </button>
        ) : null}
        <button
          type="button"
          className="ai-plan-buyin-keep"
          disabled={busy}
          onClick={() => void onKeepDiscussing()}
          title="Stay in Plan mode and refine with Jack (Esc)"
        >
          Keep discussing
        </button>
        <button
          type="button"
          className="ai-plan-buyin-build"
          disabled={busy}
          onClick={() => void runBuild()}
          title="Approve the plan, switch to Milo (Builder) in Agent mode, and start implementing (Enter)"
        >
          <img
            className="ai-plan-buyin-avatar"
            src={MILO_AVATAR}
            alt=""
            width={18}
            height={18}
          />
          <span>Pass the ball to Milo</span>
        </button>
      </div>
      <div className="ai-plan-buyin-hint">
        <kbd>Enter</kbd> build · <kbd>Esc</kbd> keep discussing · or type below
        to refine
      </div>
    </div>
  );
}

function planPreview(plan: string): string {
  const t = plan.trim();
  if (!t) return "";
  const lines = t.split("\n");
  if (lines.length <= 12 && t.length <= 900) return t;
  return `${lines.slice(0, 12).join("\n").slice(0, 900)}\n\n…`;
}
