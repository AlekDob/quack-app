import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppProviders } from '../contexts';
import React from 'react';

// Mock providers to simulate failures
vi.mock('../contexts/PostHogContext', () => ({
  PostHogProvider: ({ children }: { children: React.ReactNode }) => {
    // Simulate PostHog failure
    throw new Error('PostHog initialization failed');
  },
}));

vi.mock('../contexts/GitContext', () => ({
  GitProvider: ({ children }: { children: React.ReactNode }) => {
    // Normal operation
    return <div data-testid="git-provider">{children}</div>;
  },
}));

// Mock other providers to pass through
vi.mock('../contexts/TestModeContext', () => ({
  TestModeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../contexts/UIContext', () => ({
  UIProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../contexts/TerminalContext', () => ({
  TerminalProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../contexts/FileSystemContext', () => ({
  FileSystemProvider: ({ children }: { children: React.ReactNode }) => children,
}));

describe('Provider Error Boundaries', () => {
  it('should catch PostHog provider errors and show fallback', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <AppProviders>
        <div data-testid="app-content">App Content</div>
      </AppProviders>
    );

    // Should show the error fallback instead of crashing
    expect(screen.getByText(/Provider Error: PostHog/i)).toBeInTheDocument();
    expect(screen.getByText(/This feature may be unavailable/i)).toBeInTheDocument();

    // App content should not render since PostHog is the outermost provider
    expect(screen.queryByTestId('app-content')).not.toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('should display provider name in error message', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <AppProviders>
        <div>Test</div>
      </AppProviders>
    );

    const errorHeading = screen.getByText(/Provider Error: PostHog/i);
    expect(errorHeading).toBeInTheDocument();

    consoleSpy.mockRestore();
  });
});
