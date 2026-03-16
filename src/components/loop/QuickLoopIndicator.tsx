import type { QuickLoopStatus } from '../../hooks/useQuickLoop';

// Usage example:
// <QuickLoopIndicator status={status} currentRun={currentRun} onClick={() => setShowPopover(true)} />

interface QuickLoopIndicatorProps {
  status: QuickLoopStatus;
  currentRun: number;
  onClick: () => void;
}

const PULSE_KEYFRAMES = `
  @keyframes quickloop-indicator-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(0.85); }
  }
`;

const pillStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  background: 'rgba(255, 107, 53, 0.15)',
  border: '1px solid rgba(255, 107, 53, 0.3)',
  borderRadius: 20,
  padding: '3px 9px 3px 6px',
  cursor: 'pointer',
  userSelect: 'none',
  transition: 'background 0.15s ease',
};

const dotStyle: React.CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: '50%',
  background: '#FF6B35',
  flexShrink: 0,
  animation: 'quickloop-indicator-pulse 1.4s ease-in-out infinite',
};

const textStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: '#FF6B35',
  letterSpacing: '0.03em',
  lineHeight: 1,
};

export function QuickLoopIndicator({ status, currentRun, onClick }: QuickLoopIndicatorProps) {
  if (status !== 'running') return null;

  return (
    <>
      <style>{PULSE_KEYFRAMES}</style>
      <button
        style={pillStyle}
        onClick={onClick}
        aria-label={`Quick Loop active, run ${currentRun}. Click to manage.`}
        title="Quick Loop running"
      >
        <span style={dotStyle} aria-hidden="true" />
        <span style={textStyle}>Loop #{currentRun}</span>
      </button>
    </>
  );
}
