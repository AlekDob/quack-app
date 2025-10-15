import { useState } from 'react';
import type { SlashCommand } from '../hooks/useSlashCommands';
import { CommandItem } from './CommandItem';

interface CommandsListProps {
  builtinCommands: SlashCommand[];
  customCommands: SlashCommand[];
  onUseCommand: (command: SlashCommand) => void;
  onEditCommand: (command: SlashCommand) => void;
  onDeleteCommand: (command: SlashCommand) => void;
}

// Simple section header component for commands
function SectionHeader({ title, count, expanded, onToggle }: {
  title: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full px-3 py-2 flex items-center gap-2 text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
    >
      <span className={`transition-transform ${expanded ? 'rotate-90' : ''}`}>▶</span>
      <span>{title}</span>
      <span className="ml-auto text-xs text-white/40">{count}</span>
    </button>
  );
}

export function CommandsList({
  builtinCommands,
  customCommands,
  onUseCommand,
  onEditCommand,
  onDeleteCommand
}: CommandsListProps) {
  const [builtinExpanded, setBuiltinExpanded] = useState(true);
  const [customExpanded, setCustomExpanded] = useState(true);

  return (
    <div className="flex flex-col gap-4">
      {/* Built-in Commands Section */}
      <div>
        <SectionHeader
          title="Claude Code Commands"
          count={builtinCommands.length}
          expanded={builtinExpanded}
          onToggle={() => setBuiltinExpanded(!builtinExpanded)}
        />
        {builtinExpanded && (
          <div className="mt-2 space-y-1">
            {builtinCommands.length === 0 ? (
              <div className="px-3 py-6 text-center">
                <p className="text-xs text-white/30">No built-in commands available</p>
              </div>
            ) : (
              builtinCommands.map((command) => (
                <CommandItem
                  key={command.name}
                  command={command}
                  onUse={onUseCommand}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Custom Commands Section */}
      <div>
        <SectionHeader
          title="Custom Commands"
          count={customCommands.length}
          expanded={customExpanded}
          onToggle={() => setCustomExpanded(!customExpanded)}
        />
        {customExpanded && (
          <div className="mt-2 space-y-1">
            {customCommands.length === 0 ? (
              <div className="px-3 py-6 text-center">
                <p className="text-xs text-white/30">No custom commands yet</p>
                <p className="text-xs text-white/20 mt-1">Click "New Command" to create one</p>
              </div>
            ) : (
              customCommands.map((command) => (
                <CommandItem
                  key={command.name}
                  command={command}
                  onUse={onUseCommand}
                  onEdit={onEditCommand}
                  onDelete={onDeleteCommand}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
