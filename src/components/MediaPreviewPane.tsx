// Read-only preview for binary media (raster images + PDF) opened as an
// editor tab. Monaco can't render these and the FS text reader rejects
// binary, so we pull the bytes from disk as a data: URL and show them
// inline — an <img> (click to toggle fit/actual size) for images, the
// webview's native viewer (<iframe>) for PDFs. The buffer in the store is
// an empty sentinel; this pane is the only thing that touches the file.

import { useEffect, useState } from "react";
import { fs } from "../ipc";
import { useStore } from "../store";
import { errMsg } from "../notify";
import { basename } from "../pathUtils";
import type { MediaKind } from "../mediaPreview";
import { Icon } from "./Icon";

interface Props {
  wsId: string;
  path: string;
  kind: MediaKind;
}

export function MediaPreviewPane({ wsId, path, kind }: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Images toggle between "fit to pane" and 1:1 actual size on click.
  const [actualSize, setActualSize] = useState(false);

  useEffect(() => {
    let alive = true;
    setDataUrl(null);
    setError(null);
    setActualSize(false);
    // Mark the buffer as in use so the idle sweeper leaves the tab alone,
    // mirroring EditorPane's behaviour for text files.
    useStore.getState().touchFile(wsId, path);
    (async () => {
      try {
        const url = await fs.readImageDataUrl(path);
        if (alive) setDataUrl(url);
      } catch (e) {
        if (alive) setError(errMsg(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [wsId, path]);

  if (error) {
    return (
      <div className="media-preview media-preview-error">
        <Icon name="alert-triangle" size={20} />
        <span>
          Can't preview {basename(path)}: {error}
        </span>
      </div>
    );
  }

  if (!dataUrl) {
    return (
      <div className="media-preview media-preview-loading">
        Loading preview…
      </div>
    );
  }

  if (kind === "pdf") {
    return (
      <div className="media-preview media-preview-pdf">
        <iframe src={dataUrl} title={basename(path)} />
      </div>
    );
  }

  return (
    <div
      className={`media-preview media-preview-image ${
        actualSize ? "actual-size" : ""
      }`}
      onClick={() => setActualSize((v) => !v)}
      title={actualSize ? "Click to fit" : "Click for actual size"}
    >
      <img src={dataUrl} alt={basename(path)} />
    </div>
  );
}
