// Power-user settings editor — render every known config key as JSON
// so the user can hand-edit, paste a backup, or wipe a single value.
// Pulled out of SettingsModal so its 1600-line file can shrink and so
// the editor's allowlist (SETTINGS_KEYS) lives next to the helpers
// that consume it.
//
// SETTINGS_KEYS is intentionally narrow: configuration only. Workspace
// state, chat history, AI session caches, etc. are app-internal and
// must NOT show up in this editor — they'd let a typo wipe the user's
// open tabs and conversation log.

import { useMemo, useRef, useState } from "react";
import { confirm as dialogConfirm } from "../dialog";
import { errMsg } from "../notify";
import { confirmDiscardUnsaved } from "../actions";
import {
  getString as lsGetString,
  remove as lsRemove,
  setJson as lsSetJson,
  setString as lsSetString,
} from "../localStore";

// Key literals must match the STORAGE_KEY / KEY constants in each
// settings module exactly — "lcp.editor.settings" once drifted from the
// real "lcp.editorSettings", which silently dropped editor settings
// from every export AND every pasted backup.
export const SETTINGS_KEYS = [
  "lcp.theme",
  "lcp.editorSettings",
  "lcp.footprintSettings",
  "lcp.toolPolicy",
  "lcp.aiTemplates",
  "lcp.claudeCode.alwaysAllow",
  "lcp.claudeCode.budgetUsd",
  "lcp.claudeCode.allowUnguarded",
  "lcp.sftp.profiles",
  "lcp.ai.privacy.exclusions",
  "lcp.ai.usage.hardCapUsd",
  "lcp.ai.usage.logPrompts",
  "lcp.ai.usage.wsBudgetsUsd",
  "lcp.ollama.lastModel",
  "lcp.providers.openai.apiKey",
  "lcp.providers.anthropic.apiKey",
] as const;

/**
 * Serialise every known settings key out of localStorage as a pretty
 * JSON object. Values are JSON-parsed when possible; raw strings
 * otherwise so the editor doesn't choke on legacy values.
 */
function snapshotSettingsJson(): string {
  const out: Record<string, unknown> = {};
  for (const k of SETTINGS_KEYS) {
    const raw = lsGetString(k);
    if (raw == null) continue;
    try {
      out[k] = JSON.parse(raw);
    } catch {
      out[k] = raw;
    }
  }
  return JSON.stringify(out, null, 2);
}

export function SettingsJsonEditor({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState<string>(() => snapshotSettingsJson());
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "ok"; count: number }
    | { kind: "error"; message: string }
  >({ kind: "idle" });
  // Filter is purely a view-level concern — never persisted, never
  // changes what gets written on Apply. The textarea still owns the
  // full JSON blob; the filter just helps the user find a key.
  const [filter, setFilter] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Which top-level keys currently exist in the JSON blob — parsed
  // best-effort so we can show an accurate "N of M" without forcing
  // valid JSON while editing. Falls back to the SETTINGS_KEYS allowlist
  // (filtered to keys actually present as substrings) if the blob is
  // mid-edit and unparseable.
  const presentKeys = useMemo<string[]>(() => {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return Object.keys(parsed as Record<string, unknown>);
      }
    } catch {
      // fall through
    }
    return SETTINGS_KEYS.filter((k) => text.includes(`"${k}"`));
  }, [text]);

  const trimmedFilter = filter.trim().toLowerCase();
  const matchingKeys = useMemo(() => {
    if (!trimmedFilter) return presentKeys;
    return presentKeys.filter((k) =>
      k.toLowerCase().includes(trimmedFilter),
    );
  }, [presentKeys, trimmedFilter]);

  // Scroll the textarea to the first match. We locate the literal
  // `"key":` token in the source text — that's how snapshotSettingsJson
  // emits each entry — then approximate the scroll offset from the
  // line index so we land near the match without fancy measurement.
  const jumpToFirstMatch = (key: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const needle = `"${key}":`;
    const idx = text.indexOf(needle);
    if (idx < 0) return;
    const lineNo = text.slice(0, idx).split("\n").length - 1;
    // Approximate per-line height from the textarea's font/line metrics.
    const cs = window.getComputedStyle(ta);
    const lineH =
      parseFloat(cs.lineHeight) ||
      parseFloat(cs.fontSize) * 1.4 ||
      18;
    ta.focus();
    ta.setSelectionRange(idx, idx + needle.length);
    ta.scrollTop = Math.max(0, lineNo * lineH - lineH * 2);
  };

  const onFilterChange = (next: string) => {
    setFilter(next);
    const q = next.trim().toLowerCase();
    if (!q) return;
    const first = presentKeys.find((k) => k.toLowerCase().includes(q));
    if (first) jumpToFirstMatch(first);
  };

  const reload = () => {
    setText(snapshotSettingsJson());
    setStatus({ kind: "idle" });
  };

  const apply = async () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      setStatus({
        kind: "error",
        message: `Invalid JSON: ${errMsg(e)}`,
      });
      return;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      setStatus({
        kind: "error",
        message: "Top-level value must be a JSON object.",
      });
      return;
    }
    const next = parsed as Record<string, unknown>;
    // Confirm before applying — JSON edits can wipe credentials. Was
    // using the native browser confirm() which has a different look,
    // can't be styled, and is increasingly throttled in webviews.
    const removed = SETTINGS_KEYS.filter(
      (k) => lsGetString(k) != null && !(k in next),
    );
    if (removed.length > 0) {
      const ok = await dialogConfirm(
        `These settings will be DELETED:\n\n  ${removed.join("\n  ")}\n\nApply anyway?`,
        {
          title: "Delete settings",
          okLabel: "Apply",
          cancelLabel: "Cancel",
          danger: true,
        },
      );
      if (!ok) return;
    }
    let count = 0;
    for (const k of SETTINGS_KEYS) {
      if (k in next) {
        const v = next[k];
        const ok =
          typeof v === "string" ? lsSetString(k, v) : lsSetJson(k, v);
        if (ok) count++;
      } else if (lsGetString(k) != null) {
        lsRemove(k);
      }
    }
    // Surface lcp.* keys we did NOT apply — a typo'd key in a pasted
    // backup used to vanish silently behind "Applied N settings". The
    // applied keys still applied, so fall through to the reload offer
    // either way (returning early left them inert in mounted
    // components, which read as "the apply failed entirely").
    const unknown = Object.keys(next).filter(
      (k) =>
        k.startsWith("lcp.") &&
        !(SETTINGS_KEYS as readonly string[]).includes(k),
    );
    if (unknown.length > 0) {
      setStatus({
        kind: "error",
        message: `Applied ${count} setting${count === 1 ? "" : "s"}, but skipped unknown key${
          unknown.length === 1 ? "" : "s"
        }: ${unknown.join(", ")} (not in the editable allowlist — check for typos)`,
      });
    } else {
      setStatus({ kind: "ok", count });
    }
    // Offer to reload so every component picks up the new values.
    // Routes through confirmDiscardUnsaved so any open buffer edits
    // get the same "are you sure?" prompt as Ctrl+R.
    const wantsReload = await dialogConfirm(
      "Settings applied. Reload the editor to make sure every component picks up the new values?",
      {
        title: "Reload?",
        okLabel: "Reload",
        cancelLabel: "Not now",
      },
    );
    if (wantsReload && (await confirmDiscardUnsaved("Reload"))) {
      window.location.reload();
    }
  };

  return (
    <div className="settings-json-pane">
      <div className="settings-json-toolbar">
        <button className="sftp-btn" onClick={reload}>
          Reload from disk
        </button>
        <button
          className="sftp-btn"
          onClick={() => {
            void navigator.clipboard.writeText(text);
            setStatus({
              kind: "ok",
              count: 0,
            });
          }}
        >
          Copy
        </button>
        <span className="settings-json-spacer"></span>
        <button
          className="sftp-btn sftp-btn-primary"
          onClick={() => void apply()}
        >
          Apply changes
        </button>
        <button className="sftp-btn" onClick={onClose}>
          Cancel
        </button>
      </div>
      {status.kind === "error" && (
        <div className="settings-json-status settings-json-status-error">
          {status.message}
        </div>
      )}
      {status.kind === "ok" && (
        <div className="settings-json-status settings-json-status-ok">
          {status.count > 0
            ? `Applied ${status.count} settings.`
            : "Copied to clipboard."}
        </div>
      )}
      <div
        className="settings-row"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          margin: "6px 0",
        }}
      >
        <input
          type="text"
          placeholder="Filter keys… (jumps to first match)"
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          aria-label="Filter settings keys"
          style={{ flex: 1, minWidth: 0 }}
        />
        {trimmedFilter && (
          <span
            style={{ fontSize: 12, opacity: 0.75, whiteSpace: "nowrap" }}
          >
            {matchingKeys.length} of {presentKeys.length} matches
          </span>
        )}
        {filter && (
          <button
            className="sftp-btn"
            onClick={() => setFilter("")}
            title="Clear filter"
            aria-label="Clear filter"
          >
            Clear
          </button>
        )}
      </div>
      {trimmedFilter && matchingKeys.length === 0 && (
        <div
          className="settings-row settings-row-note"
          style={{ opacity: 0.75 }}
        >
          No keys match the filter.
        </div>
      )}
      <textarea
        ref={textareaRef}
        className="settings-json-textarea"
        value={text}
        spellCheck={false}
        onChange={(e) => {
          setText(e.target.value);
          setStatus({ kind: "idle" });
        }}
      />
      <div className="settings-row settings-row-note">
        Each top-level key maps directly to a <code>localStorage</code>{" "}
        entry. Values are stored as JSON or plain strings (whichever the
        feature owns). Invalid JSON is rejected before any write. Removing
        a key from the JSON deletes it from <code>localStorage</code>.
        Only configuration keys are shown — chat history, workspace
        state, and other internal data are not touched.
      </div>
    </div>
  );
}
