import { useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { NativeTerminal, NativeTerminalApp } from "../types";
import { toast } from "sonner";

interface NativeTerminalPanelProps {
  terminals: NativeTerminal[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onFocus: (terminal: NativeTerminal) => void;
  onOpen: (terminal: NativeTerminal) => void;
}

interface NativeTerminalResult {
  success: boolean;
  message: string;
  pid?: number;
}

export function NativeTerminalPanel({
  terminals,
  onAdd,
  onRemove,
  onFocus,
  onOpen,
}: NativeTerminalPanelProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleTerminalClick = useCallback(
    async (terminal: NativeTerminal) => {
      if (loading) return;

      setLoading(terminal.id);

      try {
        if (terminal.isOpen) {
          // Terminale già aperto - porta in primo piano
          const result = await invoke<NativeTerminalResult>("focus_native_terminal", {
            name: terminal.name,
            app: terminal.app,
          });

          if (result.success) {
            toast.success(`Focused: ${terminal.name}`);
            onFocus(terminal);
          } else {
            // Finestra non trovata - potrebbe essere chiusa
            toast.info(`Terminal window not found. Opening new window...`);
            await handleOpenTerminal(terminal);
          }
        } else {
          // Terminale non aperto - aprilo
          await handleOpenTerminal(terminal);
        }
      } catch (error) {
        console.error("Failed to interact with terminal:", error);
        toast.error(`Failed to open terminal: ${error}`);
      } finally {
        setLoading(null);
      }
    },
    [loading, onFocus, onOpen]
  );

  const handleOpenTerminal = async (terminal: NativeTerminal) => {
    try {
      const result = await invoke<NativeTerminalResult>("open_native_terminal", {
        name: terminal.name,
        directory: terminal.directory,
        app: terminal.app,
      });

      if (result.success) {
        toast.success(`Opened: ${terminal.name}`);
        onOpen(terminal);
      } else {
        toast.error(`Failed to open terminal: ${result.message}`);
      }
    } catch (error) {
      console.error("Failed to open terminal:", error);
      toast.error(`Failed to open terminal: ${error}`);
    }
  };

  const handleRemoveTerminal = useCallback(
    async (e: React.MouseEvent, terminal: NativeTerminal) => {
      e.stopPropagation();

      // Prima chiudi la finestra del terminale se è aperta
      if (terminal.isOpen) {
        try {
          await invoke<NativeTerminalResult>("close_native_terminal", {
            name: terminal.name,
            app: terminal.app,
          });
        } catch (error) {
          console.error("Failed to close terminal window:", error);
        }
      }

      // Poi rimuovi dalla lista
      onRemove(terminal.id);
      toast.info(`Removed: ${terminal.name}`);
    },
    [onRemove]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-white/10">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Native Terminals</h3>
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
            <div className="text-sm text-white/30">No terminals yet</div>
          </div>
        ) : (
          <div className="space-y-2">
            {terminals.map((terminal) => (
              <div
                key={terminal.id}
                onClick={() => handleTerminalClick(terminal)}
                className={`
                  group relative p-3 rounded-lg border border-white/5
                  cursor-pointer transition-all hover:bg-white/5
                  ${loading === terminal.id ? "opacity-50 cursor-wait" : ""}
                  ${terminal.isOpen ? "bg-white/[0.02]" : ""}
                `}
              >
                {/* Status Indicator */}
                <div className="flex items-start gap-3">
                  <div
                    className={`
                      mt-0.5 w-2.5 h-2.5 rounded-full flex-shrink-0
                      ${terminal.isOpen ? "bg-green-500" : "bg-gray-500"}
                    `}
                  />

                  {/* Terminal Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className="font-medium text-white/90 text-sm truncate">
                        {terminal.name}
                      </h3>
                      {/* Color Badge */}
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: terminal.color }}
                      />
                    </div>

                    {/* Directory */}
                    <p className="text-xs text-white/50 truncate font-mono">
                      {terminal.directory}
                    </p>

                    <p className="text-xs text-white/40 mt-0.5">
                      App: {terminal.app}
                    </p>

                    {/* Status Text */}
                    <p className="text-xs text-white/40 mt-1">
                      {terminal.isOpen ? "Open" : "Closed"}
                      {terminal.pid && ` • PID: ${terminal.pid}`}
                    </p>
                  </div>
                </div>

                {/* Remove Button */}
                <button
                  onClick={(e) => handleRemoveTerminal(e, terminal)}
                  className="
                    absolute top-2 right-2 opacity-0 group-hover:opacity-100
                    p-1 hover:bg-red-500/20 rounded transition-all
                  "
                  title="Remove terminal"
                >
                  <svg
                    className="w-4 h-4 text-red-400"
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
