import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePreviewManager, type PreviewProfile } from "../composables/usePreviewManager";
import { usePreviewWebView } from "../composables/usePreviewWebView";

export default function PreviewPanel() {
  const {
    profiles,
  } = usePreviewManager();

  const [activePreviewUrl, setActivePreviewUrl] = useState<string | null>(null);
  const [customUrls, setCustomUrls] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const webviewContainerRef = useRef<HTMLDivElement>(null);
  const webview = usePreviewWebView();

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
  }, [activePreviewUrl]);

  // Open preview window manually
  const openPreviewWindow = useCallback((url: string) => {
    setActivePreviewUrl(url);
  }, []);

  // Close preview window
  const closePreviewWindow = useCallback(() => {
    setActivePreviewUrl(null);
  }, []);

  // Get live profiles (processes with ports)
  const liveProfiles = useMemo(() => {
    return profiles.filter(p => p.isLive && p.port);
  }, [profiles]);

  // Create custom profiles from customUrls array
  const customProfiles = useMemo<PreviewProfile[]>(() => {
    return customUrls.map((customUrl, index) => {
      // Check if it's a port number
      const portMatch = customUrl.match(/^(\d+)$/);
      if (portMatch) {
        const port = Number.parseInt(portMatch[1], 10);
        return {
          id: `custom-port-${index}`,
          label: `Custom Port :${port}`,
          port,
          url: `http://localhost:${port}`,
        };
      }

      // Otherwise treat as full URL
      return {
        id: `custom-url-${index}`,
        label: `Custom URL ${index + 1}`,
        url: customUrl,
      };
    });
  }, [customUrls]);

  // Combine all profiles
  const allProfiles = useMemo(() => {
    return [...customProfiles, ...liveProfiles];
  }, [customProfiles, liveProfiles]);

  // Add custom URL handler
  const handleAddCustomUrl = useCallback(() => {
    const trimmed = inputValue.trim();
    if (trimmed && !customUrls.includes(trimmed)) {
      setCustomUrls(prev => [...prev, trimmed]);
      setInputValue("");
    }
  }, [inputValue, customUrls]);

  // Remove custom URL handler
  const handleRemoveCustomUrl = useCallback((url: string) => {
    setCustomUrls(prev => prev.filter(u => u !== url));
    // Close preview if it was active
    if (activePreviewUrl && activePreviewUrl.includes(url)) {
      setActivePreviewUrl(null);
    }
  }, [activePreviewUrl]);

  return (
    <section className="flex h-full min-h-0 w-full flex-col bg-[#0d1017]">
      <header className="border-b border-slate-800/60 px-4 py-3">
        <h2 className="text-sm font-medium text-slate-200">Preview Inspector</h2>
        <p className="mt-1 text-xs text-slate-500">
          Active processes with preview available
        </p>
      </header>

      {/* Form to add custom port/URL */}
      <div className="border-b border-slate-800/60 px-4 py-3">
        <label className="block text-xs font-medium text-slate-400 mb-2">
          Add custom port or URL
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="5173 or http://localhost:5173"
            className="flex-1 h-8 rounded-md border border-slate-700 bg-slate-900/80 px-3 text-xs text-slate-100 shadow-inner outline-none transition focus:border-slate-500"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddCustomUrl();
              }
            }}
          />
          <button
            type="button"
            onClick={handleAddCustomUrl}
            disabled={!inputValue.trim()}
            className="h-8 px-3 rounded-md border border-emerald-500/40 bg-emerald-500/20 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>
      </div>

      {/* List of processes with preview available */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {allProfiles.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center">
            <div>
              <div className="text-sm text-slate-500">No processes with available port</div>
              <div className="mt-2 text-xs text-slate-600">
                Add a custom port/URL or start a development server
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {allProfiles.map((profile) => {
              const profileUrl = profile.url || (profile.port ? `http://localhost:${profile.port}` : null);
              const isActive = activePreviewUrl === profileUrl;
              const isCustom = profile.id.startsWith('custom-');
              // Get original URL for removal
              const originalUrl = customUrls.find(url => {
                const portMatch = url.match(/^(\d+)$/);
                if (portMatch) {
                  return profileUrl === `http://localhost:${portMatch[1]}`;
                }
                return profileUrl === url;
              });

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
                            ACTIVE
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
                          Close
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
                      {isCustom && originalUrl && (
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomUrl(originalUrl)}
                          className="rounded-md border border-slate-700/70 bg-slate-800/70 px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:border-rose-500/40 hover:bg-rose-500/20 hover:text-rose-300"
                        >
                          Remove
                        </button>
                      )}
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
            className="flex-1"
          >
            {/* WebView renders as separate window positioned over this area */}
            <div className="h-full w-full flex items-center justify-center text-slate-600 text-sm">
              <div className="text-center">
                <div className="mb-2">🦆 WebView Preview</div>
                <div className="text-xs text-slate-500">Window positioned over this area</div>
                <div className="mt-3 text-xs text-slate-400">Inspector UI is inside the preview window</div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
