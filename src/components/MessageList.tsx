import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import ChatMessage from './ChatMessage';
import SkeletonMessage from './SkeletonMessage';
import DuckAnimation from './DuckAnimation';
import AnchorIndicator from './AnchorIndicator';
import type { ChatMessage as ChatMessageType, AskUserQuestionAnswers } from '../types';
import { getSessionAnchor, setSessionAnchor, clearSessionAnchor } from '../utils/sessionScrollMemory';
import './MessageList.css';

interface MessageListProps {
  messages: ChatMessageType[];
  loading?: boolean;
  onFilePathClick?: (path: string) => void;
  onOpenInIDE?: (path: string) => void;
  onSessionIdClick?: (sessionId: string) => void;
  agentName?: string;
  agentAvatar?: string;
  projectName?: string;
  gitBranch?: string;
  workingDirectory?: string;
  // Thinking mode reset key (changes when mode cycles)
  thinkingModeResetKey?: string | number;
  // AskUserQuestion support
  onUserQuestionAnswer?: (toolUseId: string, answers: AskUserQuestionAnswers, sessionKey?: string) => void;
  pendingQuestionIds?: Set<string>;
  answeredQuestions?: Map<string, AskUserQuestionAnswers>;
  // Current session ID for display in chat header
  currentSessionId?: string;
  // Show/hide ThinkingBlocks (controlled by footer icon)
  showThinkingBlocks?: boolean;
  // File Checkpointing (SDK 0.2.7+)
  onRewindFiles?: (userMessageId: string) => void;
  // Image preview
  onOpenImageTab?: (filePath: string, imageData: string, mediaType: string) => void;
  // Open Agent Personality panel
  onOpenPersonality?: () => void;
  // Plan approval
  pendingPlanApprovalIds?: Set<string>;
  onPlanApprovalResponse?: (requestId: string, approved: boolean, feedback?: string) => void;
  // Teammate stream drill-down
  onTeammateDrillDown?: (sessionId: string, name: string) => void;
}

export default function MessageList({ messages, loading, onFilePathClick, onOpenInIDE, onSessionIdClick, agentName, agentAvatar, projectName, gitBranch, workingDirectory, thinkingModeResetKey, onUserQuestionAnswer, pendingQuestionIds, answeredQuestions, currentSessionId, showThinkingBlocks = true, onRewindFiles, onOpenImageTab, onOpenPersonality, pendingPlanApprovalIds, onPlanApprovalResponse, onTeammateDrillDown }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevMessagesLengthRef = useRef(messages.length);
  const prevFirstMessageIdRef = useRef<string | null>(messages[0]?.id ?? null);
  const userHasScrolledUpRef = useRef(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [showScrollToTopButton, setShowScrollToTopButton] = useState(false);

  // Check if user is at bottom of scroll
  const checkIfAtBottom = useCallback(() => {
    if (!scrollRef.current) return true;

    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    // Consider "at bottom" if within 100px from bottom
    return distanceFromBottom < 100;
  }, []);

  // Brain: 005-performance-critical-refactor
  // Memoize user message check to avoid linear scan in scroll handler
  const hasUserMessages = useMemo(
    () => messages.some(m => m.role === 'user'),
    [messages]
  );

  // Handle scroll events to show/hide scroll buttons
  const handleScroll = useCallback(() => {
    const isAtBottom = checkIfAtBottom();
    setShowScrollButton(!isAtBottom);

    // Track if user scrolled away from bottom during streaming
    if (loading) {
      if (!isAtBottom) {
        userHasScrolledUpRef.current = true;
      } else {
        userHasScrolledUpRef.current = false;
      }
    }

    // Show "scroll to top" (previous user message) button when:
    // 1. Not at bottom (scrolled up in conversation)
    // 2. There are user messages to navigate to
    setShowScrollToTopButton(!isAtBottom && hasUserMessages);
  }, [checkIfAtBottom, hasUserMessages, loading]);

  // Scroll to bottom function
  const scrollToBottom = useCallback(() => {
    if (!scrollRef.current) return;

    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth'
    });
  }, []);

  // Navigate to previous user message (ignoring sticky header)
  const scrollToPreviousUserMessage = useCallback(() => {
    if (!scrollRef.current) return;

    // Get all user message indices
    const userMessageIndices = messages
      .map((m, i) => ({ msg: m, index: i }))
      .filter(({ msg }) => msg.role === 'user')
      .map(({ index }) => index);

    if (userMessageIndices.length === 0) return;

    // Get current scroll position
    const currentScrollTop = scrollRef.current.scrollTop;
    const messageElements = scrollRef.current.querySelectorAll('.chat-message');

    // Find which user message we're currently viewing or past
    let targetIndex = -1;

    for (let i = userMessageIndices.length - 1; i >= 0; i--) {
      const messageIndex = userMessageIndices[i];
      const element = messageElements[messageIndex] as HTMLElement;

      if (element) {
        const elementTop = element.offsetTop;

        // If this message is above current scroll position (with some buffer)
        // This is our target - the previous user message
        if (elementTop < currentScrollTop - 50) {
          targetIndex = messageIndex;
          break;
        }
      }
    }

    // If no message found above current position, wrap to last user message
    if (targetIndex === -1) {
      targetIndex = userMessageIndices[userMessageIndices.length - 1];
    }

    // Scroll to the target user message
    const targetElement = messageElements[targetIndex] as HTMLElement;
    if (targetElement) {
      const elementTop = targetElement.offsetTop;
      const targetScroll = elementTop - 80; // 80px padding from top (to avoid sticky header)

      scrollRef.current.scrollTo({
        top: targetScroll,
        behavior: 'smooth'
      });
    }
  }, [messages]);

  // Brain: pattern-session-scroll-memory
  // Anchor-based scroll restore:
  // - If the session has an anchor (user clicked the anchor icon on a previous
  //   visit) → scroll to that message's DOM element.
  // - Otherwise → always scroll to bottom.
  // A ResizeObserver keeps the target aligned while late content (markdown,
  // code blocks, images) finishes mounting and grows the scrollHeight.
  const [anchoredMessageId, setAnchoredMessageId] = useState<string | null>(() =>
    currentSessionId ? getSessionAnchor(currentSessionId)?.messageId ?? null : null,
  );

  useEffect(() => {
    setAnchoredMessageId(
      currentSessionId ? getSessionAnchor(currentSessionId)?.messageId ?? null : null,
    );
  }, [currentSessionId]);

  // Track whether we've already applied the initial scroll for this session.
  // Messages load async; we need to re-apply once they arrive.
  const appliedInitialScrollForSessionRef = useRef<string | null>(null);

  useEffect(() => {
    // Reset the flag when switching sessions so the next batch of messages triggers scroll
    appliedInitialScrollForSessionRef.current = null;
  }, [currentSessionId]);

  // Scroll lock: true until user scrolls manually. While true, every content
  // resize re-forces scrollToBottom. This handles streaming batches and
  // messages that arrive after the initial mount.
  const scrollLockedRef = useRef(true);

  useEffect(() => {
    // Reset lock on session switch
    scrollLockedRef.current = true;
  }, [currentSessionId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (messages.length === 0) return;
    if (appliedInitialScrollForSessionRef.current === currentSessionId) return;
    appliedInitialScrollForSessionRef.current = currentSessionId ?? null;

    const anchor = currentSessionId ? getSessionAnchor(currentSessionId) : undefined;

    const applyTarget = () => {
      if (!scrollRef.current) return;
      if (!scrollLockedRef.current) return;
      const el = scrollRef.current;
      if (anchor) {
        const target = el.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(anchor.messageId)}"]`);
        if (target) {
          el.scrollTop = target.offsetTop - el.offsetTop;
          return;
        }
      }
      el.scrollTop = el.scrollHeight;
      handleScroll();
    };

    applyTarget();

    const content = el.querySelector<HTMLElement>('.message-list-content');

    // Detect manual user scroll via wheel/touch to release lock
    const releaseLock = () => {
      if (scrollLockedRef.current) scrollLockedRef.current = false;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (['PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) releaseLock();
    };
    el.addEventListener('wheel', releaseLock, { passive: true });
    el.addEventListener('touchmove', releaseLock, { passive: true });
    window.addEventListener('keydown', onKeyDown);

    const observer = new ResizeObserver(() => applyTarget());
    observer.observe(el);
    if (content) observer.observe(content);

    let frame = 0;
    let rafId = 0;
    const rafLoop = () => {
      applyTarget();
      if (++frame < 12 && scrollLockedRef.current) rafId = requestAnimationFrame(rafLoop);
    };
    rafId = requestAnimationFrame(rafLoop);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
      el.removeEventListener('wheel', releaseLock);
      el.removeEventListener('touchmove', releaseLock);
      window.removeEventListener('keydown', onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSessionId, messages.length > 0]);

  // Anchor handlers
  const handleAnchor = useCallback((messageId: string) => {
    if (!currentSessionId) return;
    setSessionAnchor(currentSessionId, messageId);
    setAnchoredMessageId(messageId);
  }, [currentSessionId]);

  const handleRemoveAnchor = useCallback(() => {
    if (!currentSessionId) return;
    clearSessionAnchor(currentSessionId);
    setAnchoredMessageId(null);
  }, [currentSessionId]);

  const handleJumpToAnchor = useCallback(() => {
    if (!scrollRef.current || !anchoredMessageId) return;
    const target = scrollRef.current.querySelector<HTMLElement>(
      `[data-message-id="${CSS.escape(anchoredMessageId)}"]`,
    );
    if (target) {
      scrollRef.current.scrollTo({
        top: target.offsetTop - scrollRef.current.offsetTop,
        behavior: 'smooth',
      });
    }
  }, [anchoredMessageId]);

  // Auto-scroll to bottom when new messages arrive or during streaming
  useEffect(() => {
    if (!scrollRef.current) return;

    const isAtBottom = checkIfAtBottom();
    const hasNewMessage = messages.length > prevMessagesLengthRef.current;
    const lastMessage = messages[messages.length - 1];

    // Detect lazy hydration: messages jumped from 0 to many (session loaded)
    const isLazyHydration = prevMessagesLengthRef.current === 0 && messages.length > 1;

    // Determine if we should auto-scroll
    let shouldAutoScroll = false;

    if (isLazyHydration) {
      // Always scroll to bottom when session is hydrated (loaded from disk)
      shouldAutoScroll = true;
    } else if (hasNewMessage) {
      // Reset scroll lock when user sends a new message
      if (lastMessage?.role === 'user') {
        userHasScrolledUpRef.current = false;
      }
      // Always auto-scroll for user messages or if already at bottom
      shouldAutoScroll = lastMessage?.role === 'user' || isAtBottom;
    } else if (loading) {
      // During streaming, only auto-scroll if user hasn't scrolled up
      shouldAutoScroll = !userHasScrolledUpRef.current && isAtBottom;
    }

    if (shouldAutoScroll) {
      // Use a small delay for lazy hydration to ensure DOM is ready
      const delay = isLazyHydration ? 100 : 0;
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTo({
            top: scrollRef.current.scrollHeight,
            behavior: isLazyHydration ? 'auto' : 'smooth' // Instant for hydration, smooth for streaming
          });
        }
      }, delay);
    }

    prevMessagesLengthRef.current = messages.length;
  }, [messages, loading, checkIfAtBottom]);

  // Reset scroll lock when streaming ends
  useEffect(() => {
    if (!loading) {
      userHasScrolledUpRef.current = false;
    }
  }, [loading]);

  // Find the last user message
  const lastUserMessageIndex = messages.reduce((lastIndex, msg, index) => {
    return msg.role === 'user' ? index : lastIndex;
  }, -1);


  if (messages.length === 0 && !loading) {
    return (
      <div className="message-list-empty">
        <div className="empty-state">
          <DuckAnimation onClick={onOpenPersonality} />
        </div>
      </div>
    );
  }

  return (
    <div className="message-list-wrapper">
    <div className="message-list" ref={scrollRef} onScroll={handleScroll}>
      <div className="message-list-content">
        {messages.map((message, index) => {
          const prevMessage = index > 0 ? messages[index - 1] : null;
          const showHeader = message.role === 'user' || !prevMessage || prevMessage.role !== 'assistant';
          return (
            <div key={message.id} className="message-wrapper" data-message-id={message.id}>
              <ChatMessage
                message={message}
                onFilePathClick={onFilePathClick}
                onOpenInIDE={onOpenInIDE}
                onSessionIdClick={onSessionIdClick}
                agentName={agentName}
                agentAvatar={agentAvatar}
                projectName={projectName}
                gitBranch={gitBranch}
                isLastUserMessage={index === lastUserMessageIndex}
                workingDirectory={workingDirectory}
                thinkingModeResetKey={thinkingModeResetKey}
                onUserQuestionAnswer={onUserQuestionAnswer}
                pendingQuestionIds={pendingQuestionIds}
                answeredQuestions={answeredQuestions}
                currentSessionId={currentSessionId}
                showThinkingBlocks={showThinkingBlocks}
                onRewindFiles={onRewindFiles}
                onOpenImageTab={onOpenImageTab}
                pendingPlanApprovalIds={pendingPlanApprovalIds}
                onPlanApprovalResponse={onPlanApprovalResponse}
                onTeammateDrillDown={onTeammateDrillDown}
                showHeader={showHeader}
              />
            </div>
          );
        })}
        {loading && <SkeletonMessage />}
      </div>
    </div>
      <AnchorIndicator
        scrollRef={scrollRef}
        sessionId={currentSessionId}
        anchoredMessageId={anchoredMessageId}
        onAnchor={handleAnchor}
        onRemove={handleRemoveAnchor}
        onJumpToAnchor={handleJumpToAnchor}
      />
      {showScrollButton && (
        <button
          className="scroll-to-bottom-button"
          onClick={scrollToBottom}
          aria-label="Scroll to bottom"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M10 14L5 9L6.5 7.5L10 11L13.5 7.5L15 9L10 14Z"
              fill="currentColor"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
