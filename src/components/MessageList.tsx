import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import ChatMessage from './ChatMessage';
import SkeletonMessage from './SkeletonMessage';
import DuckAnimation from './DuckAnimation';
import type { ChatMessage as ChatMessageType, AskUserQuestionAnswers } from '../types';
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
}

export default function MessageList({ messages, loading, onFilePathClick, onOpenInIDE, onSessionIdClick, agentName, agentAvatar, projectName, gitBranch, workingDirectory, thinkingModeResetKey, onUserQuestionAnswer, pendingQuestionIds, answeredQuestions, currentSessionId, showThinkingBlocks = true, onRewindFiles, onOpenImageTab }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevMessagesLengthRef = useRef(messages.length);
  const prevFirstMessageIdRef = useRef<string | null>(messages[0]?.id ?? null);
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

  // Handle scroll events to show/hide scroll buttons
  const handleScroll = useCallback(() => {
    const isAtBottom = checkIfAtBottom();
    setShowScrollButton(!isAtBottom);

    // Show "scroll to top" (previous user message) button when:
    // 1. Not at bottom (scrolled up in conversation)
    // 2. There are user messages to navigate to
    const hasUserMessages = messages.some(m => m.role === 'user');
    setShowScrollToTopButton(!isAtBottom && hasUserMessages);
  }, [checkIfAtBottom, messages]);

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

  // Scroll to bottom when component first mounts (when switching chat)
  // This is triggered when ChatView's key changes and creates a new MessageList instance
  useEffect(() => {
    if (!scrollRef.current || messages.length === 0) return;

    // Wait for DOM to finish rendering, then scroll to bottom
    // Using 100ms delay to ensure all messages are mounted
    const timeoutId = setTimeout(() => {
      if (scrollRef.current) {
        const scrollHeight = scrollRef.current.scrollHeight;
        const clientHeight = scrollRef.current.clientHeight;

        scrollRef.current.scrollTo({
          top: scrollHeight,
          behavior: 'smooth' // Smooth scroll animation when switching chats
        });

        // console.log('[MessageList] Component mounted - scrollHeight:', scrollHeight, 'clientHeight:', clientHeight, 'scrolling to:', scrollHeight); // Performance: Disabled
      }
    }, 100);

    // Initialize refs
    prevFirstMessageIdRef.current = messages[0]?.id ?? null;
    prevMessagesLengthRef.current = messages.length;

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array = run only once on mount

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
      // Always auto-scroll for user messages or if already at bottom
      shouldAutoScroll = lastMessage?.role === 'user' || isAtBottom;
    } else if (loading) {
      // During streaming, ALWAYS scroll to keep up with new content
      // This ensures we see Claude's response as it types
      shouldAutoScroll = true;
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

  // Find the last user message
  const lastUserMessageIndex = messages.reduce((lastIndex, msg, index) => {
    return msg.role === 'user' ? index : lastIndex;
  }, -1);


  if (messages.length === 0 && !loading) {
    return (
      <div className="message-list-empty">
        <div className="empty-state">
          <DuckAnimation />
        </div>
      </div>
    );
  }

  return (
    <div className="message-list" ref={scrollRef} onScroll={handleScroll}>
      <div className="message-list-content">
        {messages.map((message, index) => (
            <div key={message.id} className="message-wrapper">
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
              />
            </div>
        ))}
        {loading && <SkeletonMessage />}
      </div>
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
