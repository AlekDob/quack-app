import { useCallback, useState } from "react";
import { TerminalDrawer, disposeTerminal } from "./TerminalDrawer";
import { toast } from "sonner";

interface TerminalWindow {
  id: string;
  name: string;
  directory: string;
  color: string;
  terminalId?: string; // Backend terminal ID (PTY session)
}

interface TerminalWindowsPanelProps {
  terminals: TerminalWindow[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdateTerminal: (id: string, updates: Partial<TerminalWindow>) => void;
  // TerminalToolBar props for drawer integration
  onToggleSavedCommands: () => void;
  savedCommandsOpen: boolean;
}

export function TerminalWindowsPanel({
  terminals,
  onAdd,
  onRemove,
  onUpdateTerminal,
  onToggleSavedCommands,
  savedCommandsOpen,
}: TerminalWindowsPanelProps) {
  const [activeTerminal, setActiveTerminal] = useState<TerminalWindow | null>(null);

  // Callback quando il terminal viene creato nel backend
  const handleTerminalCreated = useCallback((terminalId: string) => {
    console.log('🦆 handleTerminalCreated called with:', terminalId);
    if (activeTerminal) {
      console.log('🦆 Updating terminal:', activeTerminal.id, 'with terminalId:', terminalId);
      onUpdateTerminal(activeTerminal.id, { terminalId });
      // Update activeTerminal locally too so it has the terminalId
      setActiveTerminal(prev => prev ? { ...prev, terminalId } : null);
    }
  }, [activeTerminal, onUpdateTerminal]);

  const handleTerminalClick = useCallback(
    (terminal: TerminalWindow) => {
      // Always get the latest version from terminals list (it may have been updated with terminalId)
      const latestTerminal = terminals.find(t => t.id === terminal.id) || terminal;
      console.log('🦆 Opening terminal:', latestTerminal.name, 'with terminalId:', latestTerminal.terminalId);
      setActiveTerminal(latestTerminal);
      // Removed notification: toast.success(`Opened: ${terminal.name}`);
    },
    [terminals]
  );

  const handleRemoveTerminal = useCallback(
    (e: React.MouseEvent, terminal: TerminalWindow) => {
      e.stopPropagation();

      // Close drawer if this terminal is active
      if (activeTerminal?.id === terminal.id) {
        setActiveTerminal(null);
      }

      // Completely dispose terminal instance (xterm + backend PTY)
      if (terminal.terminalId) {
        disposeTerminal(terminal.terminalId);
      }

      // Remove from list
      onRemove(terminal.id);
      toast.info(`Removed: ${terminal.name}`);
    },
    [activeTerminal, onRemove]
  );

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-white/10">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Terminal Windows</h3>
          <button
            onClick={onAdd}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors duration-200"
          >
            + Add Terminal
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {terminals.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-sm text-white/30">No terminal windows yet</div>
          </div>
        ) : (
          <div className="space-y-2">
            {terminals.map((terminal) => {
              const isOpen = activeTerminal?.id === terminal.id;

              return (
                <div
                  key={terminal.id}
                  onClick={() => handleTerminalClick(terminal)}
                  className={`
                    group relative p-3 rounded-lg border border-white/5
                    cursor-pointer transition-all hover:bg-white/5
                    ${isOpen ? "bg-white/[0.02]" : ""}
                  `}
                >
                  {/* Status Indicator */}
                  <div className="flex items-start gap-3">
                    <div
                      className="mt-0.5 w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: terminal.color }}
                    />

                    {/* Terminal Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-medium text-white/90 text-sm truncate">
                          {terminal.name}
                        </h3>
                        {/* Remove Button */}
                        <button
                          onClick={(e) => handleRemoveTerminal(e, terminal)}
                          className="
                            opacity-0 group-hover:opacity-100 flex-shrink-0
                            p-1 hover:bg-red-500/20 rounded transition-all
                          "
                          title="Remove terminal"
                        >
                          <svg
                            className="w-3 h-3 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>

                      {/* Directory */}
                      <p className="text-xs text-white/50 truncate font-mono">
                        {terminal.directory}
                      </p>

                      {/* Status Text */}
                      <p className="text-xs text-white/40 mt-1">
                        {isOpen ? "Open" : "Closed"}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Terminal Drawers - render ALL terminals, show only active one */}
      {terminals.map((terminal) => (
        <TerminalDrawer
          key={terminal.terminalId || terminal.id}
          isOpen={activeTerminal?.id === terminal.id}
          onClose={() => setActiveTerminal(null)}
          terminalName={terminal.name}
          cwd={terminal.directory}
          color={terminal.color}
          existingTerminalId={terminal.terminalId}
          onTerminalCreated={handleTerminalCreated}
          onToggleSavedCommands={onToggleSavedCommands}
          savedCommandsOpen={savedCommandsOpen}
        />
      ))}
    </div>
  );
}
