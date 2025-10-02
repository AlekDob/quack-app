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
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
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
