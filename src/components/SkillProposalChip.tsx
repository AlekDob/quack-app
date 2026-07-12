// Skill proposal chip — staged SkillOpt-Sleep adopt/dismiss above composer.

import { useCallback, useEffect, useState } from "react";
import { Icon } from "./Icon";
import { skilloptSleep, type SkillOptSleepStatus } from "../skilloptSleep";
import { getJson, setJson } from "../localStore";
import { invoke } from "@tauri-apps/api/core";
import { error as toastError, success as toastSuccess } from "../notify";

type Props = {
  enabled: boolean;
  foreground: boolean;
};

const dismissKey = (id: string) => `lcp.skillopt.dismissed.${id}`;

function pid(st: SkillOptSleepStatus): string {
  return (st.proposal_summary ?? st.raw_output ?? "default").slice(0, 80);
}

export function SkillProposalChip({ enabled, foreground }: Props) {
  const [status, setStatus] = useState<SkillOptSleepStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled || !foreground) return;
    try {
      const st = await skilloptSleep.status();
      setStatus(st);
      if (st.has_proposal) {
        const was = getJson<boolean>(
          dismissKey(pid(st)),
          false,
          (v): v is boolean => typeof v === "boolean",
        );
        setDismissed(was);
      }
    } catch {
      /* optional */
    }
  }, [enabled, foreground]);

  useEffect(() => {
    void refresh();
    if (!enabled || !foreground) return;
    const t = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(t);
  }, [refresh, enabled, foreground]);

  if (!enabled || !status?.has_proposal || dismissed) return null;

  const adopt = async () => {
    setBusy(true);
    try {
      await skilloptSleep.adopt();
      toastSuccess("Skill proposal adopted");
      try {
        await invoke("claude_invalidate_context_cache");
      } catch {
        /* optional */
      }
      setDismissed(true);
      void refresh();
    } catch (e) {
      toastError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const dismiss = () => {
    setJson(dismissKey(pid(status)), true);
    setDismissed(true);
  };

  return (
    <div className="brain-save-chip skill-proposal-chip">
      <div className="brain-save-chip-head">
        <Icon name="zap" size={11} className="brain-save-chip-icon" />
        <span className="brain-save-chip-label">Skill proposal ready</span>
      </div>
      {status.proposal_summary && (
        <p className="brain-save-chip-preview">{status.proposal_summary}</p>
      )}
      <div className="brain-save-chip-actions">
        <button
          type="button"
          className="brain-save-btn primary"
          disabled={busy}
          onClick={() => void adopt()}
        >
          {busy ? (
            <span className="brain-search-shimmer">Adopting…</span>
          ) : (
            "Adopt"
          )}
        </button>
        <button
          type="button"
          className="brain-save-btn ghost"
          disabled={busy}
          onClick={dismiss}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
