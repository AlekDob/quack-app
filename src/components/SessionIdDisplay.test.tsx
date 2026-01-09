import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SessionIdDisplay from './SessionIdDisplay';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock clipboard API
const writeTextMock = vi.fn(() => Promise.resolve());
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: writeTextMock,
  },
  writable: true,
  configurable: true,
});

describe('SessionIdDisplay', () => {
  it('renders truncated session ID', () => {
    const sessionId = 'abc123def456ghi789';
    render(<SessionIdDisplay sessionId={sessionId} />);

    // Should show first 8 chars + "..."
    expect(screen.getByText('abc123de...')).toBeInTheDocument();
  });

  it('shows full session ID in title attribute', () => {
    const sessionId = 'abc123def456ghi789';
    render(<SessionIdDisplay sessionId={sessionId} />);

    const button = screen.getByRole('button');
    expect(button.title).toContain(sessionId);
  });

  it('copies session ID to clipboard on click', async () => {
    const sessionId = 'abc123def456ghi789';
    render(<SessionIdDisplay sessionId={sessionId} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(sessionId);
    });
  });

  it('shows checkmark icon when copied', async () => {
    const sessionId = 'abc123def456ghi789';
    render(<SessionIdDisplay sessionId={sessionId} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(button).toHaveClass('copied');
    });
  });

  it('handles short session IDs without truncation', () => {
    const sessionId = 'abc123';
    render(<SessionIdDisplay sessionId={sessionId} />);

    // Should show full ID without "..."
    expect(screen.getByText('abc123')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const sessionId = 'abc123def456';
    render(<SessionIdDisplay sessionId={sessionId} className="custom-class" />);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class');
  });
});
