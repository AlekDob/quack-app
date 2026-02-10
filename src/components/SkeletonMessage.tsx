import './SkeletonMessage.css';

export default function SkeletonMessage() {
  return (
    <div className="skeleton-message-minimal">
      <div className="skeleton-typing-indicator">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
