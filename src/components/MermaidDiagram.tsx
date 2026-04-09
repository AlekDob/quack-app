import { useEffect, useRef, useState, useCallback } from 'react';
// Dynamic import avoids Rollup TDZ bug with Mermaid 11.x in production builds.
const getMermaid = () => import('mermaid').then(m => m.default);
import './MermaidDiagram.css';

interface MermaidDiagramProps {
  children: string;
}

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.1;
const WHEEL_SENSITIVITY = 0.002;

/**
 * Mermaid diagram renderer component
 * Renders Mermaid diagrams from raw .mmd content
 * Supports zoom via trackpad pinch, Ctrl+scroll, and +/- buttons
 */
export default function MermaidDiagram({ children }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  useEffect(() => {
    const accentColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--accent-color').trim() || '#f28c52';
    const accentRgb = getComputedStyle(document.documentElement)
      .getPropertyValue('--accent-rgb').trim() || '242, 140, 82';

    getMermaid().then(mermaid => {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        themeVariables: {
          primaryColor: accentColor,
          primaryTextColor: '#fff',
          primaryBorderColor: accentColor,
          lineColor: 'rgba(255, 255, 255, 0.3)',
          secondaryColor: `rgba(${accentRgb}, 0.2)`,
          tertiaryColor: 'rgba(255, 255, 255, 0.05)',
          background: 'transparent',
          mainBkg: 'rgba(255, 255, 255, 0.05)',
          secondBkg: 'rgba(255, 255, 255, 0.03)',
          border1: 'rgba(255, 255, 255, 0.2)',
          border2: 'rgba(255, 255, 255, 0.15)',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: '14px',
        },
        flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' },
        sequence: { useMaxWidth: true },
        gantt: { useMaxWidth: true },
      });
    });
  }, []);

  useEffect(() => {
    if (!containerRef.current || !children) {
      return;
    }

    const renderDiagram = async () => {
      setIsRendering(true);
      setError(null);

      try {
        // Generate unique ID for this diagram
        const id = `mermaid-${Math.random().toString(36).substring(7)}`;

        // Render the diagram
        const mermaid = await getMermaid();
        const { svg } = await mermaid.render(id, children);

        // Insert the SVG into the container
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch (err) {
        console.error('Mermaid rendering error:', err);
        setError(err instanceof Error ? err.message : 'Failed to render diagram');
      } finally {
        setIsRendering(false);
      }
    };

    void renderDiagram();
  }, [children]);

  // Trackpad pinch / Ctrl+scroll zoom
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleWheel = (e: WheelEvent) => {
      // Pinch gesture (ctrlKey) or Ctrl+scroll
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = -e.deltaY * WHEEL_SENSITIVITY;
        setZoom(z => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + delta)));
      }
    };

    viewport.addEventListener('wheel', handleWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', handleWheel);
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoom(z => Math.min(MAX_ZOOM, z + ZOOM_STEP));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(z => Math.max(MIN_ZOOM, z - ZOOM_STEP));
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Spacebar hold for pan mode — scoped to focused viewport
  const handleViewportKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.code === 'Space' && !e.repeat) {
      e.preventDefault();
      setSpaceHeld(true);
    }
  }, []);

  const handleViewportKeyUp = useCallback((e: React.KeyboardEvent) => {
    if (e.code === 'Space') {
      setSpaceHeld(false);
      setIsPanning(false);
    }
  }, []);

  // Mouse drag pan (space+drag or middle-click drag)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (spaceHeld || e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    }
  }, [spaceHeld, pan]);

  useEffect(() => {
    if (!isPanning) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setPan({ x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy });
    };
    const handleMouseUp = () => setIsPanning(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isPanning]);

  if (error) {
    return (
      <div className="mermaid-error">
        <div className="mermaid-error-icon">⚠️</div>
        <div className="mermaid-error-title">Failed to render diagram</div>
        <div className="mermaid-error-message">{error}</div>
        <details className="mermaid-error-details">
          <summary>Show diagram source</summary>
          <pre>{children}</pre>
        </details>
      </div>
    );
  }

  const zoomPercent = Math.round(zoom * 100);

  return (
    <div className="mermaid-diagram-container">
      {isRendering && (
        <div className="mermaid-loading">
          <div className="mermaid-loading-spinner" />
          <div className="mermaid-loading-text">Rendering diagram...</div>
        </div>
      )}
      <div
        ref={viewportRef}
        className={`mermaid-viewport${spaceHeld ? ' pan-ready' : ''}${isPanning ? ' panning' : ''}`}
        style={{ display: isRendering ? 'none' : 'block' }}
        tabIndex={0}
        onMouseDown={handleMouseDown}
        onKeyDown={handleViewportKeyDown}
        onKeyUp={handleViewportKeyUp}
      >
        <div
          ref={containerRef}
          className="mermaid-diagram"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'top center',
          }}
        />
      </div>
      {!isRendering && (
        <div className="mermaid-zoom-controls">
          <button type="button" onClick={handleZoomOut} disabled={zoom <= MIN_ZOOM} title="Zoom out">
            -
          </button>
          <button type="button" onClick={handleZoomReset} className="mermaid-zoom-label" title="Reset zoom">
            {zoomPercent}%
          </button>
          <button type="button" onClick={handleZoomIn} disabled={zoom >= MAX_ZOOM} title="Zoom in">
            +
          </button>
        </div>
      )}
    </div>
  );
}
