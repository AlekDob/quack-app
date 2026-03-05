import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ProcessInfo } from "../types";

type PreviewStatus = "idle" | "checking" | "online" | "offline";

export interface PreviewProfile {
  id: string;
  label: string;
  port?: number;
  url?: string;
  command?: string;
  cwd?: string;
  isLive?: boolean; // From active process
  terminalId?: string; // Link to terminal
}

interface PreviewManagerValue {
  profiles: PreviewProfile[];
  selectedProfileId: string | null;
  selectedProfile: PreviewProfile | null;
  customUrl: string | null;
  previewUrl: string | null;
  status: PreviewStatus;
  inspectorEnabled: boolean;
  lastError: string | null;
  reloadToken: number;
  selectProfile: (id: string | null) => void;
  addOrUpdateProfile: (profile: PreviewProfile) => void;
  removeProfile: (id: string) => void;
  setCustomUrl: (url: string | null) => void;
  refresh: () => void;
  toggleInspector: () => void;
  checkAvailability: () => Promise<void>;
  openExternal: () => void;
}

const PreviewManagerContext = createContext<PreviewManagerValue | null>(null);

const DEFAULT_PROFILES: PreviewProfile[] = [
  { id: "vite-5173", label: "Localhost 5173", port: 5173 },
];

export function PreviewManagerProvider({
  children,
  processes = []
}: {
  children: ReactNode;
  processes?: ProcessInfo[];
}) {
  const [staticProfiles] = useState<PreviewProfile[]>(DEFAULT_PROFILES);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    DEFAULT_PROFILES[0]?.id ?? null,
  );
  const [customUrl, setCustomUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<PreviewStatus>("idle");
  const [lastError, setLastError] = useState<string | null>(null);
  const [inspectorEnabled, setInspectorEnabled] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  // Generate profiles from active processes
  const liveProfiles = useMemo<PreviewProfile[]>(() => {
    return processes
      .filter(p => p.port !== undefined)
      .map(p => ({
        id: `live-${p.terminalId}`,
        label: `${p.terminalLabel} :${p.port}`,
        port: p.port,
        isLive: true,
        terminalId: p.terminalId,
        command: p.command
      }));
  }, [processes]);

  // Merge static and live profiles
  const profiles = useMemo<PreviewProfile[]>(() => {
    return [...liveProfiles, ...staticProfiles];
  }, [liveProfiles, staticProfiles]);

  // Auto-select first live profile if none selected
  useEffect(() => {
    if (!selectedProfileId && liveProfiles.length > 0) {
      setSelectedProfileId(liveProfiles[0].id);
    }
  }, [liveProfiles, selectedProfileId]);

  const selectedProfile = useMemo(() => {
    if (!selectedProfileId) {
      return null;
    }
    return profiles.find((item) => item.id === selectedProfileId) ?? null;
  }, [profiles, selectedProfileId]);

  const previewUrl = useMemo(() => {
    if (customUrl && customUrl.trim().length > 0) {
      return customUrl.trim();
    }
    if (!selectedProfile) {
      return null;
    }
    if (selectedProfile.url) {
      return selectedProfile.url;
    }
    if (selectedProfile.port) {
      return `http://localhost:${selectedProfile.port}`;
    }
    return null;
  }, [customUrl, selectedProfile]);

  const selectProfile = useCallback((id: string | null) => {
    setSelectedProfileId(id);
    setCustomUrl(null);
    setStatus("idle");
    setLastError(null);
  }, []);

  // Note: addOrUpdateProfile and removeProfile only work on static profiles now
  const addOrUpdateProfile = useCallback((_profile: PreviewProfile) => {
    // Not implemented for now - could extend to save custom profiles
    console.warn('addOrUpdateProfile not implemented');
  }, []);

  const removeProfile = useCallback((_id: string) => {
    // Not implemented for now - could extend to remove custom profiles
    console.warn('removeProfile not implemented');
  }, []);

  const refresh = useCallback(() => {
    setReloadToken((value) => value + 1);
  }, []);

  const toggleInspector = useCallback(() => {
    setInspectorEnabled((value) => !value);
  }, []);

  const checkAvailability = useCallback(async () => {
    if (!previewUrl) {
      setStatus("idle");
      setLastError(null);
      return;
    }

    setStatus("checking");
    setLastError(null);

    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 3000);
      const response = await fetch(previewUrl, {
        method: "GET",
        mode: "no-cors",
        signal: controller.signal,
      });
      window.clearTimeout(timeoutId);
      if (response && (response.ok || response.type === "opaque")) {
        setStatus("online");
        return;
      }
      setStatus("offline");
      setLastError(`Anteprima non raggiungibile (${response.status})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus("offline");
      setLastError(message);
    }
  }, [previewUrl]);

  const setCustomPreviewUrl = useCallback((url: string | null) => {
    setCustomUrl(url);
    setStatus("idle");
    setLastError(null);
  }, []);

  const openExternal = useCallback(() => {
    if (!previewUrl) {
      return;
    }
    if (typeof window !== "undefined") {
      window.open(previewUrl, "_blank", "noopener,noreferrer");
    }
  }, [previewUrl]);

  const value = useMemo<PreviewManagerValue>(() => ({
    profiles,
    selectedProfileId,
    selectedProfile,
    customUrl,
    previewUrl,
    status,
    inspectorEnabled,
    lastError,
    reloadToken,
    selectProfile,
    addOrUpdateProfile,
    removeProfile,
    setCustomUrl: setCustomPreviewUrl,
    refresh,
    toggleInspector,
    checkAvailability,
    openExternal,
  }), [
    profiles,
    selectedProfileId,
    previewUrl,
    status,
    inspectorEnabled,
    lastError,
    reloadToken,
    selectedProfile,
    customUrl,
    selectProfile,
    addOrUpdateProfile,
    removeProfile,
    setCustomPreviewUrl,
    refresh,
    toggleInspector,
    checkAvailability,
    openExternal,
  ]);

  return (
    <PreviewManagerContext.Provider value={value}>{children}</PreviewManagerContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePreviewManager() {
  const context = useContext(PreviewManagerContext);
  if (!context) {
    throw new Error("usePreviewManager deve essere utilizzato dentro PreviewManagerProvider");
  }
  return context;
}
