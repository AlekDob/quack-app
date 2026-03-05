import { invoke } from '@tauri-apps/api/core';
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTerminalStore } from '../stores/terminalStore';
import type { ProjectTerminal } from '../types';
import './ProjectTerminalItem.css';

const MAX_NAME_LENGTH = 50;
const CONTEXT_MENU_WIDTH = 140;
const CONTEXT_MENU_HEIGHT = 120;

const TERMINAL_COLORS = [
  '#4dd4b3', // Teal (default)
  '#ef4444', // Red
  '#f59e0b', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#6b7280', // Gray
];

interface ProjectTerminalItemProps {
  terminal: ProjectTerminal;
  isActive: boolean;
  onSelect: (id: string) => void;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
}

export function ProjectTerminalItem({
  terminal,
  isActive,
  onSelect,
}: ProjectTerminalItemProps) {
  const removeProjectTerminal = useTerminalStore(state => state.removeProjectTerminal);
  const updateProjectTerminal = useTerminalStore(state => state.updateProjectTerminal);

  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(terminal.name);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const itemRef = useRef<HTMLDivElement>(null);

  // Auto-focus and select text when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Click outside detection for context menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        contextMenu.visible &&
        contextMenuRef.current &&
        !contextMenuRef.current.contains(e.target as Node)
      ) {
        setContextMenu({ visible: false, x: 0, y: 0 });
        setShowColorPicker(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu({ visible: false, x: 0, y: 0 });
        setShowColorPicker(false);
      }
    };

    if (contextMenu.visible) {
      // Use capture phase to intercept before other handlers
      document.addEventListener('mousedown', handleClickOutside, true);
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside, true);
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [contextMenu.visible]);

  const saveName = useCallback(() => {
    const trimmedName = editName.trim();

    // Validate length
    if (trimmedName.length > MAX_NAME_LENGTH) {
      setEditName(terminal.name);
      setIsEditing(false);
      return;
    }

    if (trimmedName && trimmedName !== terminal.name) {
      updateProjectTerminal(terminal.id, { name: trimmedName });
    } else {
      setEditName(terminal.name);
    }
    setIsEditing(false);
  }, [editName, terminal.id, terminal.name, updateProjectTerminal]);

  // Click outside detection for edit mode
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isEditing &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        saveName();
      }
    };

    if (isEditing) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isEditing, saveName]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Calculate bounded position to prevent off-screen rendering
    const x = Math.min(
      Math.max(0, e.clientX),
      window.innerWidth - CONTEXT_MENU_WIDTH
    );
    const y = Math.min(
      Math.max(0, e.clientY),
      window.innerHeight - CONTEXT_MENU_HEIGHT
    );

    setContextMenu({ visible: true, x, y });
    setShowColorPicker(false);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditName(terminal.name);
    setIsEditing(true);
  };

  const handleRename = () => {
    setContextMenu({ visible: false, x: 0, y: 0 });
    setEditName(terminal.name);
    setIsEditing(true);
  };

  const handleColorChange = (color: string) => {
    updateProjectTerminal(terminal.id, { color });
    setContextMenu({ visible: false, x: 0, y: 0 });
    setShowColorPicker(false);
  };

  const cancelEdit = () => {
    setEditName(terminal.name);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveName();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  };

  const handleClose = async (e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      await invoke('close_terminal', { id: terminal.id });
      removeProjectTerminal(terminal.id);
    } catch (error) {
      console.error('Failed to close terminal:', error);
    }
  };

  const contextMenuContent = contextMenu.visible && (
    <div
      ref={contextMenuRef}
      className="terminal-context-menu"
      role="menu"
      style={{
        position: 'fixed',
        top: `${contextMenu.y}px`,
        left: `${contextMenu.x}px`,
        zIndex: 99999,
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        className="terminal-context-menu-item"
        role="menuitem"
        onClick={handleRename}
      >
        Rename
      </div>
      <div
        className="terminal-context-menu-item"
        role="menuitem"
        onClick={() => setShowColorPicker(!showColorPicker)}
      >
        Change Color
      </div>
      {showColorPicker && (
        <div className="terminal-color-picker">
          {TERMINAL_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={`terminal-color-option ${color === terminal.color ? 'active' : ''}`}
              style={{ backgroundColor: color }}
              onClick={() => handleColorChange(color)}
              title={color}
              aria-label={`Select color ${color}`}
            />
          ))}
        </div>
      )}
      <div className="terminal-context-menu-divider" />
      <div
        className="terminal-context-menu-item danger"
        role="menuitem"
        onClick={(e) => {
          setContextMenu({ visible: false, x: 0, y: 0 });
          handleClose(e);
        }}
      >
        Close Terminal
      </div>
    </div>
  );

  return (
    <>
      <div
        ref={itemRef}
        className={`project-terminal-item ${isActive ? 'active' : ''}`}
        onClick={() => !isEditing && onSelect(terminal.id)}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      >
        <div
          className="terminal-item-indicator"
          style={{ backgroundColor: terminal.color }}
        />

        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            className="terminal-item-name-input"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            aria-label="Terminal name"
            maxLength={MAX_NAME_LENGTH}
          />
        ) : (
          <span className="terminal-item-name">{terminal.name}</span>
        )}

        {terminal.status === 'busy' && !isEditing && (
          <span className="terminal-item-status busy" title="Running">
            *
          </span>
        )}

        {!isEditing && (
          <button
            type="button"
            className="terminal-item-close"
            onClick={handleClose}
            title="Close terminal"
          >
            x
          </button>
        )}
      </div>

      {/* Render context menu in portal to escape WebView context menu */}
      {createPortal(contextMenuContent, document.body)}
    </>
  );
}
