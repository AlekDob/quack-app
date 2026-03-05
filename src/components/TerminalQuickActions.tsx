import './TerminalQuickActions.css';

interface TerminalQuickActionsProps {
  onOpenTerminalHelper: () => void;
  onExecuteCommand: (command: string, label: string) => void;
  onToggleSavedCommands: () => void;
}

export default function TerminalQuickActions({
  onOpenTerminalHelper,
  onExecuteCommand,
  onToggleSavedCommands,
}: TerminalQuickActionsProps) {
  const quickActions = [
    {
      id: "terminal-helper",
      label: "Terminal Helper",
      icon: "🤖",
      type: "terminal-helper",
    },
    {
      id: "claude",
      label: "Claude Code",
      icon: "⚡",
      command: "claude --dangerously-skip-permissions",
    },
    {
      id: "factory",
      label: "Factory AI",
      icon: "🏭",
      command: "droid",
    },
    {
      id: "codex",
      label: "Codex AI",
      icon: "🤖",
      command: "Codex",
    },
    {
      id: "saved-commands",
      label: "Saved Commands",
      icon: "🗂️",
      type: "saved-commands",
    },
  ];

  return (
    <div className="terminal-quick-actions">
      {quickActions.map((action) => (
        <button
          key={action.id}
          type="button"
          className="terminal-quick-action-btn"
          onClick={() => {
            if (action.type === "terminal-helper") {
              onOpenTerminalHelper();
            } else if (action.type === "saved-commands") {
              onToggleSavedCommands();
            } else if (action.command) {
              onExecuteCommand(action.command, action.label);
            }
          }}
          title={action.label}
        >
          <span className="terminal-quick-action-icon">{action.icon}</span>
        </button>
      ))}
    </div>
  );
}
