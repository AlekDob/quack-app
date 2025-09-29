interface ToolBarProps {
  onExecuteCommand: (command: string, label: string) => void
}

export default function ToolBar({ onExecuteCommand }: ToolBarProps) {
  const aiTools = [
    {
      id: 'microphone',
      label: 'Microfono',
      icon: '🎤',
      command: '', // Future implementation
      disabled: true,
    },
    {
      id: 'claude',
      label: 'Claude Code',
      icon: '⚡',
      command: 'claude --dangerously-skip-permissions',
      disabled: false,
    },
    {
      id: 'factory',
      label: 'Factory AI',
      icon: '🏭',
      command: 'droid',
      disabled: false,
    },
    {
      id: 'codex',
      label: 'Codex AI',
      icon: '🤖',
      command: 'Codex',
      disabled: false,
    },
  ]

  return (
    <div className="ai-toolbar">
      <div className="ai-toolbar-label">AI Tools</div>
      <div className="ai-toolbar-buttons">
        {aiTools.map((tool) => (
          <button
            key={tool.id}
            type="button"
            className={`ai-tool-button ${tool.disabled ? 'disabled' : ''}`}
            onClick={() => !tool.disabled && onExecuteCommand(tool.command, tool.label)}
            disabled={tool.disabled}
            title={tool.label}
          >
            <span className="ai-tool-icon">{tool.icon}</span>
            <span className="ai-tool-label">{tool.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}