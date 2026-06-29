import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { onToolDrawer, type ToolDrawerData } from "../toolDrawer";
import { useModalFocus } from "../useModalFocus";
import { MarkdownPreview } from "./MarkdownPreview";
import { Icon } from "./Icon";
import { fs } from "../ipc";

// Right-side slide-over showing a tool call's full output. Animates IN and OUT:
// `data` stays mounted through the closing transition, `shown` drives the
// translateX. Mirrors DiffModal's lifecycle (portal, Esc, backdrop, focus).
export function ToolResultDrawer() {
  const [data, setData] = useState<ToolDrawerData | null>(null);
  const [shown, setShown] = useState(false);
  // Full-quality data: URL for image reads — loaded from disk on demand so
  // the body shows the picture instead of the `[image]` placeholder.
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  useModalFocus(panelRef, shown);

  useEffect(() => {
    return onToolDrawer((d) => {
      setData(d);
      // Next frame so the enter transition runs from the off-screen state.
      requestAnimationFrame(() => setShown(true));
    });
  }, []);

  useEffect(() => {
    setImgSrc(null);
    if (!data?.imagePath) return;
    let alive = true;
    void fs
      .readImageDataUrl(data.imagePath)
      .then((url) => alive && setImgSrc(url))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [data?.imagePath]);

  const close = () => {
    setShown(false);
    window.setTimeout(() => setData(null), 220);
  };

  useEffect(() => {
    if (!data) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [data]);

  if (!data) return null;
  return createPortal(
    <div
      className={`tool-drawer-scrim${shown ? " shown" : ""}`}
      onMouseDown={close}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`tool-drawer${shown ? " shown" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={`${data.title} output`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="tool-drawer-head">
          <div className="tool-drawer-titles">
            <span className="tool-drawer-title">{data.title}</span>
            {data.subtitle && (
              <span className="tool-drawer-sub" title={data.subtitle}>
                {data.subtitle}
              </span>
            )}
          </div>
          {data.onOpenFile && (
            <button
              className="tool-drawer-open"
              onClick={() => {
                data.onOpenFile!();
                close();
              }}
              title="Open this file in a new editor tab"
            >
              <Icon name="file-text" size={13} /> Open in editor
            </button>
          )}
          <button
            className="tool-drawer-close"
            onClick={close}
            title="Close (Esc)"
            aria-label="Close output"
          >
            <Icon name="x" size={14} />
          </button>
        </div>
        <div className="tool-drawer-body">
          {data.imagePath ? (
            imgSrc ? (
              <img className="tool-drawer-image" src={imgSrc} alt={data.subtitle ?? ""} />
            ) : (
              <pre className="ai-tcall-result-body">Carico immagine…</pre>
            )
          ) : data.markdown ? (
            <div className="ai-tcall-result-md">
              <MarkdownPreview content={data.result} />
            </div>
          ) : (
            <pre className="ai-tcall-result-body">{data.result}</pre>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
