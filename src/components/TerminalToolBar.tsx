import './TerminalToolBar.css';
import TerminalWindowButton from './TerminalWindowButton';

interface TerminalToolBarProps {
  onExecuteCommand: (command: string, label: string) => void;
  onToggleSavedCommands: () => void;
  savedCommandsOpen: boolean;
  onCreateTerminal: () => void;
  onQuickLaunchNativeTerminal?: (command: string, label: string) => void;
}

export default function TerminalToolBar({
  onExecuteCommand,
  onToggleSavedCommands,
  savedCommandsOpen,
  onCreateTerminal,
  onQuickLaunchNativeTerminal,
}: TerminalToolBarProps) {
  const tools = [
    {
      id: "saved-commands",
      label: "Comandi salvati",
      command: "",
      type: "saved",
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v2H2V3Z"/>
          <path d="M2 6h12v7a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6Z"/>
        </svg>
      ),
    },
    {
      id: "claude",
      label: "Claude Code",
      command: "claude --dangerously-skip-permissions",
      type: "command",
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 2l6 4v6l-6 4-6-4V6l6-4Z" opacity="0.5"/>
          <path d="M8 6l3 2v3l-3 2-3-2V8l3-2Z"/>
        </svg>
      ),
    },
    {
      id: "factory",
      label: "Factory AI",
      command: "droid",
      type: "command",
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 6h12v7a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6Z"/>
          <path d="M4 3h3v3H4V3ZM9 3h3v3H9V3Z" opacity="0.6"/>
        </svg>
      ),
    },
    {
      id: "codex",
      label: "Codex AI",
      command: "Codex",
      type: "command",
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="8" r="6" opacity="0.5"/>
          <path d="M8 4v8M4 8h8" strokeWidth="2" stroke="currentColor" fill="none"/>
        </svg>
      ),
    },
  ];

  return (
    <div className="terminal-toolbar">
      {/* New Terminal Tab Button - primo pulsante a sinistra */}
      <TerminalWindowButton onCreateTerminal={onCreateTerminal} />

      {/* Separator */}
      <div className="terminal-toolbar-separator" />

      {/* Existing tools */}
      {tools.map((tool) => (
        <button
          key={tool.id}
          type="button"
          className={`terminal-tool-button ${(tool.type === "saved" && savedCommandsOpen) ? "active" : ""}`}
          onClick={() => {
            if (tool.type === "saved") {
              onToggleSavedCommands();
            } else if (tool.type === "command" && onQuickLaunchNativeTerminal) {
              // AI tool buttons (Claude Code, Factory AI, Codex) create native terminals
              onQuickLaunchNativeTerminal(tool.command, tool.label);
            } else {
              // Fallback to execute command in internal terminal
              onExecuteCommand(tool.command, tool.label);
            }
          }}
          data-tooltip={tool.label}
          aria-label={tool.label}
        >
          {tool.icon}
        </button>
      ))}
    </div>
  );
}
