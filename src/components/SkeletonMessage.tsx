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
          <div className="skeleton-line skeleton-line-long"></div>
          <div className="skeleton-line skeleton-line-medium"></div>
          <div className="skeleton-line skeleton-line-short"></div>
        </div>
      </div>
    </div>
  );
}
