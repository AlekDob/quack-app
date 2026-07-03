// Settings UI for per-user Jack preferences — custom instructions that
// get injected into the assistant system prompt on every turn.

import { useEffect, useState } from "react";
import { AIIcon } from "./AIIcon";
import {
  getJackCustomInstructions,
  JACK_CUSTOM_INSTRUCTIONS_MAX,
  saveJackCustomInstructions,
  subscribeJackCustomInstructions,
} from "../jackPrefs";

export function JackPrefsEditor() {
  const [draft, setDraft] = useState(() => getJackCustomInstructions());

  useEffect(() => subscribeJackCustomInstructions(setDraft), []);

  const commit = () => {
    const trimmed = draft.trimEnd();
    if (trimmed !== getJackCustomInstructions()) {
      saveJackCustomInstructions(trimmed);
    }
  };

  const chars = draft.length;
  const nearLimit = chars > JACK_CUSTOM_INSTRUCTIONS_MAX * 0.9;

  return (
    <>
      <div className="jack-prefs-hero liquid-glass">
        <div className="jack-prefs-avatar-ring" aria-hidden="true">
          <AIIcon size={56} className="jack-prefs-avatar" title="Jack" />
        </div>
        <div className="jack-prefs-hero-copy">
          <div className="jack-prefs-hero-name">Jack</div>
          <div className="jack-prefs-hero-title">Project Manager</div>
          <p className="jack-prefs-hero-blurb">
            Jack&apos;s core persona and safety rules are built into Quack.
            Tell him how <strong>you</strong> like to work — language, tone,
            PR style, stack habits — and he&apos;ll follow your notes on
            every chat turn.
          </p>
        </div>
      </div>
      <label className="jack-prefs-label" htmlFor="jack-prefs-input">
        Your instructions for Jack
      </label>
      <textarea
        id="jack-prefs-input"
        className="jack-prefs-field"
        value={draft}
        onChange={(e) =>
          setDraft(e.target.value.slice(0, JACK_CUSTOM_INSTRUCTIONS_MAX))
        }
        onBlur={commit}
        placeholder={
          "Examples:\n" +
          "- Reply in Italian when I write in Italian.\n" +
          "- Prefer small, surgical diffs — no drive-by refactors.\n" +
          "- When touching auth, always check middleware.ts first."
        }
        spellCheck={false}
        rows={10}
      />
      <div className="settings-row settings-row-note jack-prefs-meta">
        <span>
          Saved on blur. Applies to new messages immediately; in-flight
          turns keep the prompt they started with.
        </span>
        <span className={nearLimit ? "jack-prefs-chars-warn" : undefined}>
          {chars.toLocaleString()} / {JACK_CUSTOM_INSTRUCTIONS_MAX.toLocaleString()}
        </span>
      </div>
    </>
  );
}
