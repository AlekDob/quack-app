import { useEffect, useRef, useState, useCallback, memo } from 'react';
import type { CSSProperties } from 'react';
// @ts-ignore - react-window types issue
import { VariableSizeList } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import ChatMessage from './ChatMessage';
import SkeletonMessage from './SkeletonMessage';
import DuckAnimation from './DuckAnimation';
import type { ChatMessage as ChatMessageType } from '../types';
import './MessageList.css';

interface MessageListProps {
  messages: ChatMessageType[];
  loading?: boolean;
  onFilePathClick?: (path: string) => void;
  agentName?: string;
  agentAvatar?: string;
  projectName?: string;
  gitBranch?: string;
  workingDirectory?: string;
}

// Message height cache for virtualization
const messageHeightCache = new Map<string, number>();
const DEFAULT_MESSAGE_HEIGHT = 120; // Estimated default height

// Memoized message row component
const MessageRow = memo(({
  index,
  style,
  data
}: {
  index: number;
  style: CSSProperties;
  data: {
    messages: ChatMessageType[];
    loading: boolean;
    onFilePathClick?: (path: string) => void;
    agentName?: string;
    agentAvatar?: string;
    projectName?: string;
    gitBranch?: string;
    workingDirectory?: string;
    lastUserMessageIndex: number;
  }
}) => {
  const {
    messages,
    loading,
    onFilePathClick,
    agentName,
    agentAvatar,
    projectName,
    gitBranch,
    workingDirectory,
    lastUserMessageIndex
  } = data;

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

  return (
    <div style={style}>
      <ChatMessage
        message={message}
        onFilePathClick={onFilePathClick}
        agentName={agentName}
        agentAvatar={agentAvatar}
        projectName={projectName}
        gitBranch={gitBranch}
        isLastUserMessage={index === lastUserMessageIndex}
        workingDirectory={workingDirectory}
      />
    </div>
  );
});

MessageRow.displayName = 'MessageRow';

function MessageListVirtualized({
  messages,
  loading,
  onFilePathClick,
  agentName,
  agentAvatar,
  projectName,
  gitBranch,
  workingDirectory
}: MessageListProps) {
  const listRef = useRef<VariableSizeList>(null);
  const outerRef = useRef<HTMLElement>(null);
  const prevMessagesLengthRef = useRef(messages.length);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [showScrollToTopButton, setShowScrollToTopButton] = useState(false);
  const rowHeights = useRef<Map<number, number>>(new Map());

  // Find the last user message index
  const lastUserMessageIndex = messages.reduce((lastIndex, msg, index) => {
    return msg.role === 'user' ? index : lastIndex;
  }, -1);

  // Calculate item size for variable height list
  const getItemSize = useCallback((index: number) => {
    // Use cached height if available
    const cachedHeight = rowHeights.current.get(index);
    if (cachedHeight) return cachedHeight;

    // Use message-specific cache if available
    if (index < messages.length) {
      const messageId = messages[index].id;
      const cached = messageHeightCache.get(messageId);
      if (cached) {
        rowHeights.current.set(index, cached);
        return cached;
      }
    }

    // Estimate based on message type and content
    if (index < messages.length) {
      const message = messages[index];
      let estimatedHeight = 80; // Base height

      // Add height based on content length
      const contentLength = message.content?.length || 0;
      estimatedHeight += Math.floor(contentLength / 100) * 20;

      // Add height for tool usage
      if (message.toolCalls && message.toolCalls.length > 0) {
        estimatedHeight += message.toolCalls.length * 60;
      }

      // Cap at reasonable max
      estimatedHeight = Math.min(estimatedHeight, 800);

      rowHeights.current.set(index, estimatedHeight);
      return estimatedHeight;
    }

    return DEFAULT_MESSAGE_HEIGHT;
  }, [messages]);

  // Set item size after render
  const setItemSize = useCallback((index: number, size: number) => {
    if (rowHeights.current.get(index) !== size) {
      rowHeights.current.set(index, size);

      // Cache by message ID for persistence
      if (index < messages.length) {
        messageHeightCache.set(messages[index].id, size);
      }

      // Reset the cached positions in the list
      if (listRef.current) {
        listRef.current.resetAfterIndex(index);
      }
    }
  }, [messages]);

  // Check if user is at bottom of scroll
  const checkIfAtBottom = useCallback(() => {
    if (!outerRef.current) return true;

    const { scrollTop, scrollHeight, clientHeight } = outerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    // Consider "at bottom" if within 100px from bottom
    return distanceFromBottom < 100;
  }, []);

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

    const itemCount = loading ? messages.length + 1 : messages.length;
    if (itemCount > 0) {
      listRef.current.scrollToItem(itemCount - 1, 'end');
    }
  }, [messages.length, loading]);

  // Navigate to previous user message
  const scrollToPreviousUserMessage = useCallback(() => {
    if (!listRef.current) return;

    const userMessageIndices = messages
      .map((m, i) => ({ msg: m, index: i }))
      .filter(({ msg }) => msg.role === 'user')
      .map(({ index }) => index);

    if (userMessageIndices.length === 0) return;

    // Find current position
    const currentScrollTop = outerRef.current?.scrollTop || 0;
    let targetIndex = -1;

    // Find the previous user message above current position
    for (let i = userMessageIndices.length - 1; i >= 0; i--) {
      const messageIndex = userMessageIndices[i];
      // Simple heuristic: if we're past this message index * average height
      if (messageIndex * DEFAULT_MESSAGE_HEIGHT < currentScrollTop - 50) {
        targetIndex = messageIndex;
        break;
      }
    }

    // If no message found above, wrap to last
    if (targetIndex === -1) {
      targetIndex = userMessageIndices[userMessageIndices.length - 1];
    }

    listRef.current.scrollToItem(targetIndex, 'start');
  }, [messages]);

  // Auto-scroll on mount
  useEffect(() => {
    if (!listRef.current || messages.length === 0) return;

    const timeoutId = setTimeout(() => {
      scrollToBottom();
    }, 100);

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

    if (shouldAutoScroll) {
      scrollToBottom();
    }

    prevMessagesLengthRef.current = messages.length;
  }, [messages, loading, checkIfAtBottom, scrollToBottom]);

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

  // Item count includes loading skeleton if loading
  const itemCount = loading ? messages.length + 1 : messages.length;

  // Data passed to row renderer
  const itemData = {
    messages,
    loading,
    onFilePathClick,
    agentName,
    agentAvatar,
    projectName,
    gitBranch,
    workingDirectory,
    lastUserMessageIndex
  };

  return (
    <div className="message-list">
      <AutoSizer>
        {({ height, width }) => (
          <VariableSizeList
            ref={listRef}
            outerRef={outerRef}
            height={height}
            itemCount={itemCount}
            itemSize={getItemSize}
            width={width}
            itemData={itemData}
            onScroll={handleScroll}
            overscanCount={3}
            estimatedItemSize={DEFAULT_MESSAGE_HEIGHT}
          >
            {MessageRow}
          </VariableSizeList>
        )}
      </AutoSizer>

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

      {showScrollToTopButton && (
        <button
          className="scroll-to-top-button"
          onClick={scrollToPreviousUserMessage}
          aria-label="Previous user message"
          title="Jump to previous 'You' message"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M10 6L5 11L6.5 12.5L10 9L13.5 12.5L15 11L10 6Z"
              fill="currentColor"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

// Export with memo for performance
export default memo(MessageListVirtualized, (prevProps, nextProps) => {
  // Custom comparison for performance
  if (prevProps.messages.length !== nextProps.messages.length) return false;
  if (prevProps.loading !== nextProps.loading) return false;

  // Check if last message changed (for streaming)
  const prevLast = prevProps.messages[prevProps.messages.length - 1];
  const nextLast = nextProps.messages[nextProps.messages.length - 1];

  if (prevLast?.id !== nextLast?.id) return false;
  if (prevLast?.content !== nextLast?.content) return false;

  // Props are effectively the same
  return true;
});