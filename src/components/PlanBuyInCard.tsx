import { useEffect, useState } from "react";
import { duckAvatarFor } from "../subagents";

const MILO_AVATAR = duckAvatarFor("builder", "duck3");

/** Compact Pass-the-ball chip after ExitPlanMode — full plan lives in the
 *  right Plan tab / IDE preview, not in the chat stream. */
export function PlanBuyInCard({
  onBuild,
  onKeepDiscussing,
}: {
  onBuild: () => void | Promise<void>;
  /** Esc keeps discussing (deny ExitPlanMode). Optional — no UI button. */
  onKeepDiscussing?: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

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
      if (e.key === "Escape" && onKeepDiscussing) {
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
    <div className="ai-plan-buyin" role="region" aria-label="Pass the ball to Milo">
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
  );
}
