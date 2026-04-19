import { useEffect, useRef, useState, useCallback, memo } from 'react';
import type { CSSProperties, ReactElement } from 'react';
import { List, useListRef, useDynamicRowHeight } from 'react-window';
import { AutoSizer } from 'react-virtualized-auto-sizer';
import ChatMessage from './ChatMessage';
import SkeletonMessage from './SkeletonMessage';
import DuckAnimation from './DuckAnimation';
import type { ChatMessage as ChatMessageType, AskUserQuestionAnswers } from '../types';
import './MessageList.css';

// Brain: 005-performance-critical-refactor
// Virtualized message list for sessions with 50+ messages
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
  thinkingModeResetKey?: string | number;
  onUserQuestionAnswer?: (toolUseId: string, answers: AskUserQuestionAnswers, sessionKey?: string) => void;
  pendingQuestionIds?: Set<string>;
  answeredQuestions?: Map<string, AskUserQuestionAnswers>;
  currentSessionId?: string;
  showThinkingBlocks?: boolean;
  onRewindFiles?: (userMessageId: string) => void;
  onOpenImageTab?: (filePath: string, imageData: string, mediaType: string) => void;
  onOpenPersonality?: () => void;
  pendingPlanApprovalIds?: Set<string>;
  onPlanApprovalResponse?: (requestId: string, approved: boolean, feedback?: string) => void;
  onTeammateDrillDown?: (sessionId: string, name: string) => void;
}

// Row props passed via List's rowProps
interface MessageRowProps {
  messages: ChatMessageType[];
  loading: boolean;
  onFilePathClick?: (path: string) => void;
  onOpenInIDE?: (path: string) => void;
  onSessionIdClick?: (sessionId: string) => void;
  agentName?: string;
  agentAvatar?: string;
  projectName?: string;
  gitBranch?: string;
  workingDirectory?: string;
  lastUserMessageIndex: number;
  thinkingModeResetKey?: string | number;
  onUserQuestionAnswer?: (toolUseId: string, answers: AskUserQuestionAnswers, sessionKey?: string) => void;
  pendingQuestionIds?: Set<string>;
  answeredQuestions?: Map<string, AskUserQuestionAnswers>;
  currentSessionId?: string;
  showThinkingBlocks?: boolean;
  onRewindFiles?: (userMessageId: string) => void;
  onOpenImageTab?: (filePath: string, imageData: string, mediaType: string) => void;
  onOpenPersonality?: () => void;
  pendingPlanApprovalIds?: Set<string>;
  onPlanApprovalResponse?: (requestId: string, approved: boolean, feedback?: string) => void;
  onTeammateDrillDown?: (sessionId: string, name: string) => void;
}

const DEFAULT_MESSAGE_HEIGHT = 120;

// react-window v2 row component receives props directly (not via data)
function MessageRow({
  index,
  style,
  messages,
  loading,
  onFilePathClick,
  onOpenInIDE,
  onSessionIdClick,
  agentName,
  agentAvatar,
  projectName,
  gitBranch,
  workingDirectory,
  lastUserMessageIndex,
  thinkingModeResetKey,
  onUserQuestionAnswer,
  pendingQuestionIds,
  answeredQuestions,
  currentSessionId,
  showThinkingBlocks,
  onRewindFiles,
  onOpenImageTab,
  pendingPlanApprovalIds,
  onPlanApprovalResponse,
  onTeammateDrillDown,
}: {
  index: number;
  style: CSSProperties;
  ariaAttributes: Record<string, unknown>;
} & MessageRowProps): ReactElement | null {
  // Show skeleton for loading state at the end
  if (index === messages.length && loading) {
    return (
      <div style={style}>
        <SkeletonMessage />
      </div>
    );
  }

  if (index >= messages.length) {
    return null;
  }

  const message = messages[index];
  const prevMessage = index > 0 ? messages[index - 1] : null;
  const showHeader = message.role === 'user' || !prevMessage || prevMessage.role !== 'assistant';

  return (
    <div style={style}>
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
        showHeader={showHeader}
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
      />
    </div>
  );
}

function MessageListVirtualized({
  messages,
  loading,
  onFilePathClick,
  onOpenInIDE,
  onSessionIdClick,
  agentName,
  agentAvatar,
  projectName,
  gitBranch,
  workingDirectory,
  thinkingModeResetKey,
  onUserQuestionAnswer,
  pendingQuestionIds,
  answeredQuestions,
  currentSessionId,
  showThinkingBlocks = true,
  onRewindFiles,
  onOpenImageTab,
  onOpenPersonality,
  pendingPlanApprovalIds,
  onPlanApprovalResponse,
  onTeammateDrillDown,
}: MessageListProps) {
  const listRef = useListRef(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevMessagesLengthRef = useRef(messages.length);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [showScrollToTopButton, setShowScrollToTopButton] = useState(false);

  // Use react-window v2's built-in dynamic row height measurement
  // This uses ResizeObserver to measure actual rendered heights and repositions rows automatically
  // Pass the entire hook result as rowHeight — List detects the object and uses observeRowElements internally
  const dynamicRowHeight = useDynamicRowHeight({
    defaultRowHeight: DEFAULT_MESSAGE_HEIGHT,
    key: currentSessionId || 'default',
  });

  // Find the last user message index
  const lastUserMessageIndex = messages.reduce(
    (lastIndex, msg, idx) => (msg.role === 'user' ? idx : lastIndex),
    -1,
  );

  // Check if user is at bottom of scroll
  const checkIfAtBottom = useCallback(() => {
    const el = listRef.current?.element;
    if (!el) return true;
    const { scrollTop, scrollHeight, clientHeight } = el;
    return scrollHeight - scrollTop - clientHeight < 100;
  }, [listRef]);

  // Handle scroll events
  const handleScroll = useCallback(() => {
    const isAtBottom = checkIfAtBottom();
    setShowScrollButton(!isAtBottom);
    const hasUserMessages = messages.some(m => m.role === 'user');
    setShowScrollToTopButton(!isAtBottom && hasUserMessages);
  }, [checkIfAtBottom, messages]);

  // Scroll to bottom function
  const scrollToBottom = useCallback(() => {
    if (!listRef.current) return;
    const rowCount = loading ? messages.length + 1 : messages.length;
    if (rowCount > 0) {
      listRef.current.scrollToRow({ index: rowCount - 1, align: 'end' });
    }
  }, [listRef, messages.length, loading]);

  // Navigate to previous user message
  const scrollToPreviousUserMessage = useCallback(() => {
    if (!listRef.current) return;
    const userIndices = messages
      .map((m, i) => ({ msg: m, index: i }))
      .filter(({ msg }) => msg.role === 'user')
      .map(({ index: i }) => i);

    if (userIndices.length === 0) return;

    const el = listRef.current.element;
    const currentScrollTop = el?.scrollTop || 0;
    let targetIndex = -1;

    for (let i = userIndices.length - 1; i >= 0; i--) {
      const messageIndex = userIndices[i];
      if (messageIndex * DEFAULT_MESSAGE_HEIGHT < currentScrollTop - 50) {
        targetIndex = messageIndex;
        break;
      }
    }

    if (targetIndex === -1) {
      targetIndex = userIndices[userIndices.length - 1];
    }

    listRef.current.scrollToRow({ index: targetIndex, align: 'start' });
  }, [listRef, messages]);

  // Brain: pattern-session-scroll-memory
  // Virtualized path: always scroll to bottom on session switch. Anchor UX is
  // provided by the non-virtualized MessageList (sessions <=100 messages).
  // Scroll-lock pattern: force scroll-to-bottom every frame/RO tick until the
  // user manually scrolls (wheel/touch/keyboard). Needed because
  // `useDynamicRowHeight` measures row heights as they render — initial
  // `scrollToRow` lands too high, then rows expand and push the target down.
  const appliedInitialScrollForSessionRef = useRef<string | null>(null);
  const scrollLockedRef = useRef(true);
  useEffect(() => {
    appliedInitialScrollForSessionRef.current = null;
    scrollLockedRef.current = true;
  }, [currentSessionId]);

  useEffect(() => {
    if (messages.length === 0) return;
    if (appliedInitialScrollForSessionRef.current === currentSessionId) return;

    let observer: ResizeObserver | null = null;
    let attachedEl: HTMLElement | null = null;
    const releaseLock = () => {
      if (scrollLockedRef.current) scrollLockedRef.current = false;
    };

    const apply = () => {
      if (!scrollLockedRef.current) return false;
      const list = listRef.current;
      if (!list) return false;
      const rowCount = loading ? messages.length + 1 : messages.length;
      if (rowCount > 0) {
        list.scrollToRow({ index: rowCount - 1, align: 'end' });
      }
      // Also force scrollTop = scrollHeight as belt-and-suspenders
      const el = list.element;
      if (el) {
        el.scrollTop = el.scrollHeight;
        // Attach RO + user-input listeners once the element is live
        if (attachedEl !== el) {
          observer?.disconnect();
          observer = new ResizeObserver(() => apply());
          observer.observe(el);
          const content = el.querySelector<HTMLElement>('[style*="height"]');
          if (content) observer.observe(content);
          el.addEventListener('wheel', releaseLock, { passive: true });
          el.addEventListener('touchstart', releaseLock, { passive: true });
          el.addEventListener('keydown', releaseLock);
          el.addEventListener('scroll', handleScroll, { passive: true });
          attachedEl = el;
        }
      }
      handleScroll();
      appliedInitialScrollForSessionRef.current = currentSessionId ?? null;
      return true;
    };

    apply();

    let frame = 0;
    let rafId = 0;
    const rafLoop = () => {
      apply();
      if (++frame < 60 && scrollLockedRef.current) rafId = requestAnimationFrame(rafLoop);
    };
    rafId = requestAnimationFrame(rafLoop);

    const stopId = window.setTimeout(() => {
      scrollLockedRef.current = false;
    }, 2000);
    prevMessagesLengthRef.current = messages.length;
    return () => {
      window.clearTimeout(stopId);
      cancelAnimationFrame(rafId);
      observer?.disconnect();
      if (attachedEl) {
        attachedEl.removeEventListener('wheel', releaseLock);
        attachedEl.removeEventListener('touchstart', releaseLock);
        attachedEl.removeEventListener('keydown', releaseLock);
        attachedEl.removeEventListener('scroll', handleScroll);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSessionId, messages.length > 0]);

  // Auto-scroll for new messages
  useEffect(() => {
    if (!listRef.current) return;
    const isAtBottom = checkIfAtBottom();
    const hasNewMessage = messages.length > prevMessagesLengthRef.current;
    const lastMessage = messages[messages.length - 1];

    let shouldAutoScroll = false;
    if (hasNewMessage) {
      shouldAutoScroll = lastMessage?.role === 'user' || isAtBottom;
    } else if (loading) {
      shouldAutoScroll = true;
    }

    if (shouldAutoScroll) scrollToBottom();
    prevMessagesLengthRef.current = messages.length;
  }, [messages, loading, checkIfAtBottom, scrollToBottom]);

  // Scroll listener for button visibility is attached inside the main
  // scroll-lock effect once listRef.current.element is live — see `apply()`.

  // Handle empty state
  if (messages.length === 0 && !loading) {
    return (
      <div className="message-list-empty">
        <div className="empty-state">
          <DuckAnimation />
        </div>
      </div>
    );
  }

  const rowCount = loading ? messages.length + 1 : messages.length;

  const rowProps: MessageRowProps = {
    messages,
    loading: !!loading,
    onFilePathClick,
    onOpenInIDE,
    onSessionIdClick,
    agentName,
    agentAvatar,
    projectName,
    gitBranch,
    workingDirectory,
    lastUserMessageIndex,
    thinkingModeResetKey,
    onUserQuestionAnswer,
    pendingQuestionIds,
    answeredQuestions,
    currentSessionId,
    showThinkingBlocks,
    onRewindFiles,
    onOpenImageTab,
    onOpenPersonality,
    pendingPlanApprovalIds,
    onPlanApprovalResponse,
    onTeammateDrillDown,
  };

  return (
    <div className="message-list" ref={containerRef}>
      <AutoSizer
        renderProp={({ height, width }: { height: number | undefined; width: number | undefined }) => {
          if (!height || !width) return null;
          return (
            <List<MessageRowProps>
              listRef={listRef}
              rowComponent={MessageRow}
              rowCount={rowCount}
              rowHeight={dynamicRowHeight}
              rowProps={rowProps}
              overscanCount={3}
              style={{ height, width }}
            />
          );
        }}
      />

      {showScrollButton && (
        <button
          className="scroll-to-bottom-button"
          onClick={scrollToBottom}
          aria-label="Scroll to bottom"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 14L5 9L6.5 7.5L10 11L13.5 7.5L15 9L10 14Z" fill="currentColor" />
          </svg>
        </button>
      )}

    </div>
  );
}

// Export with memo for performance
export default memo(MessageListVirtualized, (prevProps, nextProps) => {
  if (prevProps.messages.length !== nextProps.messages.length) return false;
  if (prevProps.loading !== nextProps.loading) return false;

  const prevLast = prevProps.messages[prevProps.messages.length - 1];
  const nextLast = nextProps.messages[nextProps.messages.length - 1];
  if (prevLast?.id !== nextLast?.id) return false;
  if (prevLast?.content !== nextLast?.content) return false;

  return true;
});
