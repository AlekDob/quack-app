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
 * - Status badge (⚡ for busy, 💬 for waiting response, ✓ for idle)
 * - Animated progress bar when terminal is active
 * - Gentle pulse animation when waiting for user response
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
  const isWaitingForResponse = terminal.waitingForResponse ?? false

  // Determine badge and styling based on state
  const getBadge = () => {
    if (isBusy) return '⚡'
    if (isWaitingForResponse) return '💬'
    return '✓'
  }

  const dotClassName = isBusy
    ? 'terminal-dot pulsing'
    : isWaitingForResponse
      ? 'terminal-dot waiting'
      : 'terminal-dot'

  const badgeClassName = isWaitingForResponse
    ? 'terminal-status-badge waiting'
    : 'terminal-status-badge'

  return (
    <>
      {terminal.avatar ? (
        <div
          className={`terminal-avatar ${isBusy ? 'pulsing' : isWaitingForResponse ? 'waiting' : ''}`}
          style={{
            '--avatar-border-color': terminal.color,
          } as React.CSSProperties}
        >
          <img
            src={`/images/ducks/avatars/${terminal.avatar}`}
            alt={terminal.label}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = `/images/ducks/${terminal.avatar}`;
            }}
          />
        </div>
      ) : (
        <div
          className={dotClassName}
          style={{ backgroundColor: terminal.color }}
        />
      )}
      <div className="terminal-details">
        <span className="terminal-name">
          {terminal.label}
          <span className={badgeClassName}>
            {getBadge()}
          </span>
        </span>
        {terminal.workingOn && (
          <span className="terminal-working-on">
            {terminal.workingOn}
          </span>
        )}
        {isBusy && (
          <div className="terminal-progress-bar">
            <div className="terminal-progress-indicator" />
          </div>
        )}
      </div>
    </>
  )
}
