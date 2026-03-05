import React from 'react';
import { TerminalProvider } from './TerminalContext';
import { ChatProvider } from './ChatContext';
import { FileSystemProvider } from './FileSystemContext';
import { GitProvider } from './GitContext';
import { UIProvider } from './UIContext';
import { TestModeProvider } from './TestModeContext';
import { PostHogProvider } from './PostHogContext';
import ErrorBoundary from '../components/ErrorBoundary';

// Fallback component for provider errors
const ProviderErrorFallback = ({ providerName }: { providerName: string }) => (
  <div style={{
    padding: '20px',
    background: 'rgba(242, 140, 82, 0.1)',
    borderLeft: '3px solid #f28c52',
    margin: '10px',
    borderRadius: '4px'
  }}>
    <h3 style={{ color: '#f28c52', margin: '0 0 8px 0' }}>
      Provider Error: {providerName}
    </h3>
    <p style={{ margin: 0, fontSize: '14px', opacity: 0.8 }}>
      This feature may be unavailable. The app will continue to work.
    </p>
  </div>
);

// Combined provider component that wraps all contexts
export const AppProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <ErrorBoundary fallback={<ProviderErrorFallback providerName="PostHog" />}>
      <PostHogProvider>
        <TestModeProvider>
          <UIProvider>
            <TerminalProvider>
              <ChatProvider>
                <FileSystemProvider>
                  <ErrorBoundary fallback={<ProviderErrorFallback providerName="Git" />}>
                    <GitProvider>
                      {children}
                    </GitProvider>
                  </ErrorBoundary>
                </FileSystemProvider>
              </ChatProvider>
            </TerminalProvider>
          </UIProvider>
        </TestModeProvider>
      </PostHogProvider>
    </ErrorBoundary>
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