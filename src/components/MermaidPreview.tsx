import { useEffect, useRef, useState } from "react";
import { errMsg } from "../notify";
import { useResolvedTheme } from "../theme";

let renderCounter = 0;

type MermaidApi = typeof import("mermaid").default;

function initMermaid(mermaid: MermaidApi, theme: "light" | "dark"): void {
  mermaid.initialize({
    startOnLoad: false,
    theme: theme === "dark" ? "dark" : "default",
    securityLevel: "strict",
  });
}

interface Props {
  content: string;
}

export function MermaidPreview({ content }: Props) {
  const theme = useResolvedTheme();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  if (!content.trim()) {
    return (
      <div className="mermaid-preview mermaid-preview-empty">
        <p>Empty diagram — add Mermaid source to render a preview.</p>
      </div>
    );
  }

  return (
    <div className="mermaid-preview">
      {busy && <p className="mermaid-preview-status">Rendering diagram…</p>}
      {error && <pre className="mermaid-preview-error">{error}</pre>}
      <div ref={canvasRef} className="mermaid-preview-canvas" />
    </div>
  );
}
