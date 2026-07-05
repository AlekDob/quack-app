// Claude Code-specific settings sections — per-chat budget warning
// threshold + the persistent always-allow rule manager. Both are
// pure prop-free components that read/write their own localStorage
// keys via the localStore helper, so they work in isolation outside
// the SettingsModal shell.

import { useState } from "react";
import { confirm as dialogConfirm } from "../dialog";
import {
  getJson as lsGetJson,
  getString as lsGetString,
  remove as lsRemove,
  setJson as lsSetJson,
  setString as lsSetString,
} from "../localStore";
import { Row, Toggle } from "./settingsBits";
import {
  CC_ALLOW_UNGUARDED_KEY,
  getAllowUnguarded,
} from "../providers/claudeCode";

const CC_ALWAYS_ALLOW_KEY = "lcp.claudeCode.alwaysAllow";
const CC_BUDGET_KEY = "lcp.claudeCode.budgetUsd";

/** Opt-in for running Claude Code with --dangerously-skip-permissions
 *  when the local permission server can't start. Default OFF: chats
 *  refuse to run unguarded instead of silently degrading. */
export function ClaudeCodeUnguardedEditor() {
  const [on, setOn] = useState<boolean>(() => getAllowUnguarded());
  const persist = async (v: boolean) => {
    if (v) {
      const ok = await dialogConfirm(
        "When the permission guard is unavailable, Claude Code will run with --dangerously-skip-permissions: every Edit, Write, and Bash command executes WITHOUT a permission card.\n\nAllow that fallback?",
        {
          title: "Allow unguarded Claude Code",
          okLabel: "Allow fallback",
          cancelLabel: "Keep refusing",
          danger: true,
        },
      );
      if (!ok) return;
    }
    setOn(v);
    lsSetJson(CC_ALLOW_UNGUARDED_KEY, v);
  };
  return (
    <>
      <Toggle
        label="Allow unguarded fallback"
        value={on}
        onChange={(v) => void persist(v)}
      />
      <div className="settings-row settings-row-note">
        Normally every Claude Code tool call is routed through Quack's
        permission cards. If the local permission server can't start
        (port in use, no workspace folder), chats <strong>refuse to
        run</strong> rather than silently dropping the guard. Turning
        this on accepts running with{" "}
        <code>--dangerously-skip-permissions</code> in that situation.
      </div>
    </>
  );
}

export function ClaudeCodeBudgetEditor() {
  const [val, setVal] = useState<string>(() => {
    const raw = lsGetString(CC_BUDGET_KEY);
    const n = raw ? parseFloat(raw) : 0;
    return Number.isFinite(n) && n > 0 ? n.toString() : "";
  });

  const persist = (next: string) => {
    setVal(next);
    const n = parseFloat(next);
    if (Number.isFinite(n) && n > 0) lsSetString(CC_BUDGET_KEY, n.toString());
    else lsRemove(CC_BUDGET_KEY);
  };

  return (
    <>
      <Row label="Per-chat warning at">
        <div className="cc-budget-input">
          <span className="cc-budget-prefix">$</span>
          <input
            type="number"
            min="0"
            step="0.10"
            placeholder="0  (disabled)"
            value={val}
            onChange={(e) => persist(e.target.value)}
            className="cc-budget-field"
          />
          <span className="cc-budget-suffix">USD</span>
        </div>
      </Row>
      <div className="settings-row settings-row-note">
        Once a Claude Code chat's cumulative cost crosses this number, a
        warning toast fires (once per chat). Useful for catching the
        documented resume-cache-miss class of regressions where a
        normally-cheap chat suddenly burns 20× more than expected.
        Leave blank to disable. Subscription users (Pro / Max) can
        ignore — Anthropic doesn't bill via usd_cost.
      </div>
    </>
  );
}

export function ClaudeCodeAlwaysAllowEditor() {
  const [list, setList] = useState<string[]>(() => loadList());

  function loadList(): string[] {
    return lsGetJson<unknown[]>(CC_ALWAYS_ALLOW_KEY, [], Array.isArray)
      .filter((s): s is string => typeof s === "string")
      .sort();
  }

  function persist(next: string[]) {
    setList(next);
    lsSetJson(CC_ALWAYS_ALLOW_KEY, next);
  }

  // Split entries into the three kinds the permission overlay supports:
  //   - bare tool names (e.g. "Read", "Edit")
  //   - "Bash:<prefix>" — auto-allow Bash commands starting with prefix
  //   - "Ext:<.ext>:<tool>" — auto-allow path-tool calls on this filetype
  const tools: string[] = [];
  const bashPrefixes: string[] = [];
  const exts: { ext: string; tool: string; raw: string }[] = [];
  for (const v of list) {
    if (v.startsWith("Bash:")) bashPrefixes.push(v.slice(5));
    else if (v.startsWith("Ext:")) {
      const rest = v.slice(4);
      const colon = rest.indexOf(":");
      if (colon > 0) {
        exts.push({
          ext: rest.slice(0, colon),
          tool: rest.slice(colon + 1),
          raw: v,
        });
      }
    } else tools.push(v);
  }

  const removeEntry = (entry: string) =>
    persist(list.filter((n) => n !== entry));

  if (list.length === 0) {
    return (
      <div className="settings-row settings-row-note">
        No always-allow rules yet. The next time Claude Code asks for
        permission, click <strong>“Always allow {"{tool}"}”</strong> or
        <strong> “Always allow {"<prefix>"}”</strong> on the card to add
        an entry here. <em>“Allow this session”</em> on the card adds a
        temporary in-memory rule that doesn't appear here — it resets
        when you restart Quack.
      </div>
    );
  }

  return (
    <>
      <div className="settings-row settings-row-note">
        Auto-approves matching requests without showing the permission card.
      </div>

      {tools.length > 0 && (
        <>
          <div className="cc-allow-subhead">Tools (any call)</div>
          <div className="cc-allow-list">
            {tools.map((name) => (
              <div key={`t:${name}`} className="cc-allow-row">
                <code className="cc-allow-name">{name}</code>
                <button
                  className="cc-allow-remove"
                  onClick={() => removeEntry(name)}
                  title={`Stop always-allowing ${name}`}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {bashPrefixes.length > 0 && (
        <>
          <div className="cc-allow-subhead">
            Bash command prefixes (auto-allow when the command starts with…)
          </div>
          <div className="cc-allow-list">
            {bashPrefixes.map((p) => (
              <div key={`b:${p}`} className="cc-allow-row">
                <code className="cc-allow-name">{p} …</code>
                <button
                  className="cc-allow-remove"
                  onClick={() => removeEntry(`Bash:${p}`)}
                  title={`Stop always-allowing Bash commands starting with "${p}"`}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {exts.length > 0 && (
        <>
          <div className="cc-allow-subhead">
            File extensions (auto-allow a tool on a specific filetype)
          </div>
          <div className="cc-allow-list">
            {exts.map((e) => (
              <div key={e.raw} className="cc-allow-row">
                <code className="cc-allow-name">
                  {e.tool} on {e.ext}
                </code>
                <button
                  className="cc-allow-remove"
                  onClick={() => removeEntry(e.raw)}
                  title={`Stop always-allowing ${e.tool} on ${e.ext} files`}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="settings-row">
        <button
          className="cc-allow-clear"
          onClick={async () => {
            const ok = await dialogConfirm(
              "Clear all always-allow entries? Claude Code will ask for permission on every tool call again until you re-add them.",
              {
                title: "Clear always-allow",
                okLabel: "Clear",
                cancelLabel: "Cancel",
                danger: true,
              },
            );
            if (ok) persist([]);
          }}
        >
          Clear all
        </button>
      </div>
    </>
  );
}
