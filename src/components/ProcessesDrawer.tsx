import { useMemo } from "react";
import type { ProcessInfo } from "../types";

interface ProcessesDrawerProps {
  open: boolean;
  processes: ProcessInfo[];
  onClose: () => void;
  onRefresh: () => void;
  onFocusTerminal: (terminalId: string) => void;
}

const formatUptime = (seconds: number) => {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m`;
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
};

export default function ProcessesDrawer({
  open,
  processes,
  onClose,
  onRefresh,
  onFocusTerminal,
}: ProcessesDrawerProps) {
  const sortedProcesses = useMemo(() => {
    return [...processes].sort((a, b) =>
      a.terminalLabel.localeCompare(b.terminalLabel)
    );
  }, [processes]);

  const handleOpenUrl = (port: number) => {
    const url = `http://localhost:${port}`;
    try {
      if (typeof window !== "undefined") {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      console.error("Impossibile aprire il browser", error);
    }
  };

  return (
    <div className={`processes-drawer ${open ? "open" : ""}`}>
      <div className="processes-drawer-backdrop" onClick={onClose} />
      <div className="processes-drawer-panel">
        <header className="processes-drawer-header">
          <h2>Processi attivi</h2>
          <button
            type="button"
            className="processes-drawer-close"
            title="Close"
            onClick={onClose}
          >
            ✕
          </button>
        </header>
        <div className="processes-drawer-body">
          {sortedProcesses.length === 0 && (
            <div className="processes-empty">
              Nessun terminale attivo in questo momento.
            </div>
          )}
          {sortedProcesses.map((process) => (
            <article key={process.terminalId} className="process-card">
              <header className="process-card-header">
                <span
                  className="process-card-status"
                  role="img"
                  aria-label={
                    process.status === "running" ? "In esecuzione" : "In attesa"
                  }
                >
                  {process.status === "running" ? "🟢" : "🟡"}
                </span>
                <div className="process-card-title">
                  <strong>{process.terminalLabel}</strong>
                  {process.command && (
                    <span className="process-card-command">
                      {process.command}
                    </span>
                  )}
                </div>
              </header>
              <div className="process-card-meta">
                {process.port && (
                  <button
                    type="button"
                    className="process-port-link"
                    onClick={() => handleOpenUrl(process.port)}
                  >
                    :{process.port}
                  </button>
                )}
                {process.pid && (
                  <span className="process-card-detail">
                    PID: {process.pid}
                  </span>
                )}
                <span className="process-card-detail">
                  ⏱️ {formatUptime(process.uptimeSeconds)}
                </span>
              </div>
              <div className="process-card-actions">
                <button
                  type="button"
                  className="primary"
                  onClick={() => onFocusTerminal(process.terminalId)}
                >
                  Vai al terminale
                </button>
              </div>
            </article>
          ))}
        </div>
        <footer className="processes-drawer-footer">
          <button type="button" onClick={onRefresh}>
            🔄 Aggiorna
          </button>
        </footer>
      </div>
    </div>
  );
}
