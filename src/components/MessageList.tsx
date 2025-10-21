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
}

export default function MessageList({ messages, loading, onFilePathClick }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevMessagesLengthRef = useRef(messages.length);
  const prevFirstMessageIdRef = useRef<string | null>(messages[0]?.id ?? null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Check if user is at bottom of scroll
  const checkIfAtBottom = useCallback(() => {
    if (!scrollRef.current) return true;

    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    // Consider "at bottom" if within 100px from bottom
    return distanceFromBottom < 100;
  }, []);

  // Handle scroll events to show/hide scroll button
  const handleScroll = useCallback(() => {
    const isAtBottom = checkIfAtBottom();
    setShowScrollButton(!isAtBottom);
  }, [checkIfAtBottom]);

  // Scroll to bottom function
  const scrollToBottom = useCallback(() => {
    if (!scrollRef.current) return;

    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth'
    });
  }, []);

  // Scroll to bottom when switching to a different chat (first message ID changes)
  useEffect(() => {
    if (!scrollRef.current || messages.length === 0) return;

    const currentFirstMessageId = messages[0]?.id ?? null;
    const hasChangedChat = currentFirstMessageId !== prevFirstMessageIdRef.current;

    if (hasChangedChat && currentFirstMessageId !== null) {
      // Chat switched - scroll to bottom immediately
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'instant' // Instant scroll when switching chats
      });
      prevFirstMessageIdRef.current = currentFirstMessageId;
    }
  }, [messages]);

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
    } else if (loading && isAtBottom) {
      // During streaming, keep scrolling if user is at bottom
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

  return (
    <div className="message-list" ref={scrollRef} onScroll={handleScroll}>
      <div className="message-list-content">
        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            message={message}
            onFilePathClick={onFilePathClick}
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
    </div>
  );
}
