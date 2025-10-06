import { useEffect, useRef, useState } from 'react'

export default function PerformanceMonitor() {
  const [fps, setFps] = useState(60)
  const renderCountRef = useRef(0)

  useEffect(() => {
    let frameCount = 0
    let lastTime = performance.now()
    let animationId: number

    const measureFPS = () => {
      frameCount++
      const currentTime = performance.now()

      if (currentTime >= lastTime + 1000) {
        setFps(Math.round((frameCount * 1000) / (currentTime - lastTime)))
        frameCount = 0
        lastTime = currentTime
      }

      animationId = requestAnimationFrame(measureFPS)
    }

    animationId = requestAnimationFrame(measureFPS)

    return () => {
      cancelAnimationFrame(animationId)
    }
  }, [])

  // Count renders ma SENZA causare re-render
  renderCountRef.current++

  return (
    <div style={{
      position: 'fixed',
      top: 10,
      right: 10,
      background: 'rgba(0,0,0,0.8)',
      color: fps < 30 ? '#ff4444' : fps < 50 ? '#ffaa00' : '#44ff44',
      padding: '8px 12px',
      borderRadius: '4px',
      fontFamily: 'monospace',
      fontSize: '12px',
      zIndex: 999999,
      pointerEvents: 'none',
      minWidth: '100px'
    }}>
      <div>FPS: <strong>{fps}</strong></div>
      <div style={{ opacity: 0.7, fontSize: 10 }}>Renders: {renderCountRef.current}</div>
    </div>
  )
}
