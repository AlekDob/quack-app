import { useEffect, useRef, useState, useCallback, memo } from 'react';
import type { CSSProperties, ReactElement } from 'react';
import { List, useListRef } from 'react-window';
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

// Message height cache for virtualization
const messageHeightCache = new Map<string, number>();
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
  const rowHeights = useRef<Map<number, number>>(new Map());

  // Find the last user message index
  const lastUserMessageIndex = messages.reduce(
    (lastIndex, msg, idx) => (msg.role === 'user' ? idx : lastIndex),
    -1,
  );

  // Calculate item size for variable height list
  const getRowHeight = useCallback((index: number) => {
    const cachedHeight = rowHeights.current.get(index);
    if (cachedHeight) return cachedHeight;

    if (index < messages.length) {
      const messageId = messages[index].id;
      const cached = messageHeightCache.get(messageId);
      if (cached) {
        rowHeights.current.set(index, cached);
        return cached;
      }
    }

    if (index < messages.length) {
      const message = messages[index];
      let estimatedHeight = 80;
      const contentLength = message.content?.length || 0;
      estimatedHeight += Math.floor(contentLength / 100) * 20;
      if (message.toolCalls && message.toolCalls.length > 0) {
        estimatedHeight += message.toolCalls.length * 60;
      }
      estimatedHeight = Math.min(estimatedHeight, 800);
      rowHeights.current.set(index, estimatedHeight);
      return estimatedHeight;
    }

    return DEFAULT_MESSAGE_HEIGHT;
  }, [messages]);

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

  // Auto-scroll on mount
  useEffect(() => {
    if (!listRef.current || messages.length === 0) return;
    const timeoutId = setTimeout(() => scrollToBottom(), 100);
    prevMessagesLengthRef.current = messages.length;
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Attach scroll listener to list element for button visibility
  useEffect(() => {
    const el = listRef.current?.element;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [listRef, handleScroll]);

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
              rowHeight={getRowHeight}
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

      {showScrollToTopButton && (
        <button
          className="scroll-to-top-button"
          onClick={scrollToPreviousUserMessage}
          aria-label="Previous user message"
          title="Jump to previous 'You' message"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 6L5 11L6.5 12.5L10 9L13.5 12.5L15 11L10 6Z" fill="currentColor" />
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
