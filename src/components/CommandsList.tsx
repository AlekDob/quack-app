import { useState } from 'react';
import type { SlashCommand } from '../hooks/useSlashCommands';
import { CommandItem } from './CommandItem';

interface CommandsListProps {
  customCommands: SlashCommand[];
  onUseCommand: (command: SlashCommand) => void;
  onViewCommand: (command: SlashCommand) => void;
  onEditCommand: (command: SlashCommand) => void;
  onDeleteCommand: (command: SlashCommand) => void;
}

export function CommandsList({
  customCommands,
  onUseCommand,
  onViewCommand,
  onEditCommand,
  onDeleteCommand
}: CommandsListProps) {
  const [globalExpanded, setGlobalExpanded] = useState(true);
  const [projectExpanded, setProjectExpanded] = useState(true);

  // Group custom commands by scope
  const globalCommands = customCommands.filter(cmd => cmd.scope === 'global');
  const projectCommands = customCommands.filter(cmd => cmd.scope === 'project');

  return (
    <div className="flex flex-col gap-4">

      {/* Project Commands Section */}
      {projectCommands.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setProjectExpanded(!projectExpanded)}
            className="w-full px-3 py-2 flex items-center gap-2 text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            <span className={`transition-transform ${projectExpanded ? 'rotate-90' : ''}`}>▶</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <span>Project Commands</span>
            <span className="ml-auto text-xs text-white/40">{projectCommands.length}</span>
          </button>
          {projectExpanded && (
            <div className="mt-2 space-y-1">
              {projectCommands.map((command) => (
                <CommandItem
                  key={command.name}
                  command={command}
                  onUse={onUseCommand}
                  onView={onViewCommand}
                  onEdit={onEditCommand}
                  onDelete={onDeleteCommand}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Global Commands Section */}
      {globalCommands.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setGlobalExpanded(!globalExpanded)}
            className="w-full px-3 py-2 flex items-center gap-2 text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            <span className={`transition-transform ${globalExpanded ? 'rotate-90' : ''}`}>▶</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <circle cx="12" cy="12" r="10" strokeWidth={2} />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 12h20" />
            </svg>
            <span>Global Commands</span>
            <span className="ml-auto text-xs text-white/40">{globalCommands.length}</span>
          </button>
          {globalExpanded && (
            <div className="mt-2 space-y-1">
              {globalCommands.map((command) => (
                <CommandItem
                  key={command.name}
                  command={command}
                  onUse={onUseCommand}
                  onView={onViewCommand}
                  onEdit={onEditCommand}
                  onDelete={onDeleteCommand}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
