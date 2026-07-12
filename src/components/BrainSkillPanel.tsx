// Skills segment — SkillOpt-Sleep trainer (dry-run, adopt proposals).

import { useCallback, useEffect, useState } from "react";
import {
  parseSkillOptOutput,
  skilloptSleep,
  type SkillOptSleepStatus,
} from "../skilloptSleep";
import { openQuackStore } from "./QuackStorePanel";
import { error as toastError, info as toastInfo, success as toastSuccess } from "../notify";
import { invoke } from "@tauri-apps/api/core";
import { getJson, setJson } from "../localStore";

interface Props {
  wsId: string;
  active: boolean;
}

type LastRun = {
  at: number;
  hasProposal: boolean;
};

const dismissKey = (id: string) => `lcp.skillopt.dismissed.${id}`;

function proposalId(st: SkillOptSleepStatus): string {
  return (st.proposal_summary ?? st.proposal_skill_path ?? "default").slice(0, 80);
}

function runSummary(st: SkillOptSleepStatus): string {
  if (st.has_proposal) {
    return "Proposal ready — review and adopt below.";
  }
  return "No new proposals from this dry-run.";
}

export function BrainSkillPanel({ wsId, active }: Props) {
  const [status, setStatus] = useState<SkillOptSleepStatus | null>(null);
  const [busy, setBusy] = useState<"dry-run" | "adopt" | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [lastRun, setLastRun] = useState<LastRun | null>(null);

  const applyStatus = useCallback((st: SkillOptSleepStatus) => {
    setStatus(st);
    const pid = proposalId(st);
    const wasDismissed = getJson<boolean>(
      dismissKey(pid),
      false,
      (v): v is boolean => typeof v === "boolean",
    );
    setDismissed(wasDismissed && st.has_proposal);
  }, []);

  const refresh = useCallback(async () => {
    if (!active) return;
    try {
      const st = await skilloptSleep.status();
      applyStatus(st);
    } catch (e) {
      toastError(String(e));
    }
  }, [active, applyStatus]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runDryRun = async () => {
    setBusy("dry-run");
    setLastRun(null);
    toastInfo("Running dry-run — this may take a few minutes.");
    try {
      const res = await skilloptSleep.dryRun();
      const parsed = parseSkillOptOutput(res.output);
      applyStatus(parsed);
      setLastRun({ at: Date.now(), hasProposal: parsed.has_proposal });
      toastSuccess(
        parsed.has_proposal
          ? "Dry-run finished — proposal ready"
          : "Dry-run finished — no new proposals",
      );
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
      setLastRun(null);
      const parsed = parseSkillOptOutput(res.output);
      applyStatus({ ...parsed, has_proposal: false });
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

      {busy === "dry-run" && (
        <p className="brain-skill-running" aria-live="polite">
          Dry-run in progress — the button shows a shimmer until it finishes. You will
          also get a toast notification.
        </p>
      )}

      {lastRun && !busy && (
        <div
          className={`brain-skill-result${lastRun.hasProposal ? " has-proposal" : ""}`}
          role="status"
        >
          <span className="brain-skill-result-label">Dry-run complete</span>
          <span className="brain-skill-result-text">{runSummary(status)}</span>
        </div>
      )}

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

      {!showProposal && !status.raw_output && !lastRun && (
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
