/**
 * TerminalInstance Component
 *
 * Lightweight wrapper for a single terminal instance
 * Handles visibility, theme, keyboard shortcuts (search, filter, clear), and lifecycle
 */

import { memo, useState, useCallback, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { useTerminal } from './useTerminal';
import { TERMINAL_THEMES, type TerminalThemeName } from './TerminalThemes';
import { TerminalSearchBar } from './TerminalSearchBar';
import { TerminalFilterBar } from './TerminalFilterBar';
import '@xterm/xterm/css/xterm.css';

/** Imperative API exposed by TerminalInstance via ref */
export interface TerminalInstanceHandle {
  find: () => void;
  filter: () => void;
  clear: () => void;
}

export interface TerminalInstanceProps {
  /** Terminal ID from backend */
  terminalId: string;
  /** Whether this terminal is currently active/visible */
  isActive: boolean;
  /** Theme name to apply */
  themeName?: TerminalThemeName;
  /** Custom cursor color (overrides theme) */
  cursorColor?: string;
  /** Callback when terminal receives data */
  onData?: (data: string) => void;
  /** Callback when terminal exits */
  onExit?: () => void;
}

/**
 * Single terminal instance component
 *
 * Features:
 * - Uses useTerminal hook for clean lifecycle management
 * - Cmd+F: search with xterm SearchAddon
 * - Cmd+Shift+F: line filter mode
 * - Cmd+K: clear terminal
 * - Memoized to prevent unnecessary re-renders
 * - Exposes { find, filter, clear } via ref (useImperativeHandle)
 */
const TerminalInstanceComponent = forwardRef<TerminalInstanceHandle, TerminalInstanceProps>(function TerminalInstanceComponent({
  terminalId,
  isActive,
  themeName = 'tokyo-night',
  cursorColor,
  onData,
  onExit,
}, ref) {
    const theme = TERMINAL_THEMES[themeName]?.colors || TERMINAL_THEMES['tokyo-night'].colors;

    const {
      containerRef,
      clear,
      searchAddon,
      isFiltering,
      startFilter,
      updateFilter,
      stopFilter,
      filterMatchCount,
    } = useTerminal({ terminalId, theme, cursorColor, onData, onExit });

    const [showSearch, setShowSearch] = useState(false);
    const [showFilter, setShowFilter] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Close search when filter opens and vice versa
    const openSearch = useCallback(() => {
      if (showFilter) {
        stopFilter();
        setShowFilter(false);
      }
      setShowSearch(true);
    }, [showFilter, stopFilter]);

    const openFilter = useCallback(() => {
      if (showSearch) {
        setShowSearch(false);
      }
      setShowFilter(true);
    }, [showSearch]);

    const closeSearch = useCallback(() => {
      setShowSearch(false);
      // Refocus terminal
      containerRef.current?.querySelector<HTMLTextAreaElement>('.xterm-helper-textarea')?.focus();
    }, [containerRef]);

    const closeFilter = useCallback(() => {
      stopFilter();
      setShowFilter(false);
      // Refocus terminal
      containerRef.current?.querySelector<HTMLTextAreaElement>('.xterm-helper-textarea')?.focus();
    }, [stopFilter, containerRef]);

    const handleFilterChange = useCallback(
      (term: string) => {
        if (!isFiltering && term) {
          startFilter(term);
        } else if (isFiltering) {
          updateFilter(term);
        }
      },
      [isFiltering, startFilter, updateFilter]
    );

    // Expose actions via imperative handle for parent components (e.g. action menu)
    useImperativeHandle(ref, () => ({
      find: () => { showSearch ? closeSearch() : openSearch(); },
      filter: () => { showFilter ? closeFilter() : openFilter(); },
      clear,
    }), [showSearch, showFilter, openSearch, openFilter, closeSearch, closeFilter, clear]);

    // Intercept keyboard shortcuts before xterm captures them
    useEffect(() => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;

      const handleKeyDown = (e: KeyboardEvent) => {
        const isMeta = e.metaKey || e.ctrlKey;

        // Cmd+K — clear terminal
        if (isMeta && e.key === 'k' && !e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          clear();
          return;
        }

        // Cmd+Shift+F — filter mode
        if (isMeta && e.key === 'f' && e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          if (showFilter) {
            closeFilter();
          } else {
            openFilter();
          }
          return;
        }

        // Cmd+F — search
        if (isMeta && e.key === 'f' && !e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          if (showSearch) {
            closeSearch();
          } else {
            openSearch();
          }
          return;
        }
      };

      // Use capture phase to intercept before xterm
      wrapper.addEventListener('keydown', handleKeyDown, true);
      return () => wrapper.removeEventListener('keydown', handleKeyDown, true);
    }, [clear, showSearch, showFilter, openSearch, openFilter, closeSearch, closeFilter]);

    return (
      <div
        ref={wrapperRef}
        className="terminal-instance"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          opacity: isActive ? 1 : 0,
          pointerEvents: isActive ? 'auto' : 'none',
          zIndex: isActive ? 1 : 0,
          background: theme.background,
          transition: 'opacity 0.15s ease',
        }}
      >
        {/* Search bar (floating overlay, top-right corner) */}
        {showSearch && searchAddon && (
          <TerminalSearchBar searchAddon={searchAddon} onClose={closeSearch} />
        )}

        {/* Filter bar (pushes terminal content down) */}
        {showFilter && (
          <TerminalFilterBar
            onFilterChange={handleFilterChange}
            onClose={closeFilter}
            matchCount={filterMatchCount}
          />
        )}

        <div
          ref={containerRef}
          className="terminal-container"
          style={{
            flex: 1,
            overflow: 'hidden',
            padding: '8px',
          }}
        />
      </div>
    );
});

/**
 * Memoized export
 * Only re-render when props actually change
 */
export const TerminalInstance = memo(TerminalInstanceComponent);

TerminalInstance.displayName = 'TerminalInstance';
