// Claude Code permission-mode options — shared between the composer's mode
// menu/Shift+Tab cycle (AIChatPanel.tsx) and the preset edit drawer
// (AgentCreateDrawer.tsx), so both read one source of truth. `v: null`
// means "Ask" (no forced mode — the default).
export interface PermModeOption {
  v: string | null;
  label: string;
  desc: string;
}

export const PERM_MODE_OPTIONS: PermModeOption[] = [
  { v: null, label: "Ask", desc: "Confirm each edit / command" },
  { v: "plan", label: "Plan", desc: "Plan only — no edits" },
  { v: "acceptEdits", label: "Auto-edit", desc: "Auto-accept file edits, ask for the rest" },
  { v: "auto", label: "Auto", desc: "Run everything without asking (privacy guard stays)" },
  {
    v: "bypassPermissions",
    label: "Bypass",
    desc: "Skip all permission checks — no cards, no guard",
  },
];
