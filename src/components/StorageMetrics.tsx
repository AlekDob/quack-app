import { useSessionStore } from '../stores/sessionStore';

interface StorageMetricsProps {
  className?: string;
}

/**
 * Simple storage metrics display.
 * Note: Message storage is now handled by Claude SDK, not local files.
 */
export default function StorageMetrics({ className }: StorageMetricsProps) {
  const sessions = useSessionStore((s) => s.sessions);

  const activeSessions = sessions.filter((s) => s.status !== 'done');
  const completedSessions = sessions.filter((s) => s.status === 'done');

  return (
    <div
      className={className}
      style={{
        background: 'rgba(26, 26, 46, 0.6)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '8px',
        padding: '16px',
        color: '#fff',
      }}
    >
      <div style={{ marginBottom: '12px', fontSize: '14px', fontWeight: '600', opacity: 0.9 }}>
        Sessions
      </div>

      <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ opacity: 0.7 }}>Active:</span>
            <span style={{ fontWeight: '500' }}>{activeSessions.length}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ opacity: 0.7 }}>Completed:</span>
            <span style={{ fontWeight: '500' }}>{completedSessions.length}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ opacity: 0.7 }}>Total:</span>
            <span style={{ fontWeight: '500' }}>{sessions.length}</span>
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: '12px',
          paddingTop: '12px',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          fontSize: '11px',
          opacity: 0.6,
          lineHeight: '1.4'
        }}
      >
        Chat history is managed by Claude SDK.
      </div>
    </div>
  );
}
