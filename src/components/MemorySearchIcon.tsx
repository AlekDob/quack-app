/**
 * MemorySearchIcon Component
 *
 * Brain icon for the input bar that shows memory search status.
 * - Idle: Dim gray
 * - Searching: Pulsing animation
 * - Active (memories found): Glowing purple
 *
 * Click to show/hide memory preview for current input.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { existsSync } from 'fs';
import './MemorySearchIcon.css';

export type MemorySearchStatus = 'idle' | 'searching' | 'active' | 'disabled';

export interface MemorySearchIconProps {
  status: MemorySearchStatus;
  memoryCount?: number;
  onClick?: () => void;
  onPreviewRequest?: (prompt: string) => void;
  currentPrompt?: string;
  disabled?: boolean;
}

export const MemorySearchIcon: React.FC<MemorySearchIconProps> = ({
  status,
  memoryCount = 0,
  onClick,
  disabled = false,
}) => {
  const getTitle = () => {
    if (disabled) return 'Memory search disabled';
    switch (status) {
      case 'searching':
        return 'Searching memories...';
      case 'active':
        return `${memoryCount} ${memoryCount === 1 ? 'memory' : 'memories'} will be used`;
      case 'disabled':
        return 'Memory search disabled';
      default:
        return 'Memory search active';
    }
  };

  return (
    <button
      className={`memory-search-icon ${status} ${disabled ? 'disabled' : ''}`}
      onClick={disabled ? undefined : onClick}
      title={getTitle()}
      disabled={disabled}
    >
      <span className="memory-search-brain">🧠</span>
      {status === 'active' && memoryCount > 0 && (
        <span className="memory-search-badge">{memoryCount}</span>
      )}
      {status === 'searching' && (
        <span className="memory-search-spinner" />
      )}
    </button>
  );
};

/**
 * Hook to manage memory search preview state
 * Debounces input and searches for relevant memories
 */
export interface MemoryPreviewResult {
  memories: Array<{
    name: string;
    type: string;
    observations: string[];
  }>;
  keywords: string[];
  isSearching: boolean;
}

export function useMemoryPreview(
  prompt: string,
  enabled: boolean = true,
  debounceMs: number = 500
): MemoryPreviewResult {
  const [result, setResult] = useState<MemoryPreviewResult>({
    memories: [],
    keywords: [],
    isSearching: false,
  });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!enabled || !prompt || prompt.trim().length < 3) {
      setResult({ memories: [], keywords: [], isSearching: false });
      return;
    }

    // Set searching state
    setResult(prev => ({ ...prev, isSearching: true }));

    // Debounce the search
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(async () => {
      // Note: In the actual implementation, this would call a Tauri command
      // to search the Brain DB. For now, we just clear the searching state.
      // The actual memory search happens in the backend when the message is sent.
      setResult(prev => ({ ...prev, isSearching: false }));
    }, debounceMs);

  }, [prompt, enabled, debounceMs]);

  return result;
}

export default MemorySearchIcon;
