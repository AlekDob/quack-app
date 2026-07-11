// Amber chip — Jack proposes saving hard-won knowledge to Pinky Brain.

import { useState } from "react";
import { Icon } from "./Icon";
import type { BrainSaveProposal } from "../ai";
import { commitBrainSave, withBrainSaveStatus } from "../brainSave";
import { brainWorkspaceRoot, openBrainDoc } from "../brainInject";
import { error as toastError, success as toastSuccess } from "../notify";

type Props = {
  wsId: string;
  proposal: BrainSaveProposal;
  onChange: (next: BrainSaveProposal) => void;
};

export function BrainSaveChip({ wsId, proposal, onChange }: Props) {
  const [busy, setBusy] = useState(false);
  const done = proposal.status !== "pending";

  const save = async () => {
    setBusy(true);
    try {
      const res = await commitBrainSave(wsId, proposal);
      onChange(withBrainSaveStatus(proposal, "saved", res.relPath));
      toastSuccess(`Saved to brain — ${res.relPath}`);
    } catch (e) {
      toastError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const dismiss = () => {
    onChange(withBrainSaveStatus(proposal, "dismissed"));
  };

  const openSaved = () => {
    if (!proposal.saved_path) return;
    const wsRoot = brainWorkspaceRoot(wsId);
    if (wsRoot) void openBrainDoc(wsId, wsRoot, proposal.saved_path);
  };

  return (
    <div className={`brain-save-chip${done ? " is-done" : ""}`}>
      <div className="brain-save-chip-head">
        <Icon name="brain" size={11} className="brain-save-chip-icon" />
        <span className="brain-save-chip-label">
          {proposal.status === "saved" ? "Saved to brain" : "Save to brain"}
        </span>
        <span className="brain-save-chip-meta brain-save-shimmer">
          {proposal.entry_type}
          {proposal.reason ? ` · ${proposal.reason}` : ""}
        </span>
      </div>
      <div className="brain-save-chip-body">
        <p className="brain-save-chip-title">{proposal.title}</p>
        <p className="brain-save-chip-preview">{previewBody(proposal.body)}</p>
      </div>
      {!done && (
        <div className="brain-save-chip-actions">
          <button
            type="button"
            className="brain-save-btn primary"
            disabled={busy}
            onClick={() => void save()}
          >
            {busy ? "Saving…" : "Save"}
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
      )}
      {proposal.status === "saved" && proposal.saved_path && (
        <button type="button" className="brain-save-open" onClick={openSaved}>
          Open {proposal.saved_path}
        </button>
      )}
    </div>
  );
}

function previewBody(body: string, max = 220): string {
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}
