import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { usePreviewManager, type PreviewProfile } from "../composables/usePreviewManager";
import { usePreviewWebView } from "../composables/usePreviewWebView";
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
  const [activePreviewUrl, setActivePreviewUrl] = useState<string | null>(null);
  const webviewContainerRef = useRef<HTMLDivElement>(null);
  const webview = usePreviewWebView();

  // Initialize inspector bridge and Tauri event listener
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

    // Listen for Tauri events from the preview WebView and forward to inspector bridge
    let unlisten: (() => void) | undefined;

    void listen<Record<string, unknown>>('preview-inspector-event', (event) => {
      const { type, data } = event.payload;

      if (type === 'quack-inspector-hover') {
        handleHover(data as InspectorData | Record<string, unknown>);
      } else if (type === 'quack-inspector-click') {
        handleClick(data as InspectorData | Record<string, unknown>);
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      inspectorBridge.off('hover', handleHover);
      inspectorBridge.off('click', handleClick);
      inspectorBridge.destroy();
      unlisten?.();
    };
  }, []);

  // Create/destroy webview based on active preview URL (manual trigger)
  useEffect(() => {
    const container = webviewContainerRef.current;
    if (!container || !activePreviewUrl) {
      void webview.destroyWebView();
      return;
    }

    // Destroy existing before creating new one
    const createView = async () => {
      try {
        // Ensure clean slate
        await webview.destroyWebView();

        // Wait a tick for cleanup
        await new Promise(resolve => setTimeout(resolve, 100));

        const rect = container.getBoundingClientRect();

        await webview.createWebView(activePreviewUrl, {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        });

        // Inject inspector script after webview loads
        setTimeout(async () => {
          try {
            const response = await fetch('/inspector-script.js');
            const script = await response.text();
            await webview.injectScript(script);
            console.log('🦆 Inspector script injected into webview!');
          } catch (error) {
            console.error('Failed to inject inspector script:', error);
          }
        }, 1500);
      } catch (error) {
        console.error('Failed to create webview:', error);
      }
    };

    void createView();

    return () => {
      void webview.destroyWebView();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePreviewUrl, reloadToken]);

  // Toggle inspector when enabled changes - send to webview via script injection
  useEffect(() => {
    if (!webview.isActive()) return;

    const toggleScript = `
      window.postMessage({
        type: 'quack-inspector-toggle',
        enabled: ${inspectorEnabled}
      }, '*');
    `;

    void webview.injectScript(toggleScript);

    if (!inspectorEnabled) {
      setInspectorData(null);
    }
  }, [inspectorEnabled, webview]);

  // Open preview window manually
  const openPreviewWindow = useCallback((url: string) => {
    setActivePreviewUrl(url);
  }, []);

  // Close preview window
  const closePreviewWindow = useCallback(() => {
    setActivePreviewUrl(null);
  }, []);

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

  // Get live profiles (processes with ports)
  const liveProfiles = useMemo(() => {
    return profiles.filter(p => p.isLive && p.port);
  }, [profiles]);

  // Create custom profile from customUrl if present
  const customProfile = useMemo<PreviewProfile | null>(() => {
    if (!customUrl || customUrl.trim().length === 0) {
      return null;
    }

    // Check if it's a port number
    const portMatch = customUrl.match(/^(\d+)$/);
    if (portMatch) {
      const port = Number.parseInt(portMatch[1], 10);
      return {
        id: 'custom-port',
        label: `Custom Port :${port}`,
        port,
        url: `http://localhost:${port}`,
      };
    }

    // Otherwise treat as full URL
    return {
      id: 'custom-url',
      label: 'Custom URL',
      url: customUrl,
    };
  }, [customUrl]);

  // Combine all profiles
  const allProfiles = useMemo(() => {
    return customProfile ? [customProfile, ...liveProfiles] : liveProfiles;
  }, [customProfile, liveProfiles]);

  return (
    <section className="flex h-full min-h-0 w-full flex-col bg-[#0d1017]">
      <header className="border-b border-slate-800/60 px-4 py-3">
        <h2 className="text-sm font-medium text-slate-200">Preview Inspector</h2>
        <p className="mt-1 text-xs text-slate-500">
          Processi attivi con preview disponibile
        </p>
      </header>

      {/* Form per inserimento manuale porta/URL */}
      <div className="border-b border-slate-800/60 px-4 py-3">
        <label className="block text-xs font-medium text-slate-400 mb-2">
          Inserisci porta o URL
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="5173 oppure http://localhost:5173"
            className="flex-1 h-8 rounded-md border border-slate-700 bg-slate-900/80 px-3 text-xs text-slate-100 shadow-inner outline-none transition focus:border-slate-500"
            value={customUrl ?? ""}
            onChange={(e) => setCustomUrl(e.target.value.trim() || null)}
          />
          {customUrl && (
            <button
              type="button"
              onClick={() => setCustomUrl(null)}
              className="h-8 px-3 rounded-md border border-slate-700/70 bg-slate-800/70 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:bg-slate-700"
            >
              Cancella
            </button>
          )}
        </div>
      </div>

      {/* Lista processi con preview disponibile */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {allProfiles.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center">
            <div>
              <div className="text-sm text-slate-500">Nessun processo con porta disponibile</div>
              <div className="mt-2 text-xs text-slate-600">
                Inserisci una porta o URL oppure avvia un server di sviluppo
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {allProfiles.map((profile) => {
              const profileUrl = profile.url || (profile.port ? `http://localhost:${profile.port}` : null);
              const isActive = activePreviewUrl === profileUrl;
              const isCustom = profile.id.startsWith('custom-');

              return (
                <div
                  key={profile.id}
                  className={`rounded-lg border p-3 transition ${
                    isActive
                      ? "border-emerald-500/50 bg-emerald-500/10"
                      : "border-slate-700/70 bg-slate-800/40 hover:border-slate-600"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${isCustom ? 'bg-blue-400' : 'bg-emerald-400'}`} />
                        <h3 className="text-sm font-medium text-slate-200 truncate">
                          {profile.label}
                        </h3>
                        {isActive && (
                          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-300">
                            ATTIVO
                          </span>
                        )}
                        {isCustom && (
                          <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-300">
                            CUSTOM
                          </span>
                        )}
                      </div>
                      {profile.command && (
                        <div className="mt-1 text-xs text-slate-500 font-mono truncate">
                          {profile.command}
                        </div>
                      )}
                      <div className="mt-1 text-xs text-slate-400">
                        {profileUrl}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      {isActive ? (
                        <button
                          type="button"
                          onClick={closePreviewWindow}
                          className="rounded-md border border-rose-500/40 bg-rose-500/20 px-3 py-1.5 text-xs font-medium text-rose-300 transition hover:bg-rose-500/30"
                        >
                          Chiudi
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => profileUrl && openPreviewWindow(profileUrl)}
                          className="rounded-md border border-emerald-500/40 bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/30"
                        >
                          Preview
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (profileUrl && typeof window !== "undefined") {
                            window.open(profileUrl, "_blank", "noopener,noreferrer");
                          }
                        }}
                        disabled={!profileUrl}
                        className="rounded-md border border-slate-700/70 bg-slate-800/70 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Browser
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Preview window area (only when active) */}
      {activePreviewUrl ? (
        <div className="relative flex flex-1 bg-black/20">
          <div
            ref={webviewContainerRef}
            className={`flex-1 transition-shadow ${inspectorEnabled ? "ring-1 ring-emerald-400/50" : ""}`}
          >
            {/* WebView renders as separate window positioned over this area */}
            <div className="h-full w-full flex items-center justify-center text-slate-600 text-sm">
              <div className="text-center">
                <div className="mb-2">🦆 WebView Preview</div>
                <div className="text-xs text-slate-500">Window positioned over this area</div>
              </div>
            </div>
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
      ) : null}

      {inspectorEnabled && activePreviewUrl && (
        <div className="border-t border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-100">
          <div className="flex items-center justify-between">
            <span>Inspector attivo - Hover elementi per dettagli, click per salvare in history</span>
            <span className="font-mono text-emerald-300/70">⌘I / Ctrl+I</span>
          </div>
        </div>
      )}
    </section>
  );
}
