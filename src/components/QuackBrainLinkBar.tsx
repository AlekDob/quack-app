import { useState, useEffect } from 'react';
import { openInEditor, getSettings } from '../services/obsidianSyncService';
import type { BrainSettings } from '../types/brainSync';
import './QuackBrainLinkBar.css';

interface QuackBrainLinkBarProps {
  /** Full path to the QuackBrain file (e.g., QuackBrain/projects/quack-app/bugs/bug-name.md) */
  filePath: string;
  /** Entity name for display */
  entityName?: string;
  /** Entity type for icon */
  entityType?: string;
  /** Callback when bar is dismissed */
  onDismiss?: () => void;
}

// Extract vault path from settings and combine with relative path
async function getFullObsidianPath(relativePath: string): Promise<string> {
  const settings = await getSettings();
  const vaultPath = settings.vaultPath || '/Users/alekdob/Desktop/Dev/brain';
  // If relativePath already starts with vault path, return as-is
  if (relativePath.startsWith(vaultPath)) {
    return relativePath;
  }
  // Otherwise, combine vault path with relative path
  return `${vaultPath}/${relativePath}`;
}

export default function QuackBrainLinkBar({
  filePath,
  entityName,
  entityType,
  onDismiss
}: QuackBrainLinkBarProps) {
  const [markdownEditor, setMarkdownEditor] = useState<BrainSettings['markdownEditor']>('obsidian');
  const [isOpening, setIsOpening] = useState(false);

  // Load markdown editor preference
  useEffect(() => {
    getSettings().then((settings) => {
      setMarkdownEditor(settings.markdownEditor);
    }).catch((err) => {
      console.error('[QuackBrainLinkBar] Failed to load markdown editor setting:', err);
    });
  }, []);

  // Extract display name from path
  const displayName = entityName || filePath.split('/').pop()?.replace('.md', '') || filePath;

  // Get entity type icon
  const getEntityIcon = () => {
    switch (entityType) {
      case 'bug':
      case 'bug_fix':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4" />
            <path d="M12 16h.01" />
          </svg>
        );
      case 'pattern':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        );
      case 'decision':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
        );
      default:
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
          </svg>
        );
    }
  };

  // Get editor display name
  const getEditorName = () => {
    switch (markdownEditor) {
      case 'obsidian': return 'Obsidian';
      case 'vscode': return 'VS Code';
      case 'cursor': return 'Cursor';
      default: return 'Editor';
    }
  };

  const handleOpenInObsidian = async () => {
    setIsOpening(true);
    try {
      const fullPath = await getFullObsidianPath(filePath);
      await openInEditor(fullPath, markdownEditor);
    } catch (error) {
      console.error('[QuackBrainLinkBar] Failed to open in editor:', error);
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <div className="quack-brain-link-bar">
      <div className="quack-brain-link-bar-header">
        <div className="quack-brain-link-bar-title">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="quack-brain-link-bar-brain-icon"
          >
            <path d="M12 2a9 9 0 0 0-9 9c0 3.1 1.6 5.8 4 7.4V21l3-2 3 2v-2.6c2.4-1.6 4-4.3 4-7.4a9 9 0 0 0-9-9z" />
            <path d="M9 10h.01" />
            <path d="M15 10h.01" />
            <path d="M9.5 15a3.5 3.5 0 0 0 5 0" />
          </svg>
          <span className="quack-brain-link-bar-label">Quack Brain</span>
          <span className="quack-brain-link-bar-separator">·</span>
          {getEntityIcon()}
          <span className="quack-brain-link-bar-entity-name">{displayName}</span>
        </div>
        <div className="quack-brain-link-bar-actions">
          <button
            className="quack-brain-link-bar-open-btn"
            onClick={handleOpenInObsidian}
            disabled={isOpening}
            title={`Open in ${getEditorName()}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            {isOpening ? 'Opening...' : getEditorName()}
          </button>
          {onDismiss && (
            <button
              className="quack-brain-link-bar-dismiss-btn"
              onClick={onDismiss}
              title="Dismiss"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
