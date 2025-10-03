import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePreviewManager, type PreviewProfile } from "../composables/usePreviewManager";
import { inspectorBridge, type InspectorData } from "../services/inspectorBridge";

const STATUS_LABEL: Record<"idle" | "checking" | "online" | "offline", string> = {
  idle: "Idle",
  checking: "Checking",
  online: "Online",
  offline: "Offline",
};

const STATUS_TONE: Record<"idle" | "checking" | "online" | "offline", string> = {
  idle: "bg-slate-500/60",
  checking: "bg-amber-400",
  online: "bg-emerald-400",
  offline: "bg-rose-500",
};

export default function PreviewPanel() {
  const {
    profiles,
    selectedProfileId,
    selectedProfile,
    customUrl,
    previewUrl,
    status,
    lastError,
    inspectorEnabled,
    reloadToken,
    refresh,
    toggleInspector,
    openExternal,
    checkAvailability,
    selectProfile,
    setCustomUrl,
  } = usePreviewManager();

  const [inspectorData, setInspectorData] = useState<InspectorData | null>(null);
  const [inspectorHistory, setInspectorHistory] = useState<InspectorData[]>([]);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Initialize inspector bridge
  useEffect(() => {
    inspectorBridge.init();

    const handleHover = (data: InspectorData | Record<string, unknown>) => {
      if ('element' in data && 'component' in data) {
        setInspectorData(data as InspectorData);
      }
    };

    const handleClick = (data: InspectorData | Record<string, unknown>) => {
      if ('element' in data && 'component' in data) {
        const inspectorData = data as InspectorData;
        setInspectorData(inspectorData);
        setInspectorHistory(prev => [inspectorData, ...prev.slice(0, 4)]);
      }
    };

    inspectorBridge.on('hover', handleHover);
    inspectorBridge.on('click', handleClick);

    return () => {
      inspectorBridge.off('hover', handleHover);
      inspectorBridge.off('click', handleClick);
      inspectorBridge.destroy();
    };
  }, []);

  // Inject script when iframe loads
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !previewUrl) return;

    const handleLoad = async () => {
      try {
        await inspectorBridge.injectScript(iframe);
        console.log('🦆 Inspector ready!');
      } catch (error) {
        console.error('Failed to inject inspector:', error);
      }
    };

    iframe.addEventListener('load', handleLoad);

    return () => {
      iframe.removeEventListener('load', handleLoad);
    };
  }, [previewUrl, reloadToken]);

  // Toggle inspector when enabled changes
  useEffect(() => {
    inspectorBridge.toggle(inspectorEnabled);

    if (!inspectorEnabled) {
      setInspectorData(null);
    }
  }, [inspectorEnabled]);

  // Copy inspector data to clipboard for AI
  const copyForAI = useCallback(() => {
    if (!inspectorData) return;

    const { element, component } = inspectorData;

    let text = '# Inspector Data\n\n';

    if (component?.componentName) {
      text += `## Component: ${component.componentName}\n\n`;
      if (component.fileName) {
        text += `**File:** ${component.fileName}`;
        if (component.lineNumber) {
          text += `:${component.lineNumber}`;
          if (component.columnNumber) {
            text += `:${component.columnNumber}`;
          }
        }
        text += '\n\n';
      }
      if (component.componentStack.length > 0) {
        text += `**Stack:** ${component.componentStack.join(' > ')}\n\n`;
      }
      if (component.props) {
        text += `**Props:**\n\`\`\`json\n${JSON.stringify(component.props, null, 2)}\n\`\`\`\n\n`;
      }
    }

    text += `## Element: <${element.tagName}>\n\n`;
    if (element.className) text += `**Class:** ${element.className}\n`;
    if (element.id) text += `**ID:** ${element.id}\n`;

    navigator.clipboard.writeText(text);

    console.log('📋 Copied to clipboard for AI!');
  }, [inspectorData]);

  useEffect(() => {
    void checkAvailability();
  }, [checkAvailability, previewUrl]);

  // Keyboard shortcut: Cmd/Ctrl + I to toggle inspector
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'i' && previewUrl) {
        e.preventDefault();
        toggleInspector();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [previewUrl, toggleInspector]);

  return (
    <section className="flex h-full min-h-0 w-full flex-col bg-[#0d1017]">
      <header className="flex flex-col gap-3 border-b border-slate-800/60 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            Profilo
            <select
              value={selectedProfileId ?? ""}
              onChange={(event) => selectProfile(event.target.value || null)}
              className="h-8 rounded-md border border-slate-700 bg-slate-900/80 px-2 text-xs text-slate-100 shadow-inner outline-none transition focus:border-slate-500"
            >
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id} className="bg-slate-900">
                  {profile.label}
                </option>
              ))}
              <option value="" className="bg-slate-900">
                Nessuno
              </option>
            </select>
          </label>
          <PortInput portSource={customUrl} profile={selectedProfile} onChange={setCustomUrl} />
          <UrlInput value={customUrl ?? ""} onChange={setCustomUrl} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className={`h-2.5 w-2.5 rounded-full ${STATUS_TONE[status]}`} aria-hidden="true" />
            <span className="text-xs font-medium uppercase tracking-wide text-slate-300">
              {STATUS_LABEL[status]}
            </span>
            {previewUrl ? (
              <span className="truncate text-xs text-slate-500">{previewUrl}</span>
            ) : (
              <span className="text-xs text-slate-600">Nessuna anteprima configurata</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void checkAvailability()}
              className="rounded-md border border-slate-700/70 bg-slate-800/70 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-700"
            >
              Check
            </button>
            <button
              type="button"
              onClick={refresh}
              className="rounded-md border border-slate-700/70 bg-slate-800/70 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-700"
              disabled={!previewUrl}
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={() => openExternal()}
              className="rounded-md border border-slate-700/70 bg-slate-800/70 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-700"
              disabled={!previewUrl}
            >
              Apri
            </button>
          </div>
        </div>
      </header>

      {previewUrl ? (
        <div className="relative flex flex-1 bg-black/20">
          <div className={`flex-1 transition-shadow ${inspectorEnabled ? "ring-1 ring-emerald-400/50" : ""}`}>
            <iframe
              ref={iframeRef}
              key={`${previewUrl}-${reloadToken}`}
              src={previewUrl}
              title="Preview"
              className="h-full w-full border-0"
              sandbox="allow-forms allow-modals allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts allow-top-navigation-by-user-activation"
              allow="cross-origin-isolated"
            />
          </div>

          {/* Inspector Toggle Button */}
          <button
            type="button"
            onClick={toggleInspector}
            aria-pressed={inspectorEnabled}
            className={`absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium backdrop-blur transition ${
              inspectorEnabled
                ? "border border-emerald-400/70 bg-emerald-500/20 text-emerald-100 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]"
                : "border border-slate-700/75 bg-slate-900/95 text-slate-200 shadow-lg hover:border-slate-500"
            }`}
          >
            <span
              className={`h-2.5 w-2.5 rounded-full border ${
                inspectorEnabled
                  ? "border-emerald-400/80 bg-emerald-400/60 animate-pulse"
                  : "border-slate-500/70 bg-slate-800/80"
              }`}
            />
            {inspectorEnabled ? "Inspector attivo" : "Attiva inspector"}
          </button>

          {/* Inspector Panel */}
          {inspectorEnabled && inspectorData && (
            <div className="absolute right-4 top-4 w-80 rounded-lg border border-emerald-400/30 bg-slate-900/95 p-4 shadow-2xl backdrop-blur">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <div className="text-sm font-semibold text-emerald-400">
                    {inspectorData.component?.componentName || inspectorData.element.tagName}
                  </div>
                  {inspectorData.component?.fileName && (
                    <div className="mt-1 font-mono text-xs text-slate-400">
                      {inspectorData.component.fileName.split('/').pop()}
                      {inspectorData.component.lineNumber && `:${inspectorData.component.lineNumber}`}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={copyForAI}
                  className="rounded border border-emerald-500/40 bg-emerald-500/20 px-2 py-1 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/30"
                >
                  Copia AI
                </button>
              </div>

              {inspectorData.component?.componentStack && inspectorData.component.componentStack.length > 0 && (
                <div className="mb-3 text-xs text-slate-400">
                  <div className="mb-1 font-medium text-slate-300">Stack:</div>
                  <div className="font-mono">{inspectorData.component.componentStack.join(' > ')}</div>
                </div>
              )}

              {inspectorData.element.className && (
                <div className="mb-2 text-xs">
                  <span className="text-slate-400">Class: </span>
                  <span className="font-mono text-slate-300">{inspectorData.element.className}</span>
                </div>
              )}

              {inspectorData.hasReact ? (
                <div className="mt-3 rounded bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300">
                  ✓ React detected
                </div>
              ) : (
                <div className="mt-3 rounded bg-amber-500/10 px-2 py-1 text-xs text-amber-300">
                  ⚠ No React DevTools
                </div>
              )}
            </div>
          )}

          {/* History */}
          {inspectorHistory.length > 0 && inspectorEnabled && (
            <div className="absolute bottom-20 right-4 w-64 rounded-lg border border-slate-700/50 bg-slate-900/90 p-3 shadow-xl backdrop-blur">
              <div className="mb-2 text-xs font-medium text-slate-400">History</div>
              <div className="space-y-1.5">
                {inspectorHistory.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setInspectorData(item)}
                    className="w-full rounded border border-slate-700/50 bg-slate-800/50 px-2 py-1.5 text-left text-xs transition hover:border-emerald-500/40 hover:bg-slate-700/50"
                  >
                    <div className="font-medium text-slate-200">
                      {item.component?.componentName || item.element.tagName}
                    </div>
                    {item.component?.fileName && (
                      <div className="mt-0.5 truncate font-mono text-xs text-slate-500">
                        {item.component.fileName.split('/').pop()}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-slate-500">
          Configura una porta o un URL per vedere la preview della tua app.
        </div>
      )}

      {inspectorEnabled ? (
        <div className="border-t border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-100">
          <div className="flex items-center justify-between">
            <span>Inspector attivo - Hover elementi per dettagli, click per salvare in history</span>
            <span className="font-mono text-emerald-300/70">⌘I / Ctrl+I</span>
          </div>
        </div>
      ) : lastError ? (
        <div className="border-t border-rose-500/40 bg-rose-500/15 px-4 py-2 text-xs text-rose-200">
          {lastError}
        </div>
      ) : null}
    </section>
  );
}

function PortInput({
  portSource,
  profile,
  onChange,
}: {
  portSource: string | null;
  profile: PreviewProfile | null;
  onChange: (url: string | null) => void;
}) {
  const portValue = useMemo(() => {
    if (portSource && portSource.startsWith("http://localhost:")) {
      const part = portSource.replace("http://localhost:", "");
      return part.split("/")[0];
    }
    if (profile?.port) {
      return String(profile.port);
    }
    return "";
  }, [portSource, profile]);

  return (
    <label className="flex items-center gap-2 text-xs text-slate-400">
      Porta
      <input
        type="number"
        inputMode="numeric"
        min={0}
        className="h-8 w-20 rounded-md border border-slate-700 bg-slate-900/80 px-2 text-xs text-slate-100 shadow-inner outline-none transition focus:border-slate-500"
        value={portValue}
        onChange={(event) => {
          const value = event.target.value.trim();
          if (value === "") {
            onChange(null);
            return;
          }
          const numeric = Number.parseInt(value, 10);
          if (Number.isNaN(numeric)) {
            return;
          }
          onChange(`http://localhost:${numeric}`);
        }}
      />
    </label>
  );
}

function UrlInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string | null) => void;
}) {
  return (
    <label className="flex flex-1 min-w-[180px] items-center gap-2 text-xs text-slate-400">
      URL personalizzato
      <input
        type="text"
        placeholder="http://localhost:5173"
        className="h-8 w-full flex-1 rounded-md border border-slate-700 bg-slate-900/80 px-3 text-xs text-slate-100 shadow-inner outline-none transition focus:border-slate-500"
        value={value}
        onChange={(event) => {
          const next = event.target.value.trim();
          onChange(next.length === 0 ? null : next);
        }}
      />
    </label>
  );
}
