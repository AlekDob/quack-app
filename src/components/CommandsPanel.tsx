import { useState } from 'react';
import { useSlashCommands } from '../hooks/useSlashCommands';
import type { SlashCommand } from '../hooks/useSlashCommands';
import { CommandsList } from './CommandsList';
import { CommandEditor } from './CommandEditor';

interface CommandsPanelProps {
  basePath: string;
  onUseCommand: (command: SlashCommand) => void;
}

export function CommandsPanel({ basePath, onUseCommand }: CommandsPanelProps) {
  const {
    commands,
    loading,
    error,
    createCommand,
    updateCommand,
    deleteCommand,
    loadCommands
  } = useSlashCommands(basePath);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingCommand, setEditingCommand] = useState<SlashCommand | undefined>();
  const [searchQuery, setSearchQuery] = useState('');

  // Filter commands based on search
  const filteredBuiltin = commands.builtin.filter(cmd =>
    cmd.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cmd.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCustom = commands.custom.filter(cmd =>
    cmd.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cmd.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleNewCommand = () => {
    setEditingCommand(undefined);
    setEditorOpen(true);
  };

  const handleEditCommand = (command: SlashCommand) => {
    setEditingCommand(command);
    setEditorOpen(true);
  };

  const handleDeleteCommand = async (command: SlashCommand) => {
    if (!confirm(`Are you sure you want to delete the command "/${command.name}"?`)) {
      return;
    }

    try {
      await deleteCommand(command.name);
    } catch (err) {
      console.error('Failed to delete command:', err);
      alert('Failed to delete command. Please try again.');
    }
  };

  const handleSaveCommand = async (
    name: string,
    description: string,
    content: string,
    parameters: string[]
  ) => {
    if (editingCommand) {
      // Update existing command
      await updateCommand(name, description, content, parameters);
    } else {
      // Create new command
      await createCommand(name, description, content, parameters);
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
            builtinCommands={filteredBuiltin}
            customCommands={filteredCustom}
            onUseCommand={onUseCommand}
            onEditCommand={handleEditCommand}
            onDeleteCommand={handleDeleteCommand}
          />
        )}
      </div>

      {/* Command Editor Modal */}
      <CommandEditor
        isOpen={editorOpen}
        command={editingCommand}
        onClose={() => setEditorOpen(false)}
        onSave={handleSaveCommand}
      />
    </div>
  );
}
