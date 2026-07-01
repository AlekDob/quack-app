import { useState } from "react";
import { setJson as lsSetJson } from "../localStore";
import { Toggle } from "./settingsBits";
import { CURSOR_FORCE_MODE_KEY, getForceMode } from "../providers/cursorCode";

/** Toggle --force on cursor-agent spawns (auto-approve tool calls). */
export function CursorCliForceEditor() {
  const [on, setOn] = useState<boolean>(() => getForceMode());
  const persist = (v: boolean) => {
    setOn(v);
    lsSetJson(CURSOR_FORCE_MODE_KEY, v);
  };
  return (
    <>
      <Toggle
        label="Force mode (--force)"
        value={on}
        onChange={persist}
      />
      <div className="settings-row settings-row-note">
        When enabled, Cursor CLI runs with <code>--force</code> so file edits
        and shell commands execute without approval prompts. Disable this if
        you want Cursor to ask before each tool call (headless runs may stall
        without <code>--force</code>).
      </div>
    </>
  );
}
