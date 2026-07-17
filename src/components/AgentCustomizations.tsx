import { openAgentSurface } from "../agentSurfaceNav";
import { Icon } from "./Icon";
import type { CustomizationTab } from "./CustomizationsModal";

type SurfaceItem = {
  surface: "team" | "works";
  label: string;
  icon: Parameters<typeof Icon>[0]["name"];
  hint: string;
};

// Codetta's equivalents of VS Code's Agents/Skills/Instructions/Hooks/MCP
// group — each row opens the one Agent Customizations modal at its tab.
export function AgentCustomizations({
  wsId,
  onOpen,
}: {
  wsId?: string | null;
  onOpen: (tab: CustomizationTab) => void;
}) {
  const surfaces: SurfaceItem[] = [
    {
      surface: "team",
      label: "Team",
      icon: "users",
      hint: "Agents, presets, and skills runbook",
    },
    {
      surface: "works",
      label: "Features",
      icon: "check-square",
      hint: "Product feature docs — documentation/features/",
    },
  ];

  const items: {
    tab: CustomizationTab;
    label: string;
    icon: Parameters<typeof Icon>[0]["name"];
    hint: string;
  }[] = [
    {
      tab: "instructions",
      label: "Instructions",
      icon: "file-text",
      hint: "Workspace rules fed into every prompt",
    },
    {
      tab: "skills",
      label: "Skills",
      icon: "star",
      hint: "Reusable workflows Claude can invoke",
    },
    {
      tab: "plugins",
      label: "Plugins",
      icon: "code",
      hint: "Install plugins from a GitHub marketplace",
    },
    {
      tab: "mcp",
      label: "MCP Servers",
      icon: "globe",
      hint: "Add / manage external tool servers",
    },
    {
      tab: "tools",
      label: "Tool Access",
      icon: "wrench",
      hint: "Permissions & always-allow tools",
    },
    {
      tab: "providers",
      label: "Providers",
      icon: "settings",
      hint: "API keys & models",
    },
    {
      tab: "privacy",
      label: "Privacy",
      icon: "eye",
      hint: "Paths excluded from the AI",
    },
  ];

  return (
    <div className="agent-custom">
      {wsId &&
        surfaces.map((it) => (
          <button
            key={it.surface}
            type="button"
            className="agent-custom-item"
            onClick={() => openAgentSurface(wsId, it.surface)}
            title={it.hint}
          >
            <Icon name={it.icon} size={13} />
            <span className="agent-custom-label">{it.label}</span>
          </button>
        ))}
      <div className="agent-custom-title">Customizations</div>
      {items.map((it) => (
        <button
          key={it.tab}
          className="agent-custom-item"
          onClick={() => onOpen(it.tab)}
          title={it.hint}
        >
          <Icon name={it.icon} size={13} />
          <span className="agent-custom-label">{it.label}</span>
        </button>
      ))}
    </div>
  );
}
