import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import './MermaidDiagram.css';

interface MermaidDiagramProps {
  children: string;
}

/**
 * Mermaid diagram renderer component
 * Renders Mermaid diagrams from raw .mmd content
 */
export default function MermaidDiagram({ children }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(true);

  useEffect(() => {
    // Read accent color from CSS variable at runtime (mermaid needs resolved values)
    const accentColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--accent-color').trim() || '#f28c52';
    const accentRgb = getComputedStyle(document.documentElement)
      .getPropertyValue('--accent-rgb').trim() || '242, 140, 82';

    // Initialize mermaid with dark theme settings
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
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'basis',
      },
      sequence: {
        useMaxWidth: true,
      },
      gantt: {
        useMaxWidth: true,
      },
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

  return (
    <div className="mermaid-diagram-container">
      {isRendering && (
        <div className="mermaid-loading">
          <div className="mermaid-loading-spinner" />
          <div className="mermaid-loading-text">Rendering diagram...</div>
        </div>
      )}
      <div
        ref={containerRef}
        className="mermaid-diagram"
        style={{ display: isRendering ? 'none' : 'block' }}
      />
    </div>
  );
}
