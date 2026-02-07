import { memo, useState, useRef, useEffect } from 'react';
import { Brain } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import KeyboardShortcutTooltip from './KeyboardShortcutTooltip';
import { useIDEStore } from '../stores/ideStore';
import './ActionIcons.css';

// Installed app from Rust backend
interface InstalledApp {
  id: string;
  name: string;
  app_path: string;
  category: 'ide' | 'terminal' | 'finder';
  icon_base64: string | null;
}

interface ActionIconsProps {
  projectPath?: string;
  onGitClick: () => void;
  onPluginsClick: () => void;
  onUsageClick: () => void;
  onTelegramClick: () => void;
  onTerminalClick: () => void;
  onBrowserClick: () => void;
  onDroidFactoryClick: () => void;
  onMemoryGraphClick?: () => void;
  onSecondBrainClick?: () => void;
  onGuideClick: () => void;
  onClaudeAssetsClick?: () => void;
  onToggleSidePanel: () => void;
  sidePanelCollapsed: boolean;
  terminalWindowOpen?: boolean;
  claudeAssetsOpen?: boolean;
  secondBrainOpen?: boolean;
  // Authentication status
  isAuthenticated?: boolean;
  onLoginClick?: () => void;
  // New Project
  onCreateProject?: () => void;
  creatingProject?: boolean;
  // Kanban
  onKanbanClick?: () => void;
  isKanbanActive?: boolean;
  inProgressTaskCount?: number;
  // Addons
  onAddonsClick?: () => void;
  isAddonsOpen?: boolean;
}

function ActionIcons({
  projectPath,
  onGitClick,
  onTerminalClick,
  onToggleSidePanel,
  sidePanelCollapsed,
  terminalWindowOpen = false,
  onSecondBrainClick,
  secondBrainOpen = false,
  onKanbanClick,
  isKanbanActive = false,
  inProgressTaskCount = 0,
  onAddonsClick,
  isAddonsOpen = false,
}: ActionIconsProps) {
  const [openMenuOpen, setOpenMenuOpen] = useState(false);
  const [installedApps, setInstalledApps] = useState<InstalledApp[]>([]);
  const [appsLoading, setAppsLoading] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);

  // IDE store
  const preferredIDE = useIDEStore((state) => state.preferredIDE);

  // Load installed apps on mount
  useEffect(() => {
    const loadApps = async () => {
      try {
        const apps = await invoke<InstalledApp[]>('get_installed_apps');
        setInstalledApps(apps);
      } catch (err) {
        console.error('Failed to load installed apps:', err);
      } finally {
        setAppsLoading(false);
      }
    };
    loadApps();
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuOpen(false);
      }
    };

    if (openMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuOpen]);

  const handleOpenInApp = async (appId: string) => {
    if (!projectPath) return;
    try {
      await invoke('open_in_app', { appId, path: projectPath });
      setOpenMenuOpen(false);
    } catch (err) {
      console.error('Failed to open:', err);
    }
  };

  const handleCopyPath = async () => {
    if (!projectPath) return;
    try {
      await navigator.clipboard.writeText(projectPath);
      setOpenMenuOpen(false);
    } catch (err) {
      console.error('Failed to copy path:', err);
    }
  };

  // Get apps by category
  const ides = installedApps.filter(app => app.category === 'ide');
  const terminals = installedApps.filter(app => app.category === 'terminal');
  const finder = installedApps.find(app => app.category === 'finder');

  // Sort IDEs - preferred first
  const sortedIDEs = [...ides].sort((a, b) => {
    if (a.id === preferredIDE) return -1;
    if (b.id === preferredIDE) return 1;
    return 0;
  });

  // Get the default IDE (preferred or first available)
  const defaultIDE = sortedIDEs.find(ide => ide.id === preferredIDE) || sortedIDEs[0];

  // App Icon component - uses base64 icon or fallback SVG
  const AppIcon = ({ app }: { app: InstalledApp }) => {
    if (app.icon_base64) {
      return (
        <img
          src={`data:image/png;base64,${app.icon_base64}`}
          alt={app.name}
          width="16"
          height="16"
          style={{ borderRadius: '3px' }}
        />
      );
    }

    // Fallback icons by app ID
    switch (app.id) {
      // VS Code family
      case 'vscode':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M17.5 2L9 10.5l-4-3.5L2 8.5v7l3 1.5 4-3.5 8.5 8.5 3.5-1.5V3.5L17.5 2zM6 14.5l-2-1v-3l2 1.5v2.5zm11-1l-5-4.5V5.5l5 2.5v5.5z" fill="#007ACC"/>
          </svg>
        );
      case 'cursor':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="18" height="18" rx="3" fill="#1a1a1a"/>
            <path d="M8 8l8 4-8 4V8z" fill="#fff"/>
          </svg>
        );
      case 'windsurf':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="18" height="18" rx="3" fill="#0ea5e9"/>
            <path d="M7 12h10M12 7v10" stroke="#fff" strokeWidth="2"/>
          </svg>
        );
      // JetBrains family
      case 'intellij':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="2" width="20" height="20" rx="2" fill="#000"/>
            <text x="5" y="16" fill="#fff" fontSize="10" fontWeight="bold">IJ</text>
          </svg>
        );
      case 'webstorm':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="2" width="20" height="20" rx="2" fill="#00CDD7"/>
            <text x="4" y="16" fill="#000" fontSize="9" fontWeight="bold">WS</text>
          </svg>
        );
      case 'phpstorm':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="2" width="20" height="20" rx="2" fill="#B345F1"/>
            <text x="4" y="16" fill="#fff" fontSize="9" fontWeight="bold">PS</text>
          </svg>
        );
      case 'pycharm':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="2" width="20" height="20" rx="2" fill="#21D789"/>
            <text x="4" y="16" fill="#000" fontSize="9" fontWeight="bold">Py</text>
          </svg>
        );
      case 'goland':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="2" width="20" height="20" rx="2" fill="#087CFA"/>
            <text x="4" y="16" fill="#fff" fontSize="9" fontWeight="bold">Go</text>
          </svg>
        );
      case 'rubymine':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="2" width="20" height="20" rx="2" fill="#FE2857"/>
            <text x="3" y="16" fill="#fff" fontSize="9" fontWeight="bold">RM</text>
          </svg>
        );
      // Terminals
      case 'windows-terminal':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="4" width="20" height="16" rx="2" fill="#0C0C0C"/>
            <path d="M6 9l4 3-4 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 15h6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        );
      case 'powershell':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="4" width="20" height="16" rx="2" fill="#012456"/>
            <path d="M6 9l4 3-4 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 15h6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        );
      case 'git-bash':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="4" width="20" height="16" rx="2" fill="#2D2D2D"/>
            <path d="M6 9l4 3-4 3" stroke="#F05033" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 15h6" stroke="#F05033" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        );
      // Explorer
      case 'explorer':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M3 7V5a2 2 0 012-2h4l2 2h8a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" fill="#FFC107"/>
            <path d="M3 7h18v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" fill="#FFE082"/>
          </svg>
        );
      // Zed
      case 'zed':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="2" width="20" height="20" rx="3" fill="#084CCF"/>
            <text x="6" y="16" fill="#fff" fontSize="11" fontWeight="bold">Z</text>
          </svg>
        );
      // Sublime
      case 'sublime':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="2" width="20" height="20" rx="2" fill="#FF9800"/>
            <text x="6" y="16" fill="#fff" fontSize="11" fontWeight="bold">S</text>
          </svg>
        );
      // Notepad++
      case 'notepadpp':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="2" width="20" height="20" rx="2" fill="#90BE6D"/>
            <text x="3" y="16" fill="#fff" fontSize="8" fontWeight="bold">N++</text>
          </svg>
        );
      default:
        // Generic fallback
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M8 21h8M12 17v4" />
          </svg>
        );
    }
  };

  return (
    <div className="action-icons action-icons-minimal" data-tauri-drag-region>
      {/* Spacer to push icons to the right */}
      <div className="action-icons-spacer" data-tauri-drag-region />

      {/* Right side - Action icons */}
      {/* Kanban Icon */}
      {onKanbanClick && (
        <KeyboardShortcutTooltip label="Kanban" shortcut="⌘K">
          <button
            type="button"
            className={`action-icon ${isKanbanActive ? 'active' : ''}`}
            onClick={onKanbanClick}
            aria-label="Open Kanban (⌘K)"
            style={{ position: 'relative' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="5" height="18" rx="1" />
              <rect x="10" y="3" width="5" height="12" rx="1" />
              <rect x="17" y="3" width="5" height="15" rx="1" />
            </svg>
            {/* Badge for in-progress tasks */}
            {inProgressTaskCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-2px',
                  right: '-2px',
                  background: '#f28c52',
                  color: '#fff',
                  fontSize: '8px',
                  fontWeight: 600,
                  padding: '1px 3px',
                  borderRadius: '6px',
                  minWidth: '12px',
                  textAlign: 'center',
                  lineHeight: '1.2',
                }}
              >
                {inProgressTaskCount}
              </span>
            )}
          </button>
        </KeyboardShortcutTooltip>
      )}

      {/* Git Icon */}
      <button
        type="button"
        className="action-icon"
        onClick={onGitClick}
        aria-label="Open Git panel"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M14.5 7.5L8.5 1.5L7.5 2.5L6.5 3.5L2.5 7.5C2 8 2 8.5 2 9C2 9.5 2 10 2.5 10.5L7.5 15.5L8.5 14.5L9.5 13.5L13.5 9.5C14 9 14 8.5 14 8C14 7.5 14 7 13.5 6.5M8 11C6.9 11 6 10.1 6 9C6 7.9 6.9 7 8 7C9.1 7 10 7.9 10 9C10 10.1 9.1 11 8 11Z"
            fill="currentColor"
          />
        </svg>
        <span className="action-icon-tooltip">Git Panel</span>
      </button>

      {/* Terminal Icon */}
      <KeyboardShortcutTooltip label="Terminal" shortcut="⌘T">
        <button
          type="button"
          className={`action-icon ${terminalWindowOpen ? 'active' : ''}`}
          onClick={onTerminalClick}
          aria-label="Open Terminals (⌘T)"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
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
        </button>
      </KeyboardShortcutTooltip>

      {/* Brain Icon */}
      {onSecondBrainClick && (
        <button
          type="button"
          className={`action-icon ${secondBrainOpen ? 'active' : ''}`}
          onClick={onSecondBrainClick}
          aria-label="Open Brain folder"
        >
          <Brain size={14} />
          <span className="action-icon-tooltip">Brain</span>
        </button>
      )}

      {/* Addons Icon */}
      {onAddonsClick && (
        <button
          type="button"
          className={`action-icon ${isAddonsOpen ? 'active' : ''}`}
          onClick={onAddonsClick}
          aria-label="Open Addons"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          <span className="action-icon-tooltip">Addons</span>
        </button>
      )}

      {/* Open Dropdown - Codex style with real app icons */}
      {projectPath && (
        <div className="open-dropdown-container" ref={menuRef}>
          {/* Main button - opens in default IDE */}
          <button
            type="button"
            className="open-dropdown-button open-main-button"
            onClick={() => defaultIDE && handleOpenInApp(defaultIDE.id)}
            aria-label={`Open in ${defaultIDE?.name || 'IDE'}`}
            disabled={!defaultIDE}
          >
            {defaultIDE?.icon_base64 ? (
              <img
                src={`data:image/png;base64,${defaultIDE.icon_base64}`}
                alt={defaultIDE.name}
                width="14"
                height="14"
                style={{ borderRadius: '2px' }}
              />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8" />
                <path d="M12 17v4" />
              </svg>
            )}
            <span>{defaultIDE?.name || 'Open'}</span>
          </button>
          {/* Chevron button - opens dropdown */}
          <button
            type="button"
            className={`open-dropdown-chevron ${openMenuOpen ? 'open' : ''}`}
            onClick={() => setOpenMenuOpen(!openMenuOpen)}
            aria-label="More open options"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="chevron">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {openMenuOpen && (
            <div className="open-dropdown-menu">
              <div className="open-dropdown-section-label">Open in</div>

              {/* Loading state */}
              {appsLoading && (
                <div className="open-dropdown-item loading">
                  <span style={{ opacity: 0.5 }}>Loading apps...</span>
                </div>
              )}

              {/* IDEs - sorted with preferred first */}
              {!appsLoading && sortedIDEs.map((ide) => (
                <button
                  key={ide.id}
                  type="button"
                  className="open-dropdown-item"
                  onClick={() => handleOpenInApp(ide.id)}
                >
                  <AppIcon app={ide} />
                  <span>{ide.name}</span>
                </button>
              ))}

              {/* Divider before Finder/Terminals */}
              {!appsLoading && (sortedIDEs.length > 0 && (finder || terminals.length > 0)) && (
                <div className="open-dropdown-divider" />
              )}

              {/* Finder */}
              {!appsLoading && finder && (
                <button
                  type="button"
                  className="open-dropdown-item"
                  onClick={() => handleOpenInApp(finder.id)}
                >
                  <AppIcon app={finder} />
                  <span>{finder.name}</span>
                </button>
              )}

              {/* Terminals */}
              {!appsLoading && terminals.map((term) => (
                <button
                  key={term.id}
                  type="button"
                  className="open-dropdown-item"
                  onClick={() => handleOpenInApp(term.id)}
                >
                  <AppIcon app={term} />
                  <span>{term.name}</span>
                </button>
              ))}

              <div className="open-dropdown-divider" />

              {/* Copy Path */}
              <button
                type="button"
                className="open-dropdown-item"
                onClick={handleCopyPath}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                <span>Copy Path</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Side Panel Toggle Icon - LAST */}
      <KeyboardShortcutTooltip label="Side Panel" shortcut="⌘B">
        <button
          type="button"
          className={`action-icon ${!sidePanelCollapsed ? 'active' : ''}`}
          onClick={onToggleSidePanel}
          aria-label={sidePanelCollapsed ? "Open side panel (⌘B)" : "Close side panel (⌘B)"}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
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
      </KeyboardShortcutTooltip>
    </div>
  );
}

export default memo(ActionIcons);
