// Quack Brain hub — dynamic segments for installed store extensions.

import { useCallback, useEffect, useMemo, useState } from "react";
import { brainSegmentExtensions } from "../quackStore/catalog";
import { installedIds, quackExtensions } from "../quackExtensions";
import { BrainKnowledgePanel } from "./BrainKnowledgePanel";
import { BrainSkillPanel } from "./BrainSkillPanel";
import { openQuackStore } from "./QuackStorePanel";
import { BrainSearchSkeleton } from "./brain/BrainSearchResults";

interface BrainPanelProps {
  wsId: string;
  root: string;
}

type BrainView = "knowledge" | "skills";

const viewByWs = new Map<string, BrainView>();

export function BrainPanel({ wsId, root }: BrainPanelProps) {
  const [loading, setLoading] = useState(true);
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const segments = useMemo(
    () => brainSegmentExtensions(installed),
    [installed],
  );
  const [view, setViewState] = useState<BrainView>(
    () => viewByWs.get(wsId) ?? "knowledge",
  );

  const setView = (v: BrainView) => {
    viewByWs.set(wsId, v);
    setViewState(v);
  };

  const refresh = useCallback(async () => {
    try {
      const rows = await quackExtensions.status(root);
      setInstalled(installedIds(rows));
    } finally {
      setLoading(false);
    }
  }, [root]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (segments.length === 0) return;
    const ids = new Set(segments.map((s) => s.id));
    if (!ids.has(view)) {
      setView(segments[0].id as BrainView);
    }
  }, [segments, view]);

  if (loading) {
    return (
      <div className="brain-panel">
        <div className="brain-panel-inner">
          <div className="brain-hub-tabs">
            <span className="brain-result-skeleton usage-tab" style={{ width: 88 }} />
            <span className="brain-result-skeleton usage-tab" style={{ width: 72 }} />
          </div>
          <BrainSearchSkeleton />
        </div>
      </div>
    );
  }

  if (segments.length === 0) {
    return (
      <div className="brain-panel">
        <div className="brain-panel-inner">
          <h2 className="brain-title">Quack Brain</h2>
          <p className="brain-empty-index">
            Install brain extensions from Quack Store to enable knowledge search,
            skill training, and chat integration.
          </p>
          <button
            type="button"
            className="brain-btn primary"
            onClick={() => openQuackStore(wsId)}
          >
            Browse Quack Store
          </button>
        </div>
      </div>
    );
  }

  const showTabs = segments.length > 1;

  return (
    <div className="brain-panel">
      <div className="brain-panel-inner">
        <header className="brain-header">
          <h2 className="brain-title">Quack Brain</h2>
        </header>

        {showTabs && (
          <div className="brain-hub-tabs" role="tablist" aria-label="Quack Brain segments">
            {segments.map((seg) => (
              <button
                key={seg.id}
                type="button"
                role="tab"
                className={`usage-tab${view === seg.id ? " is-on" : ""}`}
                aria-selected={view === seg.id}
                onClick={() => setView(seg.id as BrainView)}
              >
                {seg.label}
              </button>
            ))}
          </div>
        )}

        {segments.some((s) => s.id === "knowledge") &&
          (view === "knowledge" || !showTabs) && (
            <BrainKnowledgePanel wsId={wsId} root={root} />
          )}

        {segments.some((s) => s.id === "skills") &&
          (view === "skills" || (!showTabs && segments[0]?.id === "skills")) && (
            <BrainSkillPanel wsId={wsId} active={view === "skills" || !showTabs} />
          )}
      </div>
    </div>
  );
}
