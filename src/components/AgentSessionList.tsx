import { useState, useEffect, useCallback, useRef } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { useChatStore } from '../stores/chatStore';
import AgentSessionItem from './AgentSessionItem';
import './AgentSessionList.css';

// Confirmation dialog for delete
function ConfirmDeleteDialog({
  isOpen,
  sessionTitle,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  sessionTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!isOpen) return null;
  
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100000,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: '#1e1e23',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          padding: '20px',
          maxWidth: '400px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 12px', color: '#fff', fontSize: '16px' }}>
          Delete Session?
        </h3>
        <p style={{ margin: '0 0 20px', color: 'rgba(255, 255, 255, 0.7)', fontSize: '14px' }}>
          Are you sure you want to delete "{sessionTitle}"? This action cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 16px',
              background: '#ef4444',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// Rename dialog for session
function RenameSessionDialog({
  isOpen,
  currentTitle,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  currentTitle: string;
  onConfirm: (newTitle: string) => void;
  onCancel: () => void;
}) {
  const [newTitle, setNewTitle] = useState(currentTitle);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset title when dialog opens
  useEffect(() => {
    if (isOpen) {
      setNewTitle(currentTitle);
      // Focus input after render
      setTimeout(() => inputRef.current?.select(), 50);
    }
  }, [isOpen, currentTitle]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTitle.trim();
    if (trimmed && trimmed !== currentTitle) {
      onConfirm(trimmed);
    } else {
      onCancel();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100000,
      }}
      onClick={onCancel}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: '#1e1e23',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          padding: '20px',
          maxWidth: '400px',
          width: '90%',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 12px', color: '#fff', fontSize: '16px' }}>
          Rename Session
        </h3>
        <input
          ref={inputRef}
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Enter session name..."
          style={{
            width: '100%',
            padding: '10px 12px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '6px',
            color: '#fff',
            fontSize: '14px',
            marginBottom: '16px',
            outline: 'none',
            boxSizing: 'border-box',
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              onCancel();
            }
          }}
        />
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!newTitle.trim() || newTitle.trim() === currentTitle}
            style={{
              padding: '8px 16px',
              background: newTitle.trim() && newTitle.trim() !== currentTitle ? '#00D4FF' : 'rgba(0, 212, 255, 0.3)',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              cursor: newTitle.trim() && newTitle.trim() !== currentTitle ? 'pointer' : 'not-allowed',
              fontSize: '13px',
            }}
          >
            Rename
          </button>
        </div>
      </form>
    </div>
  );
}

interface AgentSessionListProps {
  agentId: string;
  agentColor?: string;
  onSessionClick: (sessionId: string) => void;
  activeSessionId?: string;
}

/**
 * Compact list of sessions under an agent card.
 * Follows TasksSidebarSection pattern with minimal UI.
 * Shows max 5 non-done sessions.
 * Note: New session creation is now handled via "+" button on agent card in RepositoryGroup.
 */
function AgentSessionList({
  agentId,
  agentColor = '#00D4FF',
  onSessionClick,
  activeSessionId,
}: AgentSessionListProps) {
  const [showAll, setShowAll] = useState(false);
  const [deleteDialogSession, setDeleteDialogSession] = useState<{ id: string; title: string } | null>(null);
  const [renameDialogSession, setRenameDialogSession] = useState<{ id: string; title: string } | null>(null);

  // Get sessions from store
  const { sessions: allSessions, isLoading, loadSessions, updateSession, deleteSession } = useSessionStore();

  // Filter sessions for this agent
  const sessions = allSessions.filter((s) => s.agentId === agentId);
  
  // 🦆 SESSIONS-FIRST: Get chat data for activity indicators
  // Reading from chatStore directly to get real-time loading state updates
  const chatSessions = useChatStore((state) => state.chatSessions);
  const chatLoadingMap = useChatStore((state) => state.chatLoadingMap);
  const pendingQuestionsMap = useChatStore((state) => state.pendingQuestionsMap);

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Handle marking session as done
  const handleMarkDone = useCallback((sessionId: string) => {
    updateSession(sessionId, { status: 'done', completedAt: Date.now() });
  }, [updateSession]);

  // Handle delete session (shows confirmation dialog)
  const handleDeleteRequest = useCallback((sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setDeleteDialogSession({ id: session.id, title: session.title });
    }
  }, [sessions]);

  // Confirm delete
  const handleConfirmDelete = useCallback(() => {
    if (deleteDialogSession) {
      deleteSession(deleteDialogSession.id);
      setDeleteDialogSession(null);
    }
  }, [deleteDialogSession, deleteSession]);

  // Handle rename session (shows rename dialog)
  const handleRenameRequest = useCallback((sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setRenameDialogSession({ id: session.id, title: session.title });
    }
  }, [sessions]);

  // Confirm rename
  const handleConfirmRename = useCallback((newTitle: string) => {
    if (renameDialogSession) {
      updateSession(renameDialogSession.id, { title: newTitle });
      setRenameDialogSession(null);
    }
  }, [renameDialogSession, updateSession]);

  // Filter non-done sessions
  const nonDoneSessions = sessions.filter((s) => s.status !== 'done');

  // Limit to 5 sessions unless "Show all" is clicked
  const visibleSessions = showAll
    ? nonDoneSessions
    : nonDoneSessions.slice(0, 5);

  const hasMore = nonDoneSessions.length > 5 && !showAll;

  // Compact loading state
  if (isLoading) {
    return (
      <div style={{ padding: '4px 8px', fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ marginTop: '4px' }}>
      {/* Session list */}
      {visibleSessions.map((session, index) => {
        const isLoadingForSession = chatLoadingMap.get(session.id) ?? false;
        // 🦆 FIX: Check pending questions using session.id (the sessionKey from the event)
        // pendingQuestionsMap is now keyed by sessionId (not agentId) to show "?" only on the correct session
        const pendingQuestionsSet = pendingQuestionsMap.get(session.id);
        const hasPendingQuestion = pendingQuestionsSet ? pendingQuestionsSet.size > 0 : false;
        const isLast = index === visibleSessions.length - 1;
        return (
          <AgentSessionItem
            key={session.id}
            session={session}
            onClick={onSessionClick}
            isActive={session.id === activeSessionId}
            agentColor={agentColor}
            isLast={isLast}
            // 🦆 SESSIONS-FIRST: Pass chat data for activity indicators
            chatMessages={chatSessions.get(session.id) || []}
            isLoading={isLoadingForSession}
            hasPendingQuestion={hasPendingQuestion}
            // Context menu callbacks
            onMarkDone={handleMarkDone}
            onDelete={handleDeleteRequest}
            onRename={handleRenameRequest}
          />
        );
      })}

      {/* Show all link (compact) */}
      {hasMore && (
        <button
          onClick={() => setShowAll(true)}
          style={{
            display: 'block',
            width: '100%',
            padding: '4px 8px',
            marginBottom: '4px',
            background: 'transparent',
            border: 'none',
            fontSize: '10px',
            color: 'rgba(255, 255, 255, 0.5)',
            cursor: 'pointer',
            textAlign: 'left',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)';
          }}
        >
          + {nonDoneSessions.length - 5} more...
        </button>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        isOpen={deleteDialogSession !== null}
        sessionTitle={deleteDialogSession?.title || ''}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteDialogSession(null)}
      />

      {/* Rename Session Dialog */}
      <RenameSessionDialog
        isOpen={renameDialogSession !== null}
        currentTitle={renameDialogSession?.title || ''}
        onConfirm={handleConfirmRename}
        onCancel={() => setRenameDialogSession(null)}
      />
    </div>
  );
}

// 🦆 NOTE: Removed memo() to ensure re-render when chatLoadingMap changes in zustand store
export default AgentSessionList;
