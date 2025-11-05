import { useEffect, useRef, useState, useCallback } from 'react';
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
}

export default function MessageList({ messages, loading, onFilePathClick, agentName, agentAvatar, projectName, gitBranch }: MessageListProps) {
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

    // Show "scroll to top" button only when at bottom AND there are user messages
    const hasUserMessages = messages.some(m => m.role === 'user');
    setShowScrollToTopButton(isAtBottom && hasUserMessages);
  }, [checkIfAtBottom, messages]);

  // Scroll to bottom function
  const scrollToBottom = useCallback(() => {
    if (!scrollRef.current) return;

    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth'
    });
  }, []);

  // Scroll to last user message function
  const scrollToLastUserMessage = useCallback(() => {
    if (!scrollRef.current) return;

    // Find the last user message
    const lastUserMessageIndex = messages.map((m, i) => ({ msg: m, index: i }))
      .reverse()
      .find(({ msg }) => msg.role === 'user')?.index;

    if (lastUserMessageIndex === undefined) return;

    // Find the DOM element for that message
    const messageElements = scrollRef.current.querySelectorAll('.chat-message');
    const targetElement = messageElements[lastUserMessageIndex] as HTMLElement;

    if (targetElement) {
      // Scroll to the top of the user message
      const elementTop = targetElement.offsetTop;
      const targetScroll = elementTop - 20; // 20px padding from top

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

        console.log('[MessageList] Component mounted - scrollHeight:', scrollHeight, 'clientHeight:', clientHeight, 'scrolling to:', scrollHeight);
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

    // Determine if we should auto-scroll
    let shouldAutoScroll = false;

    if (hasNewMessage) {
      // Always auto-scroll for user messages or if already at bottom
      shouldAutoScroll = lastMessage?.role === 'user' || isAtBottom;
    } else if (loading) {
      // During streaming, ALWAYS scroll to keep up with new content
      // This ensures we see Claude's response as it types
      shouldAutoScroll = true;
    }

    if (shouldAutoScroll) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }

    prevMessagesLengthRef.current = messages.length;
  }, [messages, loading, checkIfAtBottom]);

  if (messages.length === 0 && !loading) {
    return (
      <div className="message-list-empty">
        <div className="empty-state">
          <DuckAnimation />
        </div>
      </div>
    );
  }

  // Find the last user message
  const lastUserMessageIndex = messages.reduce((lastIndex, msg, index) => {
    return msg.role === 'user' ? index : lastIndex;
  }, -1);

  return (
    <div className="message-list" ref={scrollRef} onScroll={handleScroll}>
      <div className="message-list-content">
        {messages.map((message, index) => (
          <ChatMessage
            key={message.id}
            message={message}
            onFilePathClick={onFilePathClick}
            agentName={agentName}
            agentAvatar={agentAvatar}
            projectName={projectName}
            gitBranch={gitBranch}
            isLastUserMessage={index === lastUserMessageIndex}
          />
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
          onClick={scrollToLastUserMessage}
          aria-label="Scroll to last message"
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
