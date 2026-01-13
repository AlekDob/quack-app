import { useEffect, useState, memo, useMemo } from 'react'
import { convertFileSrc } from '@tauri-apps/api/core'
import type { TerminalInfo, ChatMessage } from '../types'
import { getCustomAvatarUrl, isCustomAvatar } from '../utils/customAvatarStorage'
import Tooltip from './Tooltip'

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

  // 🦆 FIX: Use aggregated values from parent when available (sessions-first architecture)
  // Parent passes aggregatedIsDormant/aggregatedHasUnread calculated from sessions
  // Fallback to local calculation (using terminal.id) for backward compatibility
  const terminalWithAggregated = terminal as typeof terminal & {
    aggregatedIsDormant?: boolean;
    aggregatedHasUnread?: boolean;
  };

  // Check if chat is empty (no messages) - local fallback
  const isChatEmptyLocal = useMemo(() => {
    if (!chatSessions) return true
    const messages = chatSessions.get(terminal.id)
    return !messages || messages.length === 0
  }, [chatSessions, terminal.id])

  // Check if agent is dormant - prefer aggregated from parent
  const isDormantLocal = useMemo(() => {
    if (!chatSessions) return true
    const messages = chatSessions.get(terminal.id)
    if (!messages || messages.length === 0) return true
    const hasUserMessage = messages.some(msg => msg.role === 'user')
    return !hasUserMessage
  }, [chatSessions, terminal.id])
  
  // 🦆 FIX: Use aggregated value if available, otherwise fallback to local
  const isDormant = terminalWithAggregated.aggregatedIsDormant ?? isDormantLocal
  const isChatEmpty = isChatEmptyLocal && isDormant // Empty only if local is empty AND dormant

  // Check if there are unread messages - prefer aggregated from parent
  const hasUnreadMessagesLocal = useMemo(() => {
    if (!chatSessions || isActive) return false
    const messages = chatSessions.get(terminal.id)
    if (!messages || messages.length === 0) return false
    if (isDormantLocal) return false
    const lastAssistantMessage = [...messages].reverse().find(msg => msg.role === 'assistant')
    return lastAssistantMessage !== undefined
  }, [chatSessions, terminal.id, isActive, isDormantLocal])
  
  // 🦆 FIX: Use aggregated value if available, otherwise fallback to local
  const hasUnreadMessages = terminalWithAggregated.aggregatedHasUnread ?? hasUnreadMessagesLocal

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
    // 🚨 CRITICAL: Check isDormant BEFORE isWaitingForResponse!
    // Dormant agents should NEVER show 💬 even if waitingForResponse is true
    if (isChatEmpty || isDormant) return '💤' // Empty chat or dormant (no user interaction)
    // NO badge when agent is active (regardless of dormancy or unread messages)
    if (isActive) return ''
    // Now check isWaitingForResponse (only for non-dormant agents)
    if (isWaitingForResponse) return '💬'
    if (hasUnreadMessages) return '💬' // Has unread messages from assistant
    return '' // No badge when all messages are read
  }, [isBusy, isWaitingForResponse, isActive, isChatEmpty, isDormant, hasUnreadMessages])

  const badgeClassName = useMemo(() => {
    if (isWaitingForResponse) return 'terminal-status-badge waiting'
    if (isChatEmpty || isDormant) return 'terminal-status-badge sleeping' // Sleeping style for empty chat or dormant
    if (hasUnreadMessages) return 'terminal-status-badge waiting' // Use waiting style for unread (pulsing)
    return 'terminal-status-badge'
  }, [isWaitingForResponse, isChatEmpty, isDormant, hasUnreadMessages])

  return (
    <>
      {/* 🎨 AVATAR HIDDEN - Now shown in RepositoryGroup as letter avatar */}

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
        {terminal.personality?.role && (
          <Tooltip content={terminal.workingOn ? `Working on: ${terminal.workingOn}` : null} position="bottom" show={!!terminal.workingOn}>
            <span className="role-mission">{terminal.personality.role}</span>
          </Tooltip>
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
    prevProps.terminal.personality?.role === nextProps.terminal.personality?.role &&
    prevProps.hideBranch === nextProps.hideBranch &&
    prevProps.chatSessions === nextProps.chatSessions &&
    prevProps.isActive === nextProps.isActive
  )
})
