import { useState } from 'react';
import { useSlashCommands } from '../hooks/useSlashCommands';
import type { SlashCommand } from '../hooks/useSlashCommands';
import { CommandsList } from './CommandsList';

interface CommandsPanelProps {
  basePath: string;
  onSelectCommand?: (commandName: string, commandScope: 'global' | 'project', isNew?: boolean) => void;
}

export function CommandsPanel({ basePath, onSelectCommand }: CommandsPanelProps) {
  const {
    commands,
    loading,
    error,
    loadCommands
  } = useSlashCommands(basePath);

  const [searchQuery, setSearchQuery] = useState('');

  // Filter commands based on search
  const filteredCustom = commands.custom.filter(cmd =>
    cmd.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cmd.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleNewCommand = () => {
    // Open new command tab with default scope 'project'
    if (onSelectCommand) {
      onSelectCommand('', 'project', true);
    }
  };

  const handleEditCommand = (command: SlashCommand) => {
    // Open command in tab for editing
    if (onSelectCommand) {
      onSelectCommand(command.name, command.scope as 'global' | 'project');
    }
  };


  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-white/10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Commands</h3>
          <button
            onClick={handleNewCommand}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors duration-200"
          >
            + New Command
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search commands..."
            className="w-full px-3 py-2 pl-8 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50"
          />
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-sm text-white/30">Loading commands...</div>
          </div>
        ) : error ? (
          <div className="px-3 py-6 text-center">
            <p className="text-xs text-red-400">{error}</p>
            <button
              onClick={loadCommands}
              className="mt-3 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 text-white/70 transition-colors duration-200"
            >
              Retry
            </button>
          </div>
        ) : (
          <CommandsList
            customCommands={filteredCustom}
            onEditCommand={handleEditCommand}
          />
        )}
      </div>
    </div>
  );
}
