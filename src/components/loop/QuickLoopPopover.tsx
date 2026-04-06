import { useState, useRef, type RefObject } from 'react';
import type { QuickLoopStatus } from '../../hooks/useQuickLoop';

// Usage example:
// <QuickLoopPopover
//   isOpen={showPopover}
//   onClose={() => setShowPopover(false)}
//   onStartLoop={({ prompt, intervalMs, maxRuns }) => startLoop({ prompt, intervalMs, maxRuns })}
//   status={status}
//   onStopLoop={stopLoop}
//   currentRun={currentRun}
//   anchorRef={buttonRef}
// />

interface QuickLoopPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onStartLoop: (config: { prompt: string; intervalMs: number; maxRuns?: number }) => void;
  status: QuickLoopStatus;
  activePrompt: string;
  onStopLoop: () => void;
  currentRun: number;
  anchorRef?: RefObject<HTMLButtonElement | null>;
}

const INTERVAL_OPTIONS = [
  { label: '30s', value: 30_000 },
  { label: '1 min', value: 60_000 },
  { label: '2 min', value: 120_000 },
  { label: '5 min', value: 300_000 },
  { label: '10 min', value: 600_000 },
  { label: '30 min', value: 1_800_000 },
] as const;

const popoverStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '100%',
  left: 0,
  marginBottom: 8,
  minWidth: 280,
  background: 'rgba(10, 10, 18, 0.92)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: 12,
  padding: 16,
  zIndex: 9999,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 36,
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  padding: '0 10px',
  color: '#e8e8e8',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  color: 'rgba(255,255,255,0.45)',
  marginBottom: 4,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
};

function buildRowStyle(gap?: number): React.CSSProperties {
  return { display: 'flex', gap: gap ?? 8, marginTop: 8 };
}

function IdleForm({ onStart }: { onStart: (prompt: string, intervalMs: number, maxRuns?: number) => void }) {
  const [prompt, setPrompt] = useState('');
  const [intervalMs, setIntervalMs] = useState(60_000);
  const [maxRunsInput, setMaxRunsInput] = useState('');

  const handleSubmit = () => {
    if (!prompt.trim()) return;
    const maxRuns = maxRunsInput ? parseInt(maxRunsInput, 10) : undefined;
    onStart(prompt.trim(), intervalMs, maxRuns);
  };

  return (
    <>
      <div>
        <label style={labelStyle}>Prompt</label>
        <input
          style={inputStyle}
          placeholder="What should repeat?"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          autoFocus
        />
      </div>

      <div style={buildRowStyle()}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Interval</label>
          <select
            style={{ ...inputStyle, cursor: 'pointer' }}
            value={intervalMs}
            onChange={e => setIntervalMs(Number(e.target.value))}
          >
            {INTERVAL_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Max Runs</label>
          <input
            style={inputStyle}
            type="number"
            min={1}
            placeholder="∞"
            value={maxRunsInput}
            onChange={e => setMaxRunsInput(e.target.value)}
          />
        </div>
      </div>

      <button
        style={{
          marginTop: 12,
          width: '100%',
          background: 'var(--accent-color)',
          border: 'none',
          borderRadius: 8,
          padding: '9px 0',
          color: '#fff',
          fontSize: 13,
          fontWeight: 600,
          cursor: prompt.trim() ? 'pointer' : 'not-allowed',
          opacity: prompt.trim() ? 1 : 0.5,
        }}
        onClick={handleSubmit}
        disabled={!prompt.trim()}
      >
        Start Loop
      </button>
    </>
  );
}

function RunningStatus({ prompt, currentRun, onStop }: { prompt: string; currentRun: number; onStop: () => void }) {
  const truncated = prompt.length > 50 ? `${prompt.slice(0, 47)}…` : prompt;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-color)',
          animation: 'quickloop-pulse 1.4s ease-in-out infinite',
          flexShrink: 0,
        }} />
        <span style={{ color: '#e8e8e8', fontSize: 13, fontWeight: 600 }}>
          Loop active — Run #{currentRun}
        </span>
      </div>

      <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, margin: '0 0 12px', lineHeight: 1.4 }}>
        {truncated}
      </p>

      <button
        style={{
          width: '100%',
          background: 'rgba(220, 53, 69, 0.15)',
          border: '1px solid rgba(220, 53, 69, 0.4)',
          borderRadius: 8,
          padding: '8px 0',
          color: '#ff6b6b',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
        }}
        onClick={onStop}
      >
        Stop Loop
      </button>
    </>
  );
}

export function QuickLoopPopover({
  isOpen,
  onClose,
  onStartLoop,
  status,
  activePrompt,
  onStopLoop,
  currentRun,
  anchorRef: _anchorRef,
}: QuickLoopPopoverProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isRunning = status === 'running' || status === 'paused';

  if (!isOpen) return null;

  const handleStart = (prompt: string, intervalMs: number, maxRuns?: number) => {
    onStartLoop({ prompt, intervalMs, maxRuns });
  };

  const handleStop = () => {
    onStopLoop();
    onClose();
  };

  return (
    <div ref={containerRef} style={popoverStyle} role="dialog" aria-label="Quick Loop configuration">
      <style>{`
        @keyframes quickloop-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-color)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Quick Loop
        </span>
        <button
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1 }}
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {isRunning
        ? <RunningStatus prompt={activePrompt} currentRun={currentRun} onStop={handleStop} />
        : <IdleForm onStart={handleStart} />
      }
    </div>
  );
}
