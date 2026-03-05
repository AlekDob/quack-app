import { type MouseEvent } from 'react'
import GroupHeader from './GroupHeader'
import TerminalActivityBar from './TerminalActivityBar'
import type { TerminalInfo, ChatMessage } from '../types'

interface TerminalGroupProps {
  cwd: string
  terminals: TerminalInfo[]
  isCollapsed: boolean
  activeId: string | null
  // Phase 4: AgentChat display data (optional for backward compatibility)
  agentChatName?: string
  agentChatColor?: string
  chatSessions?: Map<string, ChatMessage[]>
  onToggle: () => void
  onSelect: (terminal: TerminalInfo) => void
  onClose: (id: string) => void
  onContextMenu: (event: MouseEvent, terminal: TerminalInfo) => void
  // Drag & drop support for terminals
  draggedTerminalId: string | null
  dragOverTerminalId: string | null
  dropPosition: 'before' | 'after'
  onTerminalDragStart: (terminal: TerminalInfo) => void
  onTerminalDragOver: (terminal: TerminalInfo, event: React.DragEvent) => void
  onTerminalDragLeave: () => void
  onTerminalDrop: (targetTerminal: TerminalInfo) => void
  onTerminalDragEnd: () => void
  // Drag & drop support for groups
  draggedGroupCwd: string | null
  dragOverGroupCwd: string | null
  groupDropPosition: 'before' | 'after'
  onGroupDragStart: (cwd: string) => void
  onGroupDragOver: (cwd: string, event: React.DragEvent) => void
  onGroupDragLeave: () => void
  onGroupDrop: (targetCwd: string) => void
  onGroupDragEnd: () => void
}

export default function TerminalGroup({
  cwd,
  terminals,
  isCollapsed,
  activeId,
  agentChatName,
  agentChatColor,
  chatSessions,
  onToggle,
  onSelect,
  onClose,
  onContextMenu,
  draggedTerminalId,
  dragOverTerminalId,
  dropPosition,
  onTerminalDragStart,
  onTerminalDragOver,
  onTerminalDragLeave,
  onTerminalDrop,
  onTerminalDragEnd,
  draggedGroupCwd,
  dragOverGroupCwd,
  groupDropPosition,
  onGroupDragStart,
  onGroupDragOver,
  onGroupDragLeave,
  onGroupDrop,
  onGroupDragEnd,
}: TerminalGroupProps) {
  return (
    <div className="terminal-group">
      <GroupHeader
        cwd={cwd}
        count={terminals.length}
        isCollapsed={isCollapsed}
        agentChatName={agentChatName}
        agentChatColor={agentChatColor}
        onToggle={onToggle}
        // Drag & drop for group reordering
        draggedTerminalId={draggedTerminalId}
        draggedGroupCwd={draggedGroupCwd}
        dragOverGroupCwd={dragOverGroupCwd}
        groupDropPosition={groupDropPosition}
        onGroupDragStart={onGroupDragStart}
        onGroupDragOver={onGroupDragOver}
        onGroupDragLeave={onGroupDragLeave}
        onGroupDrop={onGroupDrop}
        onGroupDragEnd={onGroupDragEnd}
      />

      {!isCollapsed && (
        <div className="terminal-group-items">
          {terminals.map((terminal) => {
            const active = terminal.id === activeId
            const isDragging = draggedTerminalId === terminal.id
            const isDragOver = dragOverTerminalId === terminal.id

            const itemClasses = [
              'terminal-item',
              'terminal-item-grouped',
              active ? 'active' : '',
              terminal.alive ? '' : 'inactive',
              isDragging ? 'dragging' : '',
              isDragOver && dropPosition === 'before' ? 'drag-over-before' : '',
              isDragOver && dropPosition === 'after' ? 'drag-over-after' : '',
            ].filter(Boolean).join(' ')

            return (
              <div
                key={terminal.id}
                className={itemClasses}
                draggable={true}
                onDragStart={() => onTerminalDragStart(terminal)}
                onDragOver={(e) => {
                  e.preventDefault()
                  onTerminalDragOver(terminal, e)
                }}
                onDragLeave={onTerminalDragLeave}
                onDrop={(e) => {
                  e.preventDefault()
                  onTerminalDrop(terminal)
                }}
                onDragEnd={onTerminalDragEnd}
                onClick={() => onSelect(terminal)}
                onContextMenu={(event) => onContextMenu(event, terminal)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelect(terminal)
                  }
                }}
              >
                <TerminalActivityBar terminal={terminal} chatSessions={chatSessions} />
                <button
                  type="button"
                  className="terminal-close"
                  aria-label={`Close ${terminal.label}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    onClose(terminal.id)
                  }}
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
