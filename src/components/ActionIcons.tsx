import { memo } from 'react';
import './ActionIcons.css';

interface ActionIconsProps {
  onGitClick: () => void;
  onPluginsClick: () => void;
  onPreviewClick: () => void;
  onUsageClick: () => void;
  onTelegramClick: () => void;
}

function ActionIcons({
  onGitClick,
  onPluginsClick,
  onPreviewClick,
  onUsageClick,
  onTelegramClick,
}: ActionIconsProps) {
  return (
    <div className="action-icons">
      {/* Git Icon */}
      <button
        type="button"
        className="action-icon"
        onClick={onGitClick}
        aria-label="Open Git panel"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M14.5 7.5L8.5 1.5L7.5 2.5L6.5 3.5L2.5 7.5C2 8 2 8.5 2 9C2 9.5 2 10 2.5 10.5L7.5 15.5L8.5 14.5L9.5 13.5L13.5 9.5C14 9 14 8.5 14 8C14 7.5 14 7 13.5 6.5M8 11C6.9 11 6 10.1 6 9C6 7.9 6.9 7 8 7C9.1 7 10 7.9 10 9C10 10.1 9.1 11 8 11Z"
            fill="currentColor"
          />
        </svg>
        <span className="action-icon-tooltip">Git Panel</span>
      </button>

      {/* Plugins Icon */}
      <button
        type="button"
        className="action-icon"
        onClick={onPluginsClick}
        aria-label="Open Agents & Plugins panel"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M8 1L3 4V7C3 10.5 5.5 13.7 8 14.5C10.5 13.7 13 10.5 13 7V4L8 1ZM8 7.5C7.2 7.5 6.5 6.8 6.5 6C6.5 5.2 7.2 4.5 8 4.5C8.8 4.5 9.5 5.2 9.5 6C9.5 6.8 8.8 7.5 8 7.5Z"
            fill="currentColor"
          />
        </svg>
        <span className="action-icon-tooltip">Agents & Plugins</span>
      </button>

      {/* Preview Icon */}
      <button
        type="button"
        className="action-icon"
        onClick={onPreviewClick}
        aria-label="Open Preview panel"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M8 4C4.5 4 1.7 6.3 1 9C1.7 11.7 4.5 14 8 14C11.5 14 14.3 11.7 15 9C14.3 6.3 11.5 4 8 4ZM8 12C6.3 12 5 10.7 5 9C5 7.3 6.3 6 8 6C9.7 6 11 7.3 11 9C11 10.7 9.7 12 8 12ZM8 7.5C7.2 7.5 6.5 8.2 6.5 9C6.5 9.8 7.2 10.5 8 10.5C8.8 10.5 9.5 9.8 9.5 9C9.5 8.2 8.8 7.5 8 7.5Z"
            fill="currentColor"
          />
        </svg>
        <span className="action-icon-tooltip">Preview Panel</span>
      </button>

      {/* Usage Icon */}
      <button
        type="button"
        className="action-icon"
        onClick={onUsageClick}
        aria-label="Open Cost & Usage panel"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
        <span className="action-icon-tooltip">Cost & Usage</span>
      </button>

      {/* Telegram Icon */}
      <button
        type="button"
        className="action-icon"
        onClick={onTelegramClick}
        aria-label="Open Telegram"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M14.5 1.5L1 6.5L5 8.5L12 4L7 10L11 12L14.5 1.5Z"
            fill="currentColor"
          />
          <path
            d="M7 10V14L9 12"
            fill="currentColor"
          />
        </svg>
        <span className="action-icon-tooltip">Telegram</span>
      </button>
    </div>
  );
}

export default memo(ActionIcons);
