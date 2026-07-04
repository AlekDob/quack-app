import { Icon } from "./Icon";
import type { CustomizationTab } from "./CustomizationsModal";

// Codetta's equivalents of VS Code's Agents/Skills/Instructions/Hooks/MCP
// group — each row opens the one Agent Customizations modal at its tab.
export function AgentCustomizations({
  onOpen,
}: {
  onOpen: (tab: CustomizationTab) => void;
}) {
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
