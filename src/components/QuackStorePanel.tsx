import { useCallback, useEffect, useMemo, useState } from "react";
import { QUACK_EXTENSIONS } from "../quackStore/catalog";
import type { InstallMethod } from "../quackStore/types";
import {
  installedIds,
  quackExtensions,
  statusMap,
  type ExtensionStatus,
} from "../quackExtensions";
import { useStore } from "../store";
import { error as toastError, success as toastSuccess } from "../notify";
import { Icon } from "./Icon";
import { StoreExtensionRow, StoreSkeletonRows, type RowPhase } from "./StoreExtensionRow";

interface Props {
  wsId: string;
  root: string;
}

export function QuackStorePanel({ wsId, root }: Props) {
  const brainOpen = useStore((s) => s.brainOpen);
  const [rows, setRows] = useState<ExtensionStatus[] | null>(null);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [phases, setPhases] = useState<Record<string, RowPhase>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [manualCmds, setManualCmds] = useState<Record<string, string>>({});
  const [busyLabels, setBusyLabels] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    try {
      const st = await quackExtensions.status(root);
      setRows(st);
    } catch (e) {
      toastError(String(e));
    }
  }, [root]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const installed = rows ? installedIds(rows) : new Set<string>();
  const byId = rows ? statusMap(rows) : new Map<string, ExtensionStatus>();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return QUACK_EXTENSIONS;
    return QUACK_EXTENSIONS.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.tagline.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q),
    );
  }, [query]);

  const installedExts = filtered.filter((e) => installed.has(e.id));
  const availableExts = filtered.filter((e) => !installed.has(e.id));

  const rowPhase = (extId: string): RowPhase => {
    if (busyId === extId) return "busy";
    return phases[extId] ?? "idle";
  };

  const failInstall = (extId: string, message: string, manual?: string | null) => {
    setPhases((p) => ({ ...p, [extId]: "error" }));
    setErrors((er) => ({ ...er, [extId]: message }));
    if (manual) {
      setManualCmds((c) => ({ ...c, [extId]: manual }));
    }
  };

  const runInstall = async (extId: string, methods: InstallMethod[]) => {
    setBusyId(extId);
    setPhases((p) => ({ ...p, [extId]: "busy" }));
    setErrors((e) => {
      const next = { ...e };
      delete next[extId];
      return next;
    });
    setManualCmds((c) => {
      const next = { ...c };
      delete next[extId];
      return next;
    });
    let lastMessage = "Automatic install did not succeed. Use the manual command below.";
    let lastManual: string | null = null;
    try {
      for (const m of methods) {
        if (m.kind === "external") continue;
        const label =
          m.kind === "pip"
            ? `Installing ${m.package}…`
            : m.kind === "cargo"
              ? `Installing ${m.crate}…`
              : "Installing…";
        setBusyLabels((b) => ({ ...b, [extId]: label }));
        try {
          const res = await quackExtensions.install(m);
          if (res.ok) {
            const st = await quackExtensions.status(root);
            setRows(st);
            const row = st.find((r) => r.id === extId);
            if (row?.installed) {
              toastSuccess(res.message);
              setPhases((p) => ({ ...p, [extId]: "idle" }));
              return;
            }
            failInstall(
              extId,
              "Install finished but the CLI was not detected. Restart Quack or run the command below, then Refresh.",
              res.manual_command ?? lastManual,
            );
            return;
          }
          lastMessage = res.message || lastMessage;
          if (res.manual_command) lastManual = res.manual_command;
        } catch (e) {
          failInstall(extId, String(e), lastManual);
          return;
        }
      }
      failInstall(extId, lastMessage, lastManual);
    } finally {
      setBusyId(null);
    }
  };

  const renderRow = (ext: (typeof QUACK_EXTENSIONS)[number]) => (
    <StoreExtensionRow
      key={ext.id}
      ext={ext}
      status={byId.get(ext.id)}
      phase={rowPhase(ext.id)}
      busyLabel={busyLabels[ext.id] ?? "Installing…"}
      errorMsg={errors[ext.id] ?? null}
      manualCmd={manualCmds[ext.id] ?? null}
      onInstall={() => void runInstall(ext.id, ext.install)}
      onOpenBrain={() => brainOpen(wsId)}
    />
  );

  return (
    <div className="store-panel">
      <div className="store-panel-inner">
        <header className="store-toolbar">
          <label className="mcp-search store-search">
            <Icon name="search" size={14} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search extensions…"
              aria-label="Search extensions"
            />
            {query && (
              <button
                type="button"
                className="mcp-search-clear"
                onClick={() => setQuery("")}
                aria-label="Clear search"
              >
                <Icon name="x" size={12} />
              </button>
            )}
          </label>
          <button
            type="button"
            className="store-row-btn"
            onClick={() => void refresh()}
            disabled={busyId !== null}
            title="Re-check installed extensions"
          >
            Refresh
          </button>
        </header>

        {rows === null ? (
          <StoreSkeletonRows />
        ) : (
          <>
            {installedExts.length > 0 && (
              <section className="store-section">
                <h3 className="mcp-section-head">
                  Installed {installedExts.length}
                </h3>
                <div className="store-list">{installedExts.map(renderRow)}</div>
              </section>
            )}

            {availableExts.length > 0 && (
              <section className="store-section">
                <h3 className="mcp-section-head">
                  Available {availableExts.length}
                </h3>
                <div className="store-list">{availableExts.map(renderRow)}</div>
              </section>
            )}

            {filtered.length === 0 && (
              <p className="store-hint">No extensions match your search.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function openQuackStore(wsId: string): void {
  useStore.getState().storeOpen(wsId);
}
