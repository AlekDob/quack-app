import { useState, useRef, useEffect } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
  content: ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  children: ReactNode
  className?: string
  show?: boolean
}

const tooltipStyle: React.CSSProperties = {
  position: 'fixed',
  background: '#1a1f2e',
  color: '#e8eef7',
  padding: '8px 12px',
  borderRadius: '6px',
  fontSize: '0.75rem',
  whiteSpace: 'nowrap',
  zIndex: 999999,
  boxShadow: '0 4px 16px rgba(0,0,0,0.8)',
  border: '1px solid rgba(255,255,255,0.15)',
  pointerEvents: 'none'
}

export default function Tooltip({
  content,
  position = 'bottom',
  children,
  className = '',
  show = true
}: TooltipProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (isHovered && ref.current) {
      const rect = ref.current.getBoundingClientRect()
      const offset = 8
      let top = 0, left = 0

      if (position === 'bottom') {
        top = rect.bottom + 4
        left = rect.left
      } else if (position === 'top') {
        top = rect.top - offset - 30
        left = rect.left
      } else if (position === 'right') {
        top = rect.top + rect.height / 2 - 15
        left = rect.right + offset
      } else {
        top = rect.top + rect.height / 2 - 15
        left = rect.left - offset - 150
      }
      setCoords({ top, left })
    }
  }, [isHovered, position])

  if (!show || !content) return <>{children}</>

  return (
    <span
      ref={ref}
      className={className}
      style={{ display: 'inline-block' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
      {isHovered && createPortal(
        <div style={{ ...tooltipStyle, top: coords.top, left: coords.left }}>
          {content}
        </div>,
        document.body
      )}
    </span>
  )
}
