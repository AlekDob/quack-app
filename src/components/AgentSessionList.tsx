import { useState, useEffect, memo, useCallback } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { useChatStore } from '../stores/chatStore';
import AgentSessionItem from './AgentSessionItem';
import NewSessionModal from './NewSessionModal';
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

interface AgentSessionListProps {
  agentId: string;
  agentName?: string;
  agentColor?: string;
  projectPath: string;
  projectName: string;
  onSessionClick: (sessionId: string) => void;
  activeSessionId?: string;
}

/**
 * Compact list of sessions under an agent card.
 * Follows TasksSidebarSection pattern with minimal UI.
 * Shows max 5 non-done sessions, single "+" button for new session.
 */
function AgentSessionList({
  agentId,
  agentName,
  agentColor = '#00D4FF',
  projectPath,
  projectName,
  onSessionClick,
  activeSessionId,
}: AgentSessionListProps) {
  const [showAll, setShowAll] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteDialogSession, setDeleteDialogSession] = useState<{ id: string; title: string } | null>(null);

  // Get sessions from store
  const { sessions: allSessions, isLoading, loadSessions, createSession, updateSession, deleteSession } = useSessionStore();

  // 🦆 SESSIONS-FIRST: Get chat data for activity indicators
  // Using explicit selectors to ensure re-render when Map changes
  const chatSessions = useChatStore((state) => state.chatSessions);
  const chatLoadingMap = useChatStore((state) => state.chatLoadingMap);

  // Filter sessions for this agent
  const sessions = allSessions.filter((s) => s.agentId === agentId);

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Handle new session creation
  const handleNewSession = useCallback(async (title: string) => {
    try {
      const newSession = await createSession({
        title,
        agentId,
        projectPath,
        projectName,
        status: 'todo',
        messageCount: 0,
      });

      // Close modal and open the new session
      setIsModalOpen(false);
      onSessionClick(newSession.id);
    } catch (error) {
      console.error('[AgentSessionList] Failed to create session:', error);
    }
  }, [createSession, agentId, projectPath, projectName, onSessionClick]);

  // Handle marking session as done
  const handleMarkDone = useCallback((sessionId: string) => {
    updateSession(sessionId, { status: 'done' });
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
      {visibleSessions.map((session) => {
        const isLoadingForSession = chatLoadingMap.get(session.id) ?? false;
        return (
          <AgentSessionItem
            key={session.id}
            session={session}
            onClick={onSessionClick}
            isActive={session.id === activeSessionId}
            agentColor={agentColor}
            // 🦆 SESSIONS-FIRST: Pass chat data for activity indicators
            chatMessages={chatSessions.get(session.id) || []}
            isLoading={isLoadingForSession}
            // Context menu callbacks
            onMarkDone={handleMarkDone}
            onDelete={handleDeleteRequest}
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

      {/* Compact "+" new session button */}
      <button
        onClick={() => setIsModalOpen(true)}
        title="Create new session"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 10px',
          marginBottom: '4px',
          background: `${agentColor}10`,
          border: `1px dashed ${agentColor}40`,
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '11px',
          color: `${agentColor}`,
          width: '100%',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = `${agentColor}20`;
          e.currentTarget.style.borderColor = `${agentColor}60`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = `${agentColor}10`;
          e.currentTarget.style.borderColor = `${agentColor}40`;
        }}
      >
        <span style={{ fontSize: '14px', lineHeight: 1 }}>+</span>
        <span>New Session</span>
      </button>

      {/* New Session Modal */}
      <NewSessionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleNewSession}
        agentName={agentName}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        isOpen={deleteDialogSession !== null}
        sessionTitle={deleteDialogSession?.title || ''}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteDialogSession(null)}
      />
    </div>
  );
}

export default memo(AgentSessionList);
