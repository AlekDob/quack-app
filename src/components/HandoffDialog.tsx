/**
 * HandoffDialog
 *
 * Global modal for forking the current session onto another agent with an
 * AI-generated, editable summary as bootstrap context. State lives in
 * `useHandoffDialogStore` so any entry point (popover, slash command, sidebar
 * context menu) can trigger it.
 *
 * Brain: handoff-agent-fork
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { useTerminalStore } from '../stores/terminalStore';
import { useChatStore } from '../stores/chatStore';
import { useHandoffDialogStore } from '../stores/handoffDialogStore';
import { generateHandoffSummary, executeHandoff } from '../services/handoffService';
import { getAvatarUrl, getDuckdroidUrl } from '../utils/agentAvatars';
import './HandoffDialog.css';

type Stage = 'pick' | 'generating' | 'review' | 'submitting';

export default function HandoffDialog() {
  const isOpen = useHandoffDialogStore((s) => s.isOpen);
  const currentSessionId = useHandoffDialogStore((s) => s.sessionId);
  const initialTargetAgentId = useHandoffDialogStore((s) => s.initialTargetAgentId);
  const close = useHandoffDialogStore((s) => s.close);

  const [stage, setStage] = useState<Stage>('pick');
  const [targetAgentId, setTargetAgentId] = useState<string | null>(null);
  const [summary, setSummary] = useState('');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const terminals = useTerminalStore((s) => s.terminals);
  const sessions = useSessionStore((s) => s.sessions);
  const fromSession = useMemo(
    () => (currentSessionId ? sessions.find((s) => s.id === currentSessionId) ?? null : null),
    [sessions, currentSessionId],
  );
  const fromAgent = useMemo(
    () => terminals.find((t) => t.id === fromSession?.agentId) ?? null,
    [terminals, fromSession],
  );
  // Brain: handoff-agent-fork — filter to agents of the SAME project (cwd === projectPath),
  // dedup by id, allow handoff to the SAME agent too (parallel branch on same persona).
  const availableAgents = useMemo(() => {
    if (!fromSession) return [];
    const targetCwd = fromSession.projectPath;
    const seen = new Set<string>();
    const out: typeof terminals = [];
    for (const t of terminals) {
      if (t.cwd !== targetCwd) continue;
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      out.push(t);
    }
    return out;
  }, [terminals, fromSession]);

  const generateForTarget = useCallback(
    async (agentId: string) => {
      if (!fromSession) return;
      const target = terminals.find((t) => t.id === agentId);
      if (!target) return;

      setStage('generating');
      setError(null);
      setTargetAgentId(agentId);

      abortRef.current?.abort();
      abortRef.current = new AbortController();

      try {
        const messages = useChatStore.getState().getSession(fromSession.id);
        const text = await generateHandoffSummary(
          messages,
          fromAgent?.label ?? 'previous-agent',
          target.label ?? agentId,
          {
            workingDirectory: fromSession.projectPath,
            signal: abortRef.current.signal,
          },
        );
        if (abortRef.current?.signal.aborted) return;
        setSummary(text);
        setStage('review');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[HandoffDialog] summary generation failed:', err);
        setError(msg);
        setStage('pick');
      }
    },
    [fromSession, fromAgent, terminals],
  );

  useEffect(() => {
    if (!isOpen) {
      setStage('pick');
      setTargetAgentId(null);
      setSummary('');
      setError(null);
      abortRef.current?.abort();
      abortRef.current = null;
      return;
    }
    if (initialTargetAgentId) {
      const exists = terminals.some((t) => t.id === initialTargetAgentId);
      if (exists) {
        void generateForTarget(initialTargetAgentId);
      }
    }
  }, [isOpen, initialTargetAgentId, terminals, generateForTarget]);

  const handleConfirm = useCallback(async () => {
    if (!fromSession || !targetAgentId || !summary.trim()) return;
    const target = terminals.find((t) => t.id === targetAgentId);
    if (!target) return;

    setStage('submitting');
    setError(null);
    try {
      await executeHandoff({
        fromSession,
        targetAgentId,
        summary: summary.trim(),
        targetAgentName: target.label ?? targetAgentId,
        fromAgentName: fromAgent?.label,
      });
      close();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[HandoffDialog] executeHandoff failed:', err);
      setError(msg);
      setStage('review');
    }
  }, [fromSession, targetAgentId, summary, terminals, fromAgent, close]);

  if (!isOpen || !fromSession) return null;

  return (
    <div className="handoff-dialog-overlay" onMouseDown={close}>
      <div
        className="handoff-dialog"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="handoff-dialog-header">
          <div className="handoff-dialog-title">Handoff sessione</div>
          <button className="handoff-dialog-close" onClick={close} aria-label="Chiudi">×</button>
        </div>

        <div className="handoff-dialog-from">
          Da <strong>{fromAgent?.label ?? 'agente corrente'}</strong>
          {fromSession?.title && <> · <span className="handoff-dialog-session-title">{fromSession.title}</span></>}
        </div>

        {stage === 'pick' && (
          <>
            <div className="handoff-dialog-section-label">Scegli l'agente di destinazione</div>
            {availableAgents.length === 0 ? (
              <div className="handoff-dialog-empty">Nessun agente disponibile in questo progetto.</div>
            ) : (
              <div className="handoff-dialog-agents">
                {availableAgents.map((agent) => {
                  const isSame = agent.id === fromSession.agentId;
                  const avatarUrl = agent.avatar ? getAvatarUrl(agent.avatar) : getDuckdroidUrl();
                  return (
                    <button
                      key={agent.id}
                      className="handoff-dialog-agent-row"
                      onClick={() => generateForTarget(agent.id)}
                    >
                      <img
                        className="handoff-dialog-agent-avatar"
                        src={avatarUrl}
                        alt=""
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = getDuckdroidUrl();
                        }}
                      />
                      <span className="handoff-dialog-agent-name">
                        {agent.label}
                        {isSame && <span className="handoff-dialog-same-badge">stesso agente</span>}
                      </span>
                      <span className={`handoff-dialog-agent-status ${agent.status ?? 'idle'}`}>
                        {agent.status ?? 'idle'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {stage === 'generating' && (
          <div className="handoff-dialog-loading">
            <div className="handoff-dialog-spinner" />
            <div>Generazione sunto in corso…</div>
            <div className="handoff-dialog-loading-hint">Sto leggendo la conversazione e preparando il bootstrap per il nuovo agente.</div>
          </div>
        )}

        {(stage === 'review' || stage === 'submitting') && (
          <>
            <div className="handoff-dialog-section-label">
              Sunto per <strong>{terminals.find((t) => t.id === targetAgentId)?.label ?? targetAgentId}</strong> (modificabile)
            </div>
            <textarea
              className="handoff-dialog-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={14}
              disabled={stage === 'submitting'}
            />
          </>
        )}

        {error && <div className="handoff-dialog-error">{error}</div>}

        <div className="handoff-dialog-actions">
          <button
            className="handoff-dialog-btn handoff-dialog-btn-secondary"
            onClick={close}
            disabled={stage === 'submitting'}
          >
            Annulla
          </button>
          {stage === 'review' && (
            <button
              className="handoff-dialog-btn handoff-dialog-btn-primary"
              onClick={handleConfirm}
              disabled={!summary.trim()}
            >
              Handoff
            </button>
          )}
          {stage === 'submitting' && (
            <button className="handoff-dialog-btn handoff-dialog-btn-primary" disabled>
              In corso…
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
