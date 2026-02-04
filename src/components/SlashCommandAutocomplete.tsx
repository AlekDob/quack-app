import { useEffect, useRef } from 'react';
import type { SlashCommand } from '../hooks/useSlashCommands';

interface SlashCommandAutocompleteProps {
  commands: SlashCommand[];
  selectedIndex: number;
  onSelect: (command: SlashCommand) => void;
  onClose: () => void;
  position: { top: number; left: number };
}

export function SlashCommandAutocomplete({
  commands,
  selectedIndex,
  onSelect,
  onClose,
  position
}: SlashCommandAutocompleteProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      });
    }
  }, [selectedIndex]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (commands.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="fixed z-50 w-80 max-h-64 overflow-y-auto bg-[#1a1a1a] border border-white/10 rounded-lg shadow-2xl"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`
      }}
    >
      {/* Header */}
      <div className="sticky top-0 px-3 py-2 bg-[#1a1a1a] border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-white/50">Slash Commands</span>
          <span className="text-xs text-white/30">
            {commands.length} available
          </span>
        </div>
      </div>

      {/* Commands List */}
      <div className="py-1">
        {commands.map((command, index) => (
          <div
            key={command.name}
            ref={index === selectedIndex ? selectedItemRef : null}
            onClick={() => onSelect(command)}
            className={`
              px-3 py-2 cursor-pointer transition-colors duration-150
              ${index === selectedIndex
                ? 'bg-blue-500/20 border-l-2 border-blue-500'
                : 'hover:bg-white/5 border-l-2 border-transparent'
              }
            `}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={`
                text-sm font-medium
                ${index === selectedIndex ? 'text-blue-400' : 'text-white/90'}
              `}>
                /{command.name}
              </span>
              {command.isBuiltin && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-500/20 text-blue-400">
                  Built-in
                </span>
              )}
              {command.parameters && command.parameters.length > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium rounded" style={{ background: 'rgba(242, 140, 82, 0.2)', color: '#f28c52' }}>
                  {command.parameters.length} param{command.parameters.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-xs text-white/50 line-clamp-1">
              {command.description}
            </p>
            {command.parameters && command.parameters.length > 0 && index === selectedIndex && (
              <div className="flex flex-wrap gap-1 mt-1">
                {command.parameters.slice(0, 3).map((param, i) => (
                  <code key={i} className="px-1 py-0.5 text-[10px] rounded bg-white/5 text-white/60 font-mono">
                    {param}
                  </code>
                ))}
                {command.parameters.length > 3 && (
                  <span className="text-[10px] text-white/40">
                    +{command.parameters.length - 3} more
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer Hint */}
      <div className="sticky bottom-0 px-3 py-2 bg-[#1a1a1a] border-t border-white/10">
        <p className="text-[10px] text-white/30">
          ↑↓ Navigate • Enter Select • Esc Close
        </p>
      </div>
    </div>
  );
}
