import type { SlashCommand } from '../hooks/useSlashCommands';

interface CommandItemProps {
  command: SlashCommand;
  onUse: (command: SlashCommand) => void;
  onEdit?: (command: SlashCommand) => void;
  onDelete?: (command: SlashCommand) => void;
}

export function CommandItem({ command, onUse, onEdit, onDelete }: CommandItemProps) {
  return (
    <div
      className="group flex items-start gap-3 p-3 rounded-lg hover:bg-white/5 transition-all duration-200"
    >
      {/* Command Icon */}
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
        <span className="text-sm">/</span>
      </div>

      {/* Command Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm text-white/90">
            /{command.name}
          </span>
          {command.isBuiltin && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-500/20 text-blue-400">
              Built-in
            </span>
          )}
          {command.parameters && command.parameters.length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-purple-500/20 text-purple-400">
              {command.parameters.length} param{command.parameters.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <p className="text-xs text-white/50 line-clamp-2">
          {command.description}
        </p>
        {command.parameters && command.parameters.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {command.parameters.map((param, i) => (
              <code key={i} className="px-1.5 py-0.5 text-[10px] rounded bg-white/5 text-white/60 font-mono">
                {param}
              </code>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onUse(command);
          }}
          className="px-2 py-1 text-xs font-medium rounded-md bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 transition-colors duration-200"
          title="Insert command into chat"
        >
          Insert
        </button>
        {!command.isBuiltin && onEdit && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(command);
            }}
            className="px-2 py-1 text-xs font-medium rounded-md bg-white/5 hover:bg-white/10 text-white/70 transition-colors duration-200"
            title="Edit command"
          >
            Edit
          </button>
        )}
        {!command.isBuiltin && onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(command);
            }}
            className="px-2 py-1 text-xs font-medium rounded-md bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors duration-200"
            title="Delete command"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
