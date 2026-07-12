// Skills segment — SkillOpt-Sleep trainer (dry-run, adopt proposals).

import { useCallback, useEffect, useState } from "react";
import { skilloptSleep, type SkillOptSleepStatus } from "../skilloptSleep";
import { openQuackStore } from "./QuackStorePanel";
import { error as toastError, info as toastInfo, success as toastSuccess } from "../notify";
import { invoke } from "@tauri-apps/api/core";
import { getJson, setJson } from "../localStore";

interface Props {
  wsId: string;
  active: boolean;
}

const dismissKey = (id: string) => `lcp.skillopt.dismissed.${id}`;

function proposalId(st: SkillOptSleepStatus): string {
  return (st.proposal_summary ?? st.raw_output ?? "default").slice(0, 80);
}

export function BrainSkillPanel({ wsId, active }: Props) {
  const [status, setStatus] = useState<SkillOptSleepStatus | null>(null);
  const [busy, setBusy] = useState<"dry-run" | "adopt" | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const refresh = useCallback(async () => {
    if (!active) return;
    try {
      const st = await skilloptSleep.status();
      setStatus(st);
      const pid = proposalId(st);
      const wasDismissed = getJson<boolean>(
        dismissKey(pid),
        false,
        (v): v is boolean => typeof v === "boolean",
      );
      setDismissed(wasDismissed && st.has_proposal);
    } catch (e) {
      toastError(String(e));
    }
  }, [active]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runDryRun = async () => {
    setBusy("dry-run");
    toastInfo("Running dry-run — this may take a few minutes.");
    try {
      const res = await skilloptSleep.dryRun();
      toastSuccess("Dry-run finished");
      setStatus((s) => ({
        ...(s ?? {
          available: true,
          has_proposal: false,
          proposal_summary: null,
          proposal_skill_path: null,
          proposal_body: null,
          raw_output: null,
        }),
        raw_output: res.output,
      }));
    } catch (e) {
      toastError(String(e));
    } finally {
      setBusy(null);
    }
  };

  const adopt = async () => {
    setBusy("adopt");
    try {
      const res = await skilloptSleep.adopt();
      toastSuccess("Skill proposal adopted");
      setDismissed(false);
      setStatus((s) => ({
        ...(s ?? {
          available: true,
          has_proposal: false,
          proposal_summary: null,
          proposal_skill_path: null,
          proposal_body: null,
          raw_output: null,
        }),
        has_proposal: false,
        raw_output: res.output,
      }));
      try {
        await invoke("claude_invalidate_context_cache");
      } catch {
        /* optional */
      }
    } catch (e) {
      toastError(String(e));
    } finally {
      setBusy(null);
    }
  };

  const dismiss = () => {
    if (!status) return;
    setJson(dismissKey(proposalId(status)), true);
    setDismissed(true);
  };

  if (!status) {
    return (
      <div className="brain-segment-loading">
        <div className="brain-result-skeleton" style={{ height: 120 }} />
      </div>
    );
  }

  const showProposal = status.has_proposal && !dismissed;

  return (
    <>
      <p className="brain-muted brain-skill-intro">
        Review and adopt skill proposals from your Claude Code sessions. Run a dry-run
        first — nothing is written until you adopt.
      </p>

      <div className="brain-skill-actions">
        <button
          type="button"
          className={`brain-btn ghost${busy === "dry-run" ? " is-busy" : ""}`}
          disabled={busy !== null}
          onClick={() => void runDryRun()}
        >
          {busy === "dry-run" ? (
            <span className="brain-search-shimmer">Running dry-run…</span>
          ) : (
            "Run dry-run"
          )}
        </button>
        <button
          type="button"
          className="brain-btn ghost"
          disabled={busy !== null}
          onClick={() => void refresh()}
        >
          Refresh status
        </button>
      </div>

      {showProposal && (
        <div className="brain-skill-proposal">
          <p className="brain-skill-proposal-head">Staged skill proposal</p>
          {status.proposal_summary && (
            <p className="brain-skill-proposal-summary">{status.proposal_summary}</p>
          )}
          {status.proposal_skill_path && (
            <p className="brain-skill-proposal-path">{status.proposal_skill_path}</p>
          )}
          {status.proposal_body && (
            <pre className="brain-skill-proposal-body">{previewBody(status.proposal_body)}</pre>
          )}
          <div className="brain-skill-proposal-btns">
            <button
              type="button"
              className="brain-btn primary"
              disabled={busy !== null}
              onClick={() => void adopt()}
            >
              {busy === "adopt" ? (
                <span className="brain-search-shimmer">Adopting…</span>
              ) : (
                "Adopt proposal"
              )}
            </button>
            <button
              type="button"
              className="brain-btn ghost"
              disabled={busy !== null}
              onClick={dismiss}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {!showProposal && status.raw_output && (
        <pre className="brain-skill-output">{previewBody(status.raw_output, 1200)}</pre>
      )}

      {!showProposal && !status.raw_output && (
        <p className="brain-empty-index">
          No staged proposal. Run <strong>dry-run</strong> or schedule nightly cycles via
          the SkillOpt CLI.
        </p>
      )}

      <button
        type="button"
        className="brain-link-btn"
        onClick={() => openQuackStore(wsId)}
      >
        Manage in Quack Store
      </button>
    </>
  );
}

function previewBody(body: string, max = 600): string {
  const t = body.trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}
