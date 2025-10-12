import './SkeletonMessage.css';

export default function SkeletonMessage() {
  return (
    <div className="chat-message assistant skeleton-message">
      <div className="chat-message-avatar">
        <div className="avatar-icon assistant-avatar skeleton-avatar">🦆</div>
      </div>
      <div className="chat-message-content">
        <div className="chat-message-header">
          <span className="skeleton-text skeleton-role"></span>
          <span className="skeleton-text skeleton-timestamp"></span>
        </div>
        <div className="chat-message-body skeleton-body">
          <div className="skeleton-loading-text">
            Quack Agency is working with Claude Code, hold on...
          </div>
        </div>
      </div>
    </div>
  );
}
