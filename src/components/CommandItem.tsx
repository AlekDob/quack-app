import type { SlashCommand } from '../hooks/useSlashCommands';

interface CommandItemProps {
  command: SlashCommand;
  onEdit?: (command: SlashCommand) => void;
}

export function CommandItem({ command, onEdit }: CommandItemProps) {
  return (
    <div
      className="group flex items-start gap-3 p-3 rounded-lg hover:bg-white/5 transition-all duration-200 cursor-pointer"
      onClick={() => onEdit?.(command)}
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

    </div>
  );
}
