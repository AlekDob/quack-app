import { useEffect, useMemo } from "react";
import { usePreviewManager, type PreviewProfile } from "../composables/usePreviewManager";

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

  useEffect(() => {
    void checkAvailability();
  }, [checkAvailability, previewUrl]);

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
          <iframe
            key={`${previewUrl}-${reloadToken}`}
            src={previewUrl}
            title="Preview"
            className="h-full w-full border-0"
            sandbox="allow-forms allow-modals allow-pointer-lock allow-popups allow-same-origin allow-scripts"
          />
          <button
            type="button"
            onClick={toggleInspector}
            className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-full border border-slate-700/75 bg-slate-900/95 px-4 py-2 text-sm font-medium text-slate-200 shadow-lg backdrop-blur transition hover:border-slate-500"
          >
            <span className="h-2.5 w-2.5 rounded-full border border-slate-500/70 bg-slate-800/80" />
            {inspectorEnabled ? "Inspector attivo" : "Attiva inspector"}
          </button>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-slate-500">
          Configura una porta o un URL per vedere la preview della tua app.
        </div>
      )}

      {lastError ? (
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
