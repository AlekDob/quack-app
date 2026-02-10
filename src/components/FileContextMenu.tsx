import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { invoke } from '@tauri-apps/api/core'
import type { DirectoryEntry } from '../types'
import { useIDEStore, selectHasPreferredIDE } from '../stores/ideStore'
import { getFileManagerName, cleanPath } from '../utils/platform'

interface FileContextMenuProps {
  position: { x: number; y: number }
  entry: DirectoryEntry
  onClose: () => void
}

export default function FileContextMenu({
  position,
  entry,
  onClose,
}: FileContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const hasPreferredIDE = useIDEStore(selectHasPreferredIDE)
  const openFileInIDE = useIDEStore((state) => state.openFileInIDE)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      try {
        // Defensive checks to prevent NotFoundError
        if (!menuRef.current) {
          return
        }

        // Check if menu is still in DOM
        if (!document.body.contains(menuRef.current)) {
          return
        }

        // Check if event target is valid
        if (!event.target || !(event.target instanceof Node)) {
          return
        }

        if (!menuRef.current.contains(event.target)) {
          onClose()
        }
      } catch (error) {
        console.warn('Error handling click outside:', error)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      try {
        if (event.key === 'Escape') {
          onClose()
        }
      } catch (error) {
        console.warn('Error handling escape:', error)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  const handleCopyPath = async () => {
    try {
      await navigator.clipboard.writeText(cleanPath(entry.path))
      onClose()
    } catch (error) {
      console.error('Failed to copy path:', error)
    }
  }

  const handleOpenInIDE = async () => {
    try {
      await openFileInIDE(entry.path)
      onClose()
    } catch (error) {
      console.error('Failed to open in IDE:', error)
    }
  }

  const handleRevealInFinder = async () => {
    try {
      await invoke('reveal_in_finder', { path: entry.path })
      onClose()
    } catch (error) {
      console.error('Failed to reveal in Finder:', error)
    }
  }

  const menu = (
    <div
      ref={menuRef}
      className="context-menu"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      {hasPreferredIDE && (
        <button
          type="button"
          className="context-menu-item"
          onClick={handleOpenInIDE}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M8 21h8" />
            <path d="M12 17v4" />
            <path d="M7 8l3 3-3 3" />
            <path d="M13 11h4" />
          </svg>
          <span>Open in IDE</span>
        </button>
      )}
      <button
        type="button"
        className="context-menu-item"
        onClick={handleRevealInFinder}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
        <span>Reveal in {getFileManagerName()}</span>
      </button>
      <button
        type="button"
        className="context-menu-item"
        onClick={handleCopyPath}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
        <span>Copy Path</span>
      </button>
    </div>
  )

  return createPortal(menu, document.body)
}
