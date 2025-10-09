import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { DirectoryEntry } from '../types'

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
      await navigator.clipboard.writeText(entry.path)
      onClose()
    } catch (error) {
      console.error('Failed to copy path:', error)
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
      <button
        type="button"
        className="context-menu-item"
        onClick={handleCopyPath}
      >
        <span>Copia percorso</span>
      </button>
    </div>
  )

  return createPortal(menu, document.body)
}
