import { useEffect, useState } from 'react'
import type { TerminalInfo } from '../types'

interface TerminalActivityBarProps {
  terminal: TerminalInfo
}

/**
 * TerminalActivityBar - Composable component for terminal activity visualization
 *
 * Features:
 * - Colored dot indicator with pulsing animation when busy
 * - Status badge (⚡ for busy, ✓ for idle)
 * - Animated progress bar when terminal is active
 * - 1-second delay before confirming idle state (prevents flickering)
 *
 * Usage:
 * ```tsx
 * <TerminalActivityBar terminal={terminal} />
 * ```
 */
export default function TerminalActivityBar({ terminal }: TerminalActivityBarProps) {
  const status = terminal.status ?? 'idle'
  const [confirmedStatus, setConfirmedStatus] = useState<'busy' | 'idle'>(status)

  useEffect(() => {
    if (status === 'busy') {
      // Immediately show busy state
      setConfirmedStatus('busy')
    } else {
      // Delay idle confirmation by 1 second
      const timer = setTimeout(() => {
        setConfirmedStatus('idle')
      }, 1000)

      return () => clearTimeout(timer)
    }
  }, [status])

  const isBusy = confirmedStatus === 'busy'

  return (
    <>
      <div
        className={`terminal-dot ${isBusy ? 'pulsing' : ''}`}
        style={{ backgroundColor: terminal.color }}
      />
      <div className="terminal-details">
        <span className="terminal-name">
          {terminal.label}
          <span className="terminal-status-badge">
            {isBusy ? '⚡' : '✓'}
          </span>
        </span>
        {isBusy && (
          <div className="terminal-progress-bar">
            <div className="terminal-progress-indicator" />
          </div>
        )}
      </div>
    </>
  )
}
