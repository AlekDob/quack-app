// Knowledge segment — Pinky-powered search, dashboard, workspace setup.

import { useCallback, useEffect, useState } from "react";
import { Icon } from "./Icon";
import { BrainDashboard } from "./BrainDashboard";
import {
  BrainSearchEmpty,
  BrainSearchHitRow,
  BrainSearchSkeleton,
} from "./brain/BrainSearchResults";
import {
  pinky,
  type PinkySearchHit,
  type PinkyTelemetry,
  type PinkyValueStats,
  type PinkyWorkspaceStatus,
} from "../pinky";
import {
  getBrainInjectEnabled,
  openBrainDoc,
  setBrainInjectEnabled,
} from "../brainInject";
import { getBrainGatePrefs } from "../brainGates";
import { BrainInjectGates } from "./BrainInjectGates";
import { getBrainCumulative } from "../brainUsageStore";
import { error as toastError, info as toastInfo, success as toastSuccess } from "../notify";

interface Props {
  wsId: string;
  root: string;
}

export function BrainKnowledgePanel({ wsId, root }: Props) {
  const [status, setStatus] = useState<PinkyWorkspaceStatus | null>(null);
  const [valueStats, setValueStats] = useState<PinkyValueStats | null>(null);
  const [telemetry, setTelemetry] = useState<PinkyTelemetry | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<PinkySearchHit[]>([]);
  const [busyKind, setBusyKind] = useState<"setup" | "reindex" | null>(null);
  const busy = busyKind !== null;
  const [searching, setSearching] = useState(false);
  const [completedQuery, setCompletedQuery] = useState<string | null>(null);
  const [injectOn, setInjectOn] = useState(() => getBrainInjectEnabled(wsId));
  const [gatePrefs, setGatePrefs] = useState(() => getBrainGatePrefs(wsId));
  const [cumulative, setCumulative] = useState(() => getBrainCumulative(wsId));

  const refresh = useCallback(async () => {
    try {
      const st = await pinky.workspaceStatus(root);
      setStatus(st);
      if (st.db_exists) {
        try {
          setValueStats(await pinky.statsValue(root));
          setTelemetry(await pinky.telemetry(root));
        } catch {
          setValueStats(null);
          setTelemetry(null);
        }
      }
      setCumulative(getBrainCumulative(wsId));
    } catch (e) {
      toastError(String(e));
    }
  }, [root, wsId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setHits([]);
    setCompletedQuery(null);
    try {
      const res = await pinky.search(root, q, 8);
      setHits(res.results);
      setCompletedQuery(q);
    } catch (e) {
      toastError(String(e));
    } finally {
      setSearching(false);
    }
  };

  const runSetup = async () => {
    setBusyKind("setup");
    toastInfo("Setting up knowledge search… first index may take up to a minute.");
    try {
      const res = await pinky.setup(root);
      toastSuccess(res.message);
      await refresh();
    } catch (e) {
      toastError(String(e));
    } finally {
      setBusyKind(null);
    }
  };

  const runReindex = async () => {
    setBusyKind("reindex");
    toastInfo("Indexing documentation/… first run may take up to a minute.");
    try {
      const res = await pinky.reindex(root);
      toastSuccess(res.message);
      await refresh();
    } catch (e) {
      toastError(String(e));
    } finally {
      setBusyKind(null);
    }
  };

  const openHit = (hit: PinkySearchHit) => {
    void openBrainDoc(wsId, root, hit.path);
  };

  const toggleInject = () => {
    const next = !injectOn;
    setInjectOn(next);
    setBrainInjectEnabled(wsId, next);
  };

  const trimmedQuery = query.trim();
  const searchSettled =
    completedQuery !== null && completedQuery === trimmedQuery;
  const showDashboard =
    !searching && hits.length === 0 && !searchSettled;
  const showResults = searching || hits.length > 0 || searchSettled;
  const showEmpty = !searching && searchSettled && hits.length === 0;

  if (!status) {
    return (
      <div className="brain-segment-loading">
        <BrainSearchSkeleton />
      </div>
    );
  }

  return (
    <>
      <div className="brain-segment-toolbar">
        <button
          type="button"
          className={`brain-pill${injectOn ? " on" : ""}`}
          onClick={toggleInject}
          title="Inject top brain matches into each chat turn"
        >
          Pre-turn inject {injectOn ? "ON" : "OFF"}
        </button>
        <p className="brain-segment-meta">
          {busyKind === "reindex" ? (
            <span className="brain-search-shimmer">Indexing documentation…</span>
          ) : busyKind === "setup" ? (
            <span className="brain-search-shimmer">Setting up…</span>
          ) : (
            <>
              {status.entries} entries · {status.chunks} chunks
              {status.version ? ` · ${status.version}` : ""}
            </>
          )}
        </p>
      </div>

      <BrainInjectGates
        wsId={wsId}
        injectOn={injectOn}
        prefs={gatePrefs}
        onPrefsChange={setGatePrefs}
      />

      {status.global_migrated && (
        <p className="brain-banner">
          Migrated global knowledge from ~/.quack/brain → ~/.pinky/brain
        </p>
      )}

      <div className="brain-status-row">
        <StatusChip ok={status.documentation_exists} label="documentation/" />
        <StatusChip ok={status.mcp_installed} label="MCP" />
        <StatusChip ok={status.rule_installed} label="CC rule" />
        <StatusChip ok={status.db_exists} label="brain.db" />
      </div>

      {!status.mcp_installed && (
        <div className="brain-setup">
          <p className="brain-muted">
            Set up knowledge search for this workspace (MCP + Claude Code rule).
          </p>
          {busyKind === "setup" ? (
            <p className="brain-setup-busy" aria-live="polite">
              <span className="brain-search-shimmer">Setting up…</span>
              {" "}
              First run may take up to a minute — you can keep using the app.
            </p>
          ) : (
            <button
              type="button"
              className="brain-btn primary"
              onClick={() => void runSetup()}
            >
              Enable workspace setup
            </button>
          )}
        </div>
      )}

      <div className="brain-search-zone">
        <div className={`brain-search-bar${searching ? " is-searching" : ""}`}>
          <Icon name="search" size={14} className="brain-search-icon" />
          <input
            className="brain-search-input"
            value={query}
            onChange={(e) => {
              const v = e.target.value;
              setQuery(v);
              if (!v.trim()) {
                setHits([]);
                setCompletedQuery(null);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") void runSearch();
            }}
            placeholder="Search project knowledge…"
            aria-label="Search project knowledge"
          />
          {searching && (
            <span className="brain-search-shimmer" aria-live="polite">
              Searching…
            </span>
          )}
        </div>
        <div className="brain-search-actions">
          <button
            type="button"
            className="brain-btn"
            disabled={searching || !query.trim()}
            onClick={() => void runSearch()}
          >
            Search
          </button>
          <button
            type="button"
            className={`brain-btn ghost${busyKind === "reindex" ? " is-busy" : ""}`}
            disabled={busy || !status.documentation_exists}
            onClick={() => void runReindex()}
            title="Reindex documentation/"
          >
            {busyKind === "reindex" ? (
              <span className="brain-search-shimmer">Indexing…</span>
            ) : (
              "Reindex"
            )}
          </button>
        </div>
      </div>

      {busyKind === "reindex" && (
        <section className="brain-indexing" aria-live="polite">
          <p className="brain-indexing-label">
            <span className="brain-search-shimmer">Building brain.db from documentation/</span>
            {" "}
            — you can keep using the app.
          </p>
          <BrainSearchSkeleton />
        </section>
      )}

      {!busy && !status.db_exists && status.documentation_exists && (
        <p className="brain-empty-index">
          No index yet — click <strong>Reindex</strong> to scan documentation/ into brain.db.
        </p>
      )}

      {showDashboard && status.db_exists && (
        <BrainDashboard
          wsId={wsId}
          root={root}
          value={valueStats}
          telemetry={telemetry}
          cumulative={cumulative}
          injectOn={injectOn}
        />
      )}

      {showResults && (
        <section className="brain-results-section">
          {searching && <BrainSearchSkeleton />}
          {!searching && hits.length > 0 && (
            <>
              <p className="brain-results-head">
                {hits.length} result{hits.length === 1 ? "" : "s"}
              </p>
              <ul className="brain-results">
                {hits.map((hit, i) => (
                  <BrainSearchHitRow
                    key={hit.id}
                    hit={hit}
                    index={i}
                    query={completedQuery ?? ""}
                    onOpen={openHit}
                  />
                ))}
              </ul>
            </>
          )}
          {showEmpty && <BrainSearchEmpty query={completedQuery ?? ""} />}
        </section>
      )}

      <p className="brain-powered-by">Knowledge powered by Pinky</p>
    </>
  );
}

function StatusChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`brain-chip${ok ? " ok" : ""}`}>
      <Icon name={ok ? "check" : "x"} size={12} />
      {label}
    </span>
  );
}
