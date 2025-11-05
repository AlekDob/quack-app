import { useEffect, useState } from 'react'
import { convertFileSrc } from '@tauri-apps/api/core'
import type { TerminalInfo, ChatMessage } from '../types'

// Helper function to get avatar image URL (works in both dev and production)
function getAvatarUrl(avatarName: string): string {
  // Check if we're in Tauri context
  if (window.__TAURI__) {
    // In production, use convertFileSrc with the expected resource path
    // Tauri will handle the path resolution automatically
    return convertFileSrc(`/images/ducks/avatars/${avatarName}`, 'asset')
  }
  // In dev mode, use standard public path
  return `/images/ducks/avatars/${avatarName}`
}

interface TerminalActivityBarProps {
  terminal: TerminalInfo
  chatSessions?: Map<string, ChatMessage[]>
  hideBranch?: boolean  // New prop to hide branch badge
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
export default function TerminalActivityBar({ terminal, chatSessions, hideBranch = false }: TerminalActivityBarProps) {
  const status = terminal.status ?? 'idle'
  const [confirmedStatus, setConfirmedStatus] = useState<'busy' | 'idle'>(status)
  const [isHovering, setIsHovering] = useState(false)

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

  // Get last message from chat session
  const getLastMessage = (): string | null => {
    if (!chatSessions) return null
    const messages = chatSessions.get(terminal.id)
    if (!messages || messages.length === 0) return null

    const lastMsg = messages[messages.length - 1]
    if (!lastMsg || !lastMsg.content) return null

    // Truncate to 6-7 words
    const words = lastMsg.content.trim().split(/\s+/)
    if (words.length <= 7) return lastMsg.content
    return words.slice(0, 7).join(' ') + '...'
  }

  const lastMessage = getLastMessage()

  // Determine badge and styling based on state
  const getBadge = () => {
    if (isBusy) return '⚡'
    if (isWaitingForResponse) return '💬'
    return '' // No badge when idle
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
      {/* Only show avatar if it exists - no fallback dot */}
      {terminal.avatar && (
        <div
          className="terminal-avatar-container"
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          <div
            className={`terminal-avatar ${isBusy ? 'pulsing' : isWaitingForResponse ? 'waiting' : ''}`}
            style={{
              '--avatar-border-color': terminal.color,
            } as React.CSSProperties}
          >
            <img
              src={getAvatarUrl(terminal.avatar)}
              alt={terminal.label}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = `/images/ducks/${terminal.avatar}`;
              }}
            />
          </div>

          {/* Tooltip fumetto */}
          {isHovering && (terminal.workingOn || lastMessage) && (
            <div className="avatar-tooltip">
              <div className="avatar-tooltip-arrow" />
              <div className="avatar-tooltip-content">
                {terminal.workingOn && (
                  <div className="avatar-tooltip-working">
                    <strong>Working on:</strong> {terminal.workingOn}
                  </div>
                )}
                {lastMessage && (
                  <div className="avatar-tooltip-message">
                    <strong>Last message:</strong> {lastMessage}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Terminal details - name takes all available space with flex: 1 */}
      <div className="terminal-details" style={{ flex: 1 }}>
        <span className="terminal-name" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ flex: 1 }}>{terminal.label}</span>
          {/* Only show badge if busy or waiting for response */}
          {(isBusy || isWaitingForResponse) && (
            <span className={badgeClassName}>
              {getBadge()}
            </span>
          )}
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
