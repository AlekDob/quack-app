import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import MarkdownText from './MarkdownText';
import './PlanWidget.css';

interface PlanWidgetProps {
  plan: string;
  defaultExpanded?: boolean;
  workingDirectory?: string; // Current working directory of the agent
}

const PlanWidget: React.FC<PlanWidgetProps> = ({ plan, defaultExpanded = true, workingDirectory }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isCopied, setIsCopied] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [savedFilePath, setSavedFilePath] = useState<string | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(plan);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy plan:', err);
    }
  };

  const handleSaveToFile = async () => {
    try {
      console.log('[PlanWidget] Saving plan to file...');
      console.log('[PlanWidget] Working directory:', workingDirectory);

      // Normalize title for filename (remove special chars, replace spaces with dashes)
      const normalizedTitle = planTitle
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();

      console.log('[PlanWidget] Normalized title:', normalizedTitle);

      // Get today's date in YYYY-MM-DD format
      const today = new Date().toISOString().split('T')[0];
      const filename = `${normalizedTitle}-${today}.md`;

      console.log('[PlanWidget] Filename:', filename);

      // Use working directory if available, otherwise current working directory from agent
      // If no workingDirectory is provided, the planning folder will be created relative to CWD
      const planningDir = workingDirectory ? `${workingDirectory}/planning` : 'planning';

      console.log('[PlanWidget] Planning directory:', planningDir);

      // Create planning directory if it doesn't exist
      await invoke('create_directory', { path: planningDir });

      console.log('[PlanWidget] Directory created successfully');

      // Write plan to file
      const filepath = `${planningDir}/${filename}`;
      await invoke('write_file_content', { path: filepath, content: plan });

      console.log('[PlanWidget] File written successfully:', filepath);

      setSavedFilePath(filepath);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch (err) {
      console.error('[PlanWidget] Failed to save plan to file:', err);
      alert(`Failed to save plan: ${err}`);
    }
  };

  const handleOpenFile = async () => {
    if (!savedFilePath) return;

    try {
      console.log('[PlanWidget] Opening file:', savedFilePath);
      await invoke('open_file_in_editor', { path: savedFilePath });
    } catch (err) {
      console.error('[PlanWidget] Failed to open file:', err);
      alert(`Failed to open file: ${err}`);
    }
  };

  // Extract title from plan (first line starting with ##)
  const planTitle = plan.match(/^##\s+(.+)$/m)?.[1] || 'Implementation Plan';

  return (
    <div className="plan-widget">
      <div className="plan-widget-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="plan-widget-title">
          <svg
            className="plan-widget-icon"
            width="20"
            height="20"
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v12.5A1.75 1.75 0 0114.25 16H1.75A1.75 1.75 0 010 14.25V1.75zm1.75-.25a.25.25 0 00-.25.25v12.5c0 .138.112.25.25.25h12.5a.25.25 0 00.25-.25V1.75a.25.25 0 00-.25-.25H1.75zM3.5 6.75A.75.75 0 014.25 6h7a.75.75 0 010 1.5h-7a.75.75 0 01-.75-.75zm.75 2.25a.75.75 0 000 1.5h4a.75.75 0 000-1.5h-4z"/>
          </svg>
          <span className="plan-title-text">{planTitle}</span>
          <span className="plan-widget-badge">Plan Mode</span>
        </div>
        <div className="plan-widget-actions">
          {/* Open file button (only shown after saving) */}
          {savedFilePath && (
            <button
              className="plan-widget-copy-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenFile();
              }}
              title="Open saved plan file"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M1.75 2.5a.25.25 0 00-.25.25v10.5c0 .138.112.25.25.25h12.5a.25.25 0 00.25-.25V5.664a.25.25 0 00-.073-.177l-2.914-2.914a.25.25 0 00-.177-.073H1.75zM0 2.75C0 1.784.784 1 1.75 1h8.836c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v8.586A1.75 1.75 0 0113.5 16h-11A1.75 1.75 0 010 14.25V2.75z"/>
                <path d="M5.5 5.75a.75.75 0 01.75-.75h4a.75.75 0 010 1.5h-4a.75.75 0 01-.75-.75zm0 2.5a.75.75 0 01.75-.75h4a.75.75 0 010 1.5h-4a.75.75 0 01-.75-.75zm0 2.5a.75.75 0 01.75-.75h4a.75.75 0 010 1.5h-4a.75.75 0 01-.75-.75z"/>
              </svg>
            </button>
          )}

          {/* Save to file button */}
          <button
            className="plan-widget-copy-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleSaveToFile();
            }}
            title="Save plan to file (planning/*.md)"
          >
            {isSaved ? (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0113.25 16h-9.5A1.75 1.75 0 012 14.25V1.75zm1.75-.25a.25.25 0 00-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 00.25-.25V4.664a.25.25 0 00-.073-.177l-2.914-2.914a.25.25 0 00-.177-.073H3.75z"/>
                <path d="M4.75 7.5a.75.75 0 01.75-.75h5a.75.75 0 010 1.5h-5a.75.75 0 01-.75-.75zm0 2a.75.75 0 01.75-.75h5a.75.75 0 010 1.5h-5a.75.75 0 01-.75-.75zm0 2a.75.75 0 01.75-.75h2a.75.75 0 010 1.5h-2a.75.75 0 01-.75-.75z"/>
              </svg>
            )}
          </button>

          {/* Copy to clipboard button */}
          <button
            className="plan-widget-copy-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleCopy();
            }}
            title="Copy plan to clipboard"
          >
            {isCopied ? (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z"/>
                <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z"/>
              </svg>
            )}
          </button>

          {/* Expand/collapse chevron */}
          <svg
            className={`plan-widget-chevron ${isExpanded ? 'expanded' : ''}`}
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path d="M12.78 6.22a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06 0L3.22 7.28a.75.75 0 011.06-1.06L8 9.94l3.72-3.72a.75.75 0 011.06 0z"/>
          </svg>
        </div>
      </div>

      {isExpanded && (
        <div className="plan-widget-content">
          <div className="plan-widget-markdown">
            <MarkdownText>{plan}</MarkdownText>
          </div>

          <div className="plan-widget-footer">
            <div className="plan-widget-info">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0a8 8 0 110 16A8 8 0 018 0zM1.5 8a6.5 6.5 0 1113 0 6.5 6.5 0 01-13 0z"/>
                <path d="M8 4a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 018 4zm0 8a1 1 0 100-2 1 1 0 000 2z"/>
              </svg>
              <span>Review the plan above and respond to proceed</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanWidget;
