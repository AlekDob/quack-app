// Small popover: pick a duck from the shipped pool, or upload a custom
// image. Used both by the "New agent" drawer and by an existing custom
// preset's avatar (quick re-pick without leaving the organigramma).
import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { Icon } from "./Icon";
import { DUCK_COUNT } from "../subagents";

const POP_W = 260;
const POP_MARGIN = 8;

function duckUrl(n: number): string {
  return `/images/ducks/duck${n}.jpeg`;
}

function clampPos(anchor: DOMRect, popW: number, popH: number) {
  let left = anchor.left;
  if (left + popW + POP_MARGIN > window.innerWidth) {
    left = Math.max(POP_MARGIN, anchor.right - popW);
  }
  left = Math.max(POP_MARGIN, left);
  let top = anchor.bottom + 6;
  if (top + popH + POP_MARGIN > window.innerHeight) {
    top = Math.max(POP_MARGIN, anchor.top - popH - 6);
  }
  return { left, top };
}

interface Props {
  anchorRef: React.RefObject<HTMLElement | null>;
  onPick: (avatar: string) => void;
  /** Upload a picked file path — returns the durable avatar URL/path. */
  onUpload: (path: string) => Promise<string>;
  onClose: () => void;
}

export function AvatarPicker({ anchorRef, onPick, onUpload, onClose }: Props) {
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const [uploading, setUploading] = useState(false);

  useLayoutEffect(() => {
    if (!anchorRef.current) return;
    const anchor = anchorRef.current.getBoundingClientRect();
    const pop = popRef.current?.getBoundingClientRect();
    setPos(clampPos(anchor, pop?.width ?? POP_W, pop?.height ?? 220));
  }, [anchorRef]);

  const upload = async () => {
    try {
      const path = await openDialog({
        multiple: false,
        filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }],
      });
      if (typeof path !== "string") return;
      setUploading(true);
      const avatar = await onUpload(path);
      onPick(avatar);
    } finally {
      setUploading(false);
    }
  };

  return createPortal(
    <>
      <div className="avatar-picker-overlay" onClick={onClose} />
      <div
        ref={popRef}
        className="avatar-picker-pop"
        role="menu"
        style={{ left: pos.left, top: pos.top }}
      >
        <div className="avatar-picker-grid">
          {Array.from({ length: DUCK_COUNT }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              className="avatar-picker-cell"
              onClick={() => onPick(duckUrl(n))}
              title={`Duck ${n}`}
            >
              <img src={duckUrl(n)} alt="" />
            </button>
          ))}
        </div>
        <button
          type="button"
          className="avatar-picker-upload"
          onClick={() => void upload()}
          disabled={uploading}
        >
          <Icon name="upload" size={12} />
          {uploading ? "Uploading…" : "Upload image"}
        </button>
      </div>
    </>,
    document.body,
  );
}
