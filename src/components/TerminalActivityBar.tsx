import { useEffect, useState, memo, useMemo } from 'react'
import { convertFileSrc } from '@tauri-apps/api/core'
import type { TerminalInfo, ChatMessage } from '../types'
import { getCustomAvatarUrl, isCustomAvatar } from '../utils/customAvatarStorage'

// Helper function to get avatar image URL (works in both dev and production)
function getAvatarUrl(avatarName: string): string {
  // Check if we're in Tauri context
  if (window.__TAURI__) {
    // In production, use convertFileSrc with the expected resource path
    // Tauri will handle the path resolution automatically
    return convertFileSrc(`/images/ducks/new-avatars/${avatarName}`, 'asset')
  }
  // In dev mode, use standard public path
  return `/images/ducks/new-avatars/${avatarName}`
}

interface TerminalActivityBarProps {
  terminal: TerminalInfo
  chatSessions?: Map<string, ChatMessage[]>
  hideBranch?: boolean  // New prop to hide branch badge
  isActive?: boolean  // Whether this terminal is currently active (to manage unread state)
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
function TerminalActivityBar({ terminal, chatSessions, isActive = false }: TerminalActivityBarProps) {
  const status = terminal.status ?? 'idle'
  const [confirmedStatus, setConfirmedStatus] = useState<'busy' | 'idle'>(status)
  const [isHovering, setIsHovering] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

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

  // Debug: Log when isActive changes
  useEffect(() => {
    console.log(`[${terminal.label}] 🎯 isActive changed to: ${isActive}`)
  }, [isActive, terminal.label])

  // Load custom avatar URL if needed - WITH FALLBACK for undefined avatars
  useEffect(() => {
    let isMounted = true

    async function loadAvatarUrl() {
      // If no avatar specified, use duck30.jpeg fallback
      if (!terminal.avatar) {
        console.log('[TerminalActivityBar] No avatar specified, using duck30.jpeg fallback')
        if (isMounted) {
          // Use duck30.jpeg as fallback for terminals with undefined avatar
          if (window.__TAURI__) {
            setAvatarUrl(convertFileSrc('/images/ducks/new-avatars/duck30.jpeg', 'asset'))
          } else {
            setAvatarUrl('/duck30.jpeg')
          }
        }
        return
      }

      // Check if it's a custom avatar (UUID format)
      if (isCustomAvatar(terminal.avatar)) {
        try {
          const url = await getCustomAvatarUrl(terminal.avatar)
          if (isMounted) {
            setAvatarUrl(url)
          }
        } catch (error) {
          console.error('Failed to load custom avatar:', error)
          if (isMounted) {
            // Fallback to duck30.jpeg if custom avatar fails
            if (window.__TAURI__) {
              setAvatarUrl(convertFileSrc('/images/ducks/new-avatars/duck30.jpeg', 'asset'))
            } else {
              setAvatarUrl('/duck30.jpeg')
            }
          }
        }
      } else {
        // Default avatar - use getAvatarUrl helper
        if (isMounted) {
          setAvatarUrl(getAvatarUrl(terminal.avatar))
        }
      }
    }

    loadAvatarUrl()

    return () => {
      isMounted = false
    }
  }, [terminal.avatar])

  const isBusy = confirmedStatus === 'busy'
  const isWaitingForResponse = terminal.waitingForResponse ?? false

  // Check if chat is empty (no messages)
  const isChatEmpty = useMemo(() => {
    if (!chatSessions) return true
    const messages = chatSessions.get(terminal.id)
    return !messages || messages.length === 0
  }, [chatSessions, terminal.id])

  // Check if there are unread messages (agent responded but terminal not active)
  const hasUnreadMessages = useMemo(() => {
    if (!chatSessions || isActive) {
      console.log(`[${terminal.label}] 💬 hasUnreadMessages=false (isActive=${isActive}, chatSessions exists=${!!chatSessions})`)
      return false // If active, no unread messages
    }
    const messages = chatSessions.get(terminal.id)
    if (!messages || messages.length === 0) {
      console.log(`[${terminal.label}] 💬 hasUnreadMessages=false (no messages)`)
      return false
    }

    // Check if there's at least one assistant message
    const lastAssistantMessage = [...messages].reverse().find(msg => msg.role === 'assistant')
    const result = lastAssistantMessage !== undefined
    console.log(`[${terminal.label}] 💬 hasUnreadMessages=${result} (isActive=${isActive}, hasAssistantMsg=${lastAssistantMessage !== undefined})`)
    return result
  }, [chatSessions, terminal.id, isActive, terminal.label])

  // Memoize last message calculation
  const lastMessage = useMemo((): string | null => {
    if (!chatSessions) return null
    const messages = chatSessions.get(terminal.id)
    if (!messages || messages.length === 0) return null

    const lastMsg = messages[messages.length - 1]
    if (!lastMsg || !lastMsg.content) return null

    // Truncate to 6-7 words
    const words = lastMsg.content.trim().split(/\s+/)
    if (words.length <= 7) return lastMsg.content
    return words.slice(0, 7).join(' ') + '...'
  }, [chatSessions, terminal.id])

  // Memoize badge calculation
  const badge = useMemo(() => {
    if (isBusy) return '⚡'
    if (isWaitingForResponse) return '💬'
    // New logic: 💤 for empty chat, 💬 for unread messages, nothing if read
    if (isChatEmpty) return '💤' // Empty chat - never had messages
    if (hasUnreadMessages) return '💬' // Has unread messages from assistant
    return '' // No badge when all messages are read
  }, [isBusy, isWaitingForResponse, isChatEmpty, hasUnreadMessages])

  const badgeClassName = useMemo(() => {
    if (isWaitingForResponse) return 'terminal-status-badge waiting'
    if (isChatEmpty) return 'terminal-status-badge sleeping' // Reuse sleeping style for empty chat
    if (hasUnreadMessages) return 'terminal-status-badge waiting' // Use waiting style for unread (pulsing)
    return 'terminal-status-badge'
  }, [isWaitingForResponse, isChatEmpty, hasUnreadMessages])

  return (
    <>
      {/* ALWAYS show avatar - fallback to duck30.jpeg if not specified */}
      {avatarUrl && (
        <div
          className="terminal-avatar-container"
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          <div
            className={`terminal-avatar ${isBusy ? 'pulsing' : isWaitingForResponse ? 'waiting' : isChatEmpty ? 'sleeping' : hasUnreadMessages ? 'waiting' : ''}`}
            style={{
              '--avatar-border-color': terminal.color,
            } as React.CSSProperties}
          >
            <img
              src={avatarUrl}
              alt={terminal.label}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                console.error('[TerminalActivityBar] Image failed to load, using fallback duck30.jpeg:', avatarUrl)
                // Always fallback to duck30.jpeg on error
                if (window.__TAURI__) {
                  target.src = convertFileSrc('/images/ducks/new-avatars/duck30.jpeg', 'asset')
                } else {
                  target.src = '/duck30.jpeg'
                }
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
          {/* Show badge if busy, waiting, empty chat, or has unread messages */}
          {(isBusy || isWaitingForResponse || isChatEmpty || hasUnreadMessages) && (
            <span className={badgeClassName}>
              {badge}
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

// Export memoized version with custom comparison
export default memo(TerminalActivityBar, (prevProps, nextProps) => {
  // Only re-render if these specific props change
  return (
    prevProps.terminal.id === nextProps.terminal.id &&
    prevProps.terminal.label === nextProps.terminal.label &&
    prevProps.terminal.status === nextProps.terminal.status &&
    prevProps.terminal.avatar === nextProps.terminal.avatar &&
    prevProps.terminal.color === nextProps.terminal.color &&
    prevProps.terminal.workingOn === nextProps.terminal.workingOn &&
    prevProps.terminal.waitingForResponse === nextProps.terminal.waitingForResponse &&
    prevProps.hideBranch === nextProps.hideBranch &&
    prevProps.chatSessions === nextProps.chatSessions &&
    prevProps.isActive === nextProps.isActive
  )
})
