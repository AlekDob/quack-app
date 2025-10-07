interface ToolBarProps {
  onExecuteCommand: (command: string, label: string) => void;
  onToggleSavedCommands: () => void;
  savedCommandsOpen: boolean;
  onOpenAIAssistant: () => void;
  onToggleQuackAgency: () => void;
  quackAgencyOpen: boolean;
}

export default function ToolBar({
  onExecuteCommand,
  onToggleSavedCommands,
  savedCommandsOpen,
  onOpenAIAssistant,
  onToggleQuackAgency,
  quackAgencyOpen,
}: ToolBarProps) {
  const aiTools = [
    {
      id: "saved-commands",
      label: savedCommandsOpen ? "Chiudi comandi" : "Comandi salvati",
      icon: "🗂️",
      command: "",
      disabled: false,
      type: "saved",
    },
    {
      id: "quack-agency",
      label: quackAgencyOpen ? "Chiudi Quack Agency" : "Quack Agency",
      icon: "🦆",
      command: "",
      disabled: false,
      type: "quack-agency",
    },
    {
      id: "ai-assistant",
      label: "AI Assistant",
      icon: "✨",
      command: "",
      disabled: false,
      type: "ai-modal",
    },
    {
      id: "microphone",
      label: "Microfono",
      icon: "🎤",
      command: "", // Future implementation
      disabled: true,
    },
    {
      id: "claude",
      label: "Claude Code",
      icon: "⚡",
      command: "claude --dangerously-skip-permissions",
      disabled: false,
    },
    {
      id: "factory",
      label: "Factory AI",
      icon: "🏭",
      command: "droid",
      disabled: false,
    },
    {
      id: "codex",
      label: "Codex AI",
      icon: "🤖",
      command: "Codex",
      disabled: false,
    },
  ];

  return (
    <div className="ai-toolbar">
      <div className="ai-toolbar-label">AI Tools</div>
      <div className="ai-toolbar-buttons">
        {aiTools.map((tool) => (
          <button
            key={tool.id}
            type="button"
            className={`ai-tool-button ${tool.disabled ? "disabled" : ""} ${(tool.type === "saved" && savedCommandsOpen) || (tool.type === "quack-agency" && quackAgencyOpen) ? "active" : ""}`}
            onClick={() => {
              if (tool.type === "saved") {
                onToggleSavedCommands();
              } else if (tool.type === "quack-agency") {
                onToggleQuackAgency();
              } else if (tool.type === "ai-modal") {
                onOpenAIAssistant();
              } else if (!tool.disabled) {
                onExecuteCommand(tool.command, tool.label);
              }
            }}
            disabled={tool.disabled}
            title={tool.label}
          >
            <span className="ai-tool-icon">{tool.icon}</span>
            <span className="ai-tool-label">{tool.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
