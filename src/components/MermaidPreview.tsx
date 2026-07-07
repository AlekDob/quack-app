import { useCallback, useEffect, useRef, useState } from "react";
import { errMsg } from "../notify";
import {
  MERMAID_ZOOM_BTN,
  MERMAID_ZOOM_DEFAULT,
  clampMermaidZoom,
  formatMermaidZoom,
  scrollForZoom,
  wheelMermaidZoomFactor,
} from "../mermaidZoom";
import { useResolvedTheme } from "../theme";
import { Icon } from "./Icon";

let renderCounter = 0;

type MermaidApi = typeof import("mermaid").default;

function initMermaid(mermaid: MermaidApi, theme: "light" | "dark"): void {
  mermaid.initialize({
    startOnLoad: false,
    theme: theme === "dark" ? "dark" : "default",
    securityLevel: "strict",
  });
}

function syncStageBox(
  stage: HTMLDivElement | null,
  canvas: HTMLDivElement | null,
  scale: number,
): void {
  const svg = canvas?.querySelector("svg");
  if (!stage || !svg) return;
  const w = svg.getBoundingClientRect().width / scale;
  const h = svg.getBoundingClientRect().height / scale;
  if (w <= 0 || h <= 0) return;
  stage.style.width = `${w * scale}px`;
  stage.style.height = `${h * scale}px`;
}

interface Props {
  content: string;
}

export function MermaidPreview({ content }: Props) {
  const theme = useResolvedTheme();
  const viewportRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(MERMAID_ZOOM_DEFAULT);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scale, setScale] = useState(MERMAID_ZOOM_DEFAULT);

  const applyScale = useCallback((next: number, anchor?: { x: number; y: number }) => {
    const viewport = viewportRef.current;
    const clamped = clampMermaidZoom(next);
    const prev = scaleRef.current;
    if (clamped === prev) return;
    scaleRef.current = clamped;
    setScale(clamped);
    requestAnimationFrame(() => {
      syncStageBox(stageRef.current, canvasRef.current, clamped);
      if (viewport && anchor) {
        scrollForZoom(viewport, anchor.x, anchor.y, prev, clamped);
      }
    });
  }, []);

  const resetZoom = useCallback(() => {
    const viewport = viewportRef.current;
    scaleRef.current = MERMAID_ZOOM_DEFAULT;
    setScale(MERMAID_ZOOM_DEFAULT);
    requestAnimationFrame(() => {
      syncStageBox(stageRef.current, canvasRef.current, MERMAID_ZOOM_DEFAULT);
      viewport?.scrollTo({ top: 0, left: 0 });
    });
  }, []);

  useEffect(() => {
    scaleRef.current = MERMAID_ZOOM_DEFAULT;
    setScale(MERMAID_ZOOM_DEFAULT);
  }, [content]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const trimmed = content.trim();
    if (!trimmed) {
      canvas.innerHTML = "";
      setError(null);
      setBusy(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        setBusy(true);
        setError(null);
        try {
          const { default: mermaid } = await import("mermaid");
          if (cancelled) return;
          initMermaid(mermaid, theme);
          const id = `mmd-${++renderCounter}`;
          const { svg } = await mermaid.render(id, trimmed);
          if (cancelled) return;
          canvas.innerHTML = svg;
          requestAnimationFrame(() => {
            syncStageBox(stageRef.current, canvasRef.current, scaleRef.current);
          });
        } catch (e) {
          if (!cancelled) {
            canvas.innerHTML = "";
            setError(errMsg(e));
          }
        } finally {
          if (!cancelled) setBusy(false);
        }
      })();
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [content, theme]);

  useEffect(() => {
    syncStageBox(stageRef.current, canvasRef.current, scale);
  }, [scale, busy]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const factor = wheelMermaidZoomFactor(e.deltaY);
      applyScale(scaleRef.current * factor, { x: e.clientX, y: e.clientY });
    };
    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, [applyScale]);

  if (!content.trim()) {
    return (
      <div className="mermaid-preview mermaid-preview-empty">
        <p>Empty diagram — add Mermaid source to render a preview.</p>
      </div>
    );
  }

  const zoomTowardCenter = (factor: number) => {
    const viewport = viewportRef.current;
    if (!viewport) {
      applyScale(scale * factor);
      return;
    }
    const rect = viewport.getBoundingClientRect();
    applyScale(scale * factor, {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
  };

  const zoomOut = () => zoomTowardCenter(1 / MERMAID_ZOOM_BTN);
  const zoomIn = () => zoomTowardCenter(MERMAID_ZOOM_BTN);

  return (
    <div className="mermaid-preview">
      {busy && <p className="mermaid-preview-status">Rendering diagram…</p>}
      {error && <pre className="mermaid-preview-error">{error}</pre>}
      <div className="mermaid-preview-body">
        <div className="mermaid-preview-zoom" role="toolbar" aria-label="Diagram zoom">
          <button type="button" className="mermaid-preview-zoom-btn" onClick={zoomOut} title="Zoom out" aria-label="Zoom out">
            <Icon name="minus" size={13} />
          </button>
          <button type="button" className="mermaid-preview-zoom-label" onClick={resetZoom} title="Reset zoom" aria-label="Reset zoom">
            {formatMermaidZoom(scale)}
          </button>
          <button type="button" className="mermaid-preview-zoom-btn" onClick={zoomIn} title="Zoom in" aria-label="Zoom in">
            <Icon name="plus" size={13} />
          </button>
          <button type="button" className="mermaid-preview-zoom-btn" onClick={resetZoom} title="Reset zoom" aria-label="Reset zoom">
            <Icon name="rotate-ccw" size={13} />
          </button>
        </div>
        <div ref={viewportRef} className="mermaid-preview-viewport">
          <div
            ref={stageRef}
            className="mermaid-preview-stage"
            style={{ transform: `scale(${scale})` }}
          >
            <div ref={canvasRef} className="mermaid-preview-canvas" />
          </div>
        </div>
      </div>
    </div>
  );
}
