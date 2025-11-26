import { memo } from 'react';
import { Wrench } from 'lucide-react';
import './ActionIcons.css';

interface ActionIconsProps {
  projectPath?: string;
  onGitClick: () => void;
  onPluginsClick: () => void;
  onUsageClick: () => void;
  onTelegramClick: () => void;
  onTerminalClick: () => void;
  onBrowserClick: () => void;
  onDroidFactoryClick: () => void;
  onGuideClick: () => void;
  onToggleSidePanel: () => void;
  sidePanelCollapsed: boolean;
}

function ActionIcons({
  projectPath,
  onGitClick,
  onPluginsClick,
  onUsageClick,
  onTelegramClick,
  onTerminalClick,
  onBrowserClick,
  onDroidFactoryClick,
  onGuideClick,
  onToggleSidePanel,
  sidePanelCollapsed,
}: ActionIconsProps) {
  // Extract project name from path
  const projectName = projectPath ? projectPath.split('/').filter(Boolean).pop() : '';

  return (
    <div className="action-icons">
      {/* Project Name */}
      {projectName && (
        <span className="project-name">{projectName}</span>
      )}
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

      {/* Marketplace Icon */}
      <button
        type="button"
        className="action-icon"
        onClick={onPluginsClick}
        aria-label="Open Marketplace"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M8 1L3 4V7C3 10.5 5.5 13.7 8 14.5C10.5 13.7 13 10.5 13 7V4L8 1ZM8 7.5C7.2 7.5 6.5 6.8 6.5 6C6.5 5.2 7.2 4.5 8 4.5C8.8 4.5 9.5 5.2 9.5 6C9.5 6.8 8.8 7.5 8 7.5Z"
            fill="currentColor"
          />
        </svg>
        <span className="action-icon-tooltip">Marketplace</span>
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

      {/* Terminal Icon */}
      <button
        type="button"
        className="action-icon"
        onClick={onTerminalClick}
        aria-label="Open Terminals"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect
            x="1"
            y="2"
            width="14"
            height="12"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.2"
            fill="none"
          />
          <path
            d="M3.5 6L6 8L3.5 10"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M7.5 10H10.5"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
        <span className="action-icon-tooltip">Terminals</span>
      </button>

      {/* Browser Icon */}
      <button
        type="button"
        className="action-icon"
        onClick={onBrowserClick}
        aria-label="Open Browser"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle
            cx="8"
            cy="8"
            r="6"
            stroke="currentColor"
            strokeWidth="1.2"
            fill="none"
          />
          <path
            d="M8 2C6 2 4 4 4 8C4 12 6 14 8 14"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M8 2C10 2 12 4 12 8C12 12 10 14 8 14"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M2 8H14"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
        <span className="action-icon-tooltip">Browser</span>
      </button>

      {/* Droid Factory Icon */}
      <button
        type="button"
        className="action-icon"
        onClick={onDroidFactoryClick}
        aria-label="Open Droid Factory"
      >
        <Wrench className="w-4 h-4" />
        <span className="action-icon-tooltip">Droid Factory</span>
      </button>

      {/* Guide/Documentation Icon */}
      <button
        type="button"
        className="action-icon"
        onClick={onGuideClick}
        aria-label="Open Documentation"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M3.5 2C3.22 2 3 2.22 3 2.5V13.5C3 13.78 3.22 14 3.5 14H12.5C12.78 14 13 13.78 13 13.5V5L10 2H3.5Z"
            stroke="currentColor"
            strokeWidth="1.2"
            fill="none"
          />
          <path
            d="M10 2V5H13"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <path
            d="M5.5 8H10.5"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <path
            d="M5.5 10.5H10.5"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
        <span className="action-icon-tooltip">Documentation</span>
      </button>

      {/* Side Panel Toggle Icon */}
      <button
        type="button"
        className={`action-icon ${!sidePanelCollapsed ? 'active' : ''}`}
        onClick={onToggleSidePanel}
        aria-label={sidePanelCollapsed ? "Open side panel" : "Close side panel"}
        data-tooltip={sidePanelCollapsed ? "Open Side Panel" : "Close Side Panel"}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect
            x="2"
            y="2"
            width="12"
            height="12"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.2"
            fill="none"
          />
          <path
            d="M10 2V14"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}

export default memo(ActionIcons);
