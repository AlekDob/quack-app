import { useState, useRef } from 'react';
import ChatSettingsMenu from '../ChatSettingsMenu';
import ComposePopover from './ComposePopover';
import SessionPopover from './SessionPopover';
import { QuickLoopPopover } from '../loop/QuickLoopPopover';
import { QuickLoopIndicator } from '../loop/QuickLoopIndicator';
import KeyboardShortcutTooltip from '../KeyboardShortcutTooltip';
import type { QuickLoopStatus } from '../../hooks/useQuickLoop';
import type { ThinkingMode, PermissionMode } from '../../hooks/useClaudeChat';
import type { EffortLevel } from '../../types';
import './UnifiedActionBar.css';

interface QuickLoopProps {
  status: QuickLoopStatus;
  currentRun: number;
  prompt: string;
  startLoop: (config: { prompt: string; intervalMs: number; maxRuns?: number }) => void;
  stopLoop: () => void;
}

interface SettingsProps {
  model: string;
  thinkingMode: ThinkingMode;
  permissionMode: PermissionMode;
  effort: EffortLevel;
  onModelChange: (m: string) => void;
  onThinkingModeChange: (mode: ThinkingMode) => void;
  onPermissionModeChange: (mode: PermissionMode) => void;
  onEffortChange: (e: EffortLevel) => void;
  disabled: boolean;
}

export interface UnifiedActionBarProps {
  // Settings
  settingsProps: SettingsProps;
  // Attach
  onAttach: () => void;
  attachShortcut?: string;
  // Compose actions
  onOpenPromptEngineer?: () => void;
  onVoiceClick: () => void;
  isSpeechSupported: boolean;
  onToggleSnippets: () => void;
  onInsertNewLine: () => void;
  onInsertXmlTag: () => void;
  hasIdeContext: boolean;
  ideContextEnabled: boolean;
  onToggleIdeContext: () => void;
  isFullscreen: boolean;
  onToggleFullscreen?: () => void;
  // Session actions
  hasMessages: boolean;
  isLoading: boolean;
  onBrainUpdate: () => void;
  onToggleBTW: () => void;
  btwIsOpen: boolean;
  quickLoop: QuickLoopProps;
  onCompact: () => void;
  onOpenTerminal?: () => void;
  onClear?: () => void;
  // Send/Stop
  isStreaming: boolean;
  onSend: () => void;
  onStop: () => void;
  canSend: boolean;
  // Shortcuts
  sendShortcut?: string;
}

export default function UnifiedActionBar(props: UnifiedActionBarProps) {
  const [composeOpen, setComposeOpen] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [loopPopoverOpen, setLoopPopoverOpen] = useState(false);
  const loopBtnRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="unified-action-bar" onMouseDown={(e) => e.preventDefault()}>
      <div className="uab-left">
        {/* Settings - existing popover component */}
        <ChatSettingsMenu
          model={props.settingsProps.model}
          thinkingMode={props.settingsProps.thinkingMode}
          permissionMode={props.settingsProps.permissionMode}
          effort={props.settingsProps.effort}
          onModelChange={props.settingsProps.onModelChange}
          onThinkingModeChange={props.settingsProps.onThinkingModeChange}
          onPermissionModeChange={props.settingsProps.onPermissionModeChange}
          onEffortChange={props.settingsProps.onEffortChange}
          disabled={props.settingsProps.disabled}
        />

        {/* Attach - always visible, most used */}
        <KeyboardShortcutTooltip label="Attach files" shortcut={props.attachShortcut} position="top">
          <button
            type="button"
            className="uab-btn"
            onClick={props.onAttach}
            aria-label="Attach files"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M10.5 3.5a2.5 2.5 0 0 1 5 0V11h-1V3.5a1.5 1.5 0 0 0-3 0V12a3 3 0 1 1-6 0V3h1v9a2 2 0 1 0 4 0V3.5Z"/>
            </svg>
          </button>
        </KeyboardShortcutTooltip>

        {/* Compose popover trigger */}
        <div style={{ position: 'relative' }}>
          <KeyboardShortcutTooltip label="Compose tools" position="top">
            <button
              type="button"
              className={`uab-btn uab-btn--with-chevron ${composeOpen ? 'uab-btn--active' : ''}`}
              onClick={() => {
                setComposeOpen(!composeOpen);
                setSessionOpen(false);
              }}
              aria-label="Compose tools"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13l-1.5-4.5L2 7l4.5-1.5L8 1Z" opacity="0.8"/>
              </svg>
              <span className="uab-btn-label">Compose</span>
              <svg className="uab-chevron" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M6 9L12 15L18 9"/>
              </svg>
            </button>
          </KeyboardShortcutTooltip>
          <ComposePopover
            isOpen={composeOpen}
            onClose={() => setComposeOpen(false)}
            onOpenPromptEngineer={props.onOpenPromptEngineer}
            onVoiceClick={props.onVoiceClick}
            isSpeechSupported={props.isSpeechSupported}
            onToggleSnippets={props.onToggleSnippets}
            onInsertNewLine={props.onInsertNewLine}
            onInsertXmlTag={props.onInsertXmlTag}
            hasIdeContext={props.hasIdeContext}
            ideContextEnabled={props.ideContextEnabled}
            onToggleIdeContext={props.onToggleIdeContext}
            isFullscreen={props.isFullscreen}
            onToggleFullscreen={props.onToggleFullscreen}
          />
        </div>

        {/* Session popover trigger - only when there are messages */}
        {props.hasMessages && (
          <div style={{ position: 'relative' }}>
            <KeyboardShortcutTooltip label="Session tools" position="top">
              <button
                type="button"
                className={`uab-btn uab-btn--with-chevron ${sessionOpen ? 'uab-btn--active' : ''}`}
                onClick={() => {
                  setSessionOpen(!sessionOpen);
                  setComposeOpen(false);
                }}
                aria-label="Session tools"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="4 17 10 11 4 5"/>
                  <line x1="12" y1="19" x2="20" y2="19"/>
                </svg>
                <span className="uab-btn-label">Session</span>
                <svg className="uab-chevron" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M6 9L12 15L18 9"/>
                </svg>
              </button>
            </KeyboardShortcutTooltip>
            <SessionPopover
              isOpen={sessionOpen}
              onClose={() => setSessionOpen(false)}
              onBrainUpdate={props.onBrainUpdate}
              onToggleBTW={props.onToggleBTW}
              btwIsOpen={props.btwIsOpen}
              onToggleLoop={() => {
                setSessionOpen(false);
                setLoopPopoverOpen(true);
              }}
              onCompact={props.onCompact}
              onOpenTerminal={props.onOpenTerminal}
              onClear={props.onClear}
              isLoading={props.isLoading}
            />
          </div>
        )}

        {/* Quick Loop popover (rendered at bar level, not inside session popover) */}
        {props.hasMessages && (
          <div style={{ position: 'relative' }}>
            <QuickLoopIndicator
              status={props.quickLoop.status}
              currentRun={props.quickLoop.currentRun}
              onClick={() => setLoopPopoverOpen(true)}
            />
            <QuickLoopPopover
              isOpen={loopPopoverOpen}
              onClose={() => setLoopPopoverOpen(false)}
              onStartLoop={props.quickLoop.startLoop}
              status={props.quickLoop.status}
              activePrompt={props.quickLoop.prompt}
              onStopLoop={props.quickLoop.stopLoop}
              currentRun={props.quickLoop.currentRun}
              anchorRef={loopBtnRef}
            />
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="uab-spacer" />

      {/* Send / Stop */}
      <div className="uab-right">
        {props.isStreaming ? (
          <KeyboardShortcutTooltip label="Stop" shortcut="ESC" position="top">
            <button
              type="button"
              className="uab-send uab-send--streaming"
              onClick={props.onStop}
              aria-label="Stop streaming"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2"/>
              </svg>
            </button>
          </KeyboardShortcutTooltip>
        ) : (
          <KeyboardShortcutTooltip label="Send" shortcut={props.sendShortcut} position="top">
            <button
              type="button"
              className="uab-send"
              onClick={props.onSend}
              disabled={!props.canSend}
              aria-label="Send message"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 8L14 2L8 14L6.5 9.5L2 8Z" fill="currentColor" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </KeyboardShortcutTooltip>
        )}
      </div>
    </div>
  );
}
