import React from 'react';
import { TerminalProvider } from './TerminalContext';
import { ChatProvider } from './ChatContext';
import { FileSystemProvider } from './FileSystemContext';
import { GitProvider } from './GitContext';
import { UIProvider } from './UIContext';
import { TestModeProvider } from './TestModeContext';
import { PostHogProvider } from './PostHogContext';

// Combined provider component that wraps all contexts
export const AppProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <PostHogProvider>
      <TestModeProvider>
        <UIProvider>
          <TerminalProvider>
            <ChatProvider>
              <FileSystemProvider>
                <GitProvider>
                  {children}
                </GitProvider>
              </FileSystemProvider>
            </ChatProvider>
          </TerminalProvider>
        </UIProvider>
      </TestModeProvider>
    </PostHogProvider>
  );
};

// Re-export hooks for convenience
export { useTerminals } from './TerminalContext';
export { useChat } from './ChatContext';
export { useFileSystem } from './FileSystemContext';
export { useGit } from './GitContext';
export { useUI } from './UIContext';
export { useTestMode, useClaudeCliAvailability } from './TestModeContext';
export { useAnalytics } from './PostHogContext';
export type { AnalyticsEvents, UserProperties } from './PostHogContext';