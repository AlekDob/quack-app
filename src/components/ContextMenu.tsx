import { useEffect, useRef } from 'react'
import type { TerminalInfo } from '../types'

interface ContextMenuProps {
  position: { x: number; y: number }
  terminal: TerminalInfo
  onEdit: () => void
  onClose: () => void
  onCopyPath?: () => void
  onCloseTerminal?: () => void
}

export default function ContextMenu({
  position,
  terminal,
  onEdit,
  onClose,
  onCopyPath,
  onCloseTerminal,
}: ContextMenuProps) {
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
      await navigator.clipboard.writeText(terminal.cwd)
      onClose()
    } catch (error) {
      console.error('Failed to copy path:', error)
    }
  }

  const handleCloseTerminal = () => {
    onCloseTerminal?.()
    onClose()
  }

  return (
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
        onClick={() => {
          onEdit()
          onClose()
        }}
      >
        <span className="context-menu-icon">✏️</span>
        <span>Modifica terminale</span>
      </button>

      {onCopyPath && (
        <button
          type="button"
          className="context-menu-item"
          onClick={handleCopyPath}
        >
          <span className="context-menu-icon">📋</span>
          <span>Copia percorso</span>
        </button>
      )}

      <div className="context-menu-separator" />

      {onCloseTerminal && (
        <button
          type="button"
          className="context-menu-item context-menu-item-danger"
          onClick={handleCloseTerminal}
        >
          <span className="context-menu-icon">🗑️</span>
          <span>Chiudi terminale</span>
        </button>
      )}
    </div>
  )
}
