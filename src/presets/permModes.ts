// Claude Code permission-mode options — shared between the composer's mode
// menu/Shift+Tab cycle (AIChatPanel.tsx) and the preset edit drawer
// (AgentCreateDrawer.tsx), so both read one source of truth. `v: null`
// means "Ask" (no forced mode — the default).
import type { IconName } from "../components/Icon";

export type PermModeTone = "ask" | "plan" | "auto-edit" | "auto" | "agent";

export interface PermModeOption {
  v: string | null;
  label: string;
  desc: string;
  icon: IconName;
  tone: PermModeTone;
}

export const PERM_MODE_OPTIONS: PermModeOption[] = [
  {
    v: null,
    label: "Ask",
    desc: "Confirm each edit / command",
    icon: "circle",
    tone: "ask",
  },
  {
    v: "plan",
    label: "Plan",
    desc: "Explore freely — no permission cards; edits still blocked",
    icon: "file-text",
    tone: "plan",
  },
  {
    v: "acceptEdits",
    label: "Auto-edit",
    desc: "Auto-accept file edits, ask for the rest",
    icon: "edit",
    tone: "auto-edit",
  },
  {
    v: "auto",
    label: "Auto",
    desc: "Run everything without asking (privacy guard stays)",
    icon: "zap",
    tone: "auto",
  },
  {
    v: "bypassPermissions",
    label: "Agent",
    desc: "Full autonomy — no permission cards, no guard",
    icon: "bot",
    tone: "agent",
  },
];

export function permModeOption(v: string | null): PermModeOption {
  return PERM_MODE_OPTIONS.find((o) => o.v === v) ?? PERM_MODE_OPTIONS[0]!;
}
