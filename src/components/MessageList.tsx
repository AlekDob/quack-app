import { useEffect, useRef } from 'react';
import ChatMessage from './ChatMessage';
import SkeletonMessage from './SkeletonMessage';
import DuckAnimation from './DuckAnimation';
import type { ChatMessage as ChatMessageType } from '../types';
import type { PermissionMode } from '../hooks/useClaudeChat';
import './MessageList.css';

interface MessageListProps {
  messages: ChatMessageType[];
  loading?: boolean;
  onPermissionModeChange?: (mode: PermissionMode) => void;
}

export default function MessageList({ messages, loading, onPermissionModeChange }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevMessagesLengthRef = useRef(messages.length);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > prevMessagesLengthRef.current && scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages.length]);

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
    <div className="message-list" ref={scrollRef}>
      <div className="message-list-content">
        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            message={message}
            onPermissionModeChange={onPermissionModeChange}
          />
        ))}
        {loading && <SkeletonMessage />}
      </div>
    </div>
  );
}
