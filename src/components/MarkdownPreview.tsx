import { useEffect, useMemo, useRef } from "react";
import { renderMarkdown } from "../markdown";
import { enrichMarkdownWithFileLinks } from "../chatFileLinks";
import { onMdPreviewScroll, setEditorGoto } from "../editorState";

interface Props {
  content: string;
  /** When true, clicking a rendered block jumps the editor to that
   *  block's source line. Used by the markdown split preview where
   *  the editor and preview share a file. False (default) for chat
   *  bubbles and tool output, where line numbers refer to a file
   *  the user isn't even editing. */
  interactive?: boolean;
  /** When set, `foo.html` / `` `bar.md` `` in the text become links
   *  that open the file in a new editor tab. */
  onFileOpen?: (path: string) => void;
}

export function MarkdownPreview({
  content,
  interactive = false,
  onFileOpen,
}: Props) {
  const html = useMemo(() => {
    let out = renderMarkdown(content);
    if (onFileOpen) out = enrichMarkdownWithFileLinks(out);
    return out;
  }, [content, onFileOpen]);
  const ref = useRef<HTMLDivElement>(null);

  // Editor-driven scroll-sync. Only meaningful in interactive (split)
  // mode; chat-side previews don't have an editor pointing at them.
  // The scrollable ancestor is the .preview-half wrapper from
  // EditorPane (overflow-y: auto), not .md-preview itself, so we walk
  // up looking for the first scrollable parent. Behaviour: jump
  // (not smooth) — scroll-sync should track the editor 1:1 without
  // a lagging animation that breaks the "shared scroll" illusion.
  useEffect(() => {
    if (!interactive) return;
    return onMdPreviewScroll((line) => {
      const root = ref.current;
      if (!root) return;
      const blocks = root.querySelectorAll<HTMLElement>("[data-source-line]");
      if (blocks.length === 0) return;
      let target: HTMLElement | null = null;
      for (const b of blocks) {
        const bl = parseInt(b.dataset.sourceLine ?? "0", 10);
        if (bl > line) break;
        target = b;
      }
      if (!target) return;
      // Find the scrollable ancestor — usually .preview-half.
      let scroller: HTMLElement | null = root.parentElement;
      while (scroller && scroller !== document.body) {
        const overflowY = getComputedStyle(scroller).overflowY;
        if (overflowY === "auto" || overflowY === "scroll") break;
        scroller = scroller.parentElement;
      }
      if (!scroller || scroller === document.body) return;
      // offsetTop of the target is relative to its offsetParent;
      // getBoundingClientRect gives us the absolute screen position
      // which we can convert to a scrollTop on the scroller.
      const targetRect = target.getBoundingClientRect();
      const scrollerRect = scroller.getBoundingClientRect();
      const delta = targetRect.top - scrollerRect.top;
      scroller.scrollTo({
        top: scroller.scrollTop + delta - 8,
        behavior: "auto",
      });
    });
  }, [interactive]);

  // Copy-button click runs on every preview (chat bubbles + split mode);
  // the click-to-jump path is gated on `interactive`. Both share the
  // same delegated listener so we don't pay a per-render listener tax
  // per code block.
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const fileLink = target.closest<HTMLElement>("[data-file-link]");
    if (fileLink && onFileOpen) {
      e.preventDefault();
      const raw = fileLink.dataset.fileLink;
      if (raw) onFileOpen(raw);
      return;
    }
    const copyBtn = target.closest<HTMLButtonElement>("[data-md-copy]");
    if (copyBtn) {
      const wrapper = copyBtn.closest(".md-code-block");
      const code = wrapper?.querySelector("code");
      const text = code?.textContent ?? "";
      // navigator.clipboard is async; we don't await — we just flip the
      // label optimistically. If the write fails (no permission, no
      // secure context), the worst case is a visual "Copied" with
      // nothing on the clipboard, which beats blocking the UI on a
      // promise we have no recovery path for.
      try {
        void navigator.clipboard?.writeText(text);
      } catch {
        // Older / restricted environments — silently no-op.
      }
      const original = copyBtn.textContent;
      copyBtn.textContent = "Copied";
      window.setTimeout(() => {
        // Guard against the node being unmounted/re-rendered: if the
        // text already changed back, leave it alone.
        if (copyBtn.isConnected && copyBtn.textContent === "Copied") {
          copyBtn.textContent = original ?? "Copy";
        }
      }, 1500);
      return;
    }
    if (!interactive) return;
    if (target.closest("input")) return;
    if (target.closest("a") && !target.closest(".md-file-link")) return;
    const el = target.closest<HTMLElement>("[data-source-line]");
    if (!el) return;
    const line = parseInt(el.dataset.sourceLine ?? "0", 10);
    if (line > 0) setEditorGoto(line, 1);
  };

  return (
    <>
      <style>{`
        .md-code-block { position: relative; margin-bottom: 14px; }
        .md-code-copy {
          position: absolute;
          top: 6px;
          right: 8px;
          padding: 2px 8px;
          font-size: 11px;
          line-height: 1.4;
          color: var(--accent, #4ea1ff);
          background: transparent;
          border: 1px solid var(--accent, #4ea1ff);
          border-radius: 3px;
          cursor: pointer;
          opacity: 0;
          transition: opacity 120ms ease;
          font-family: inherit;
        }
        .md-code-block:hover .md-code-copy { opacity: 0.85; }
        .md-code-copy:hover { opacity: 1; }
        .md-code-copy:focus-visible { opacity: 1; outline: none; }
      `}</style>
      <div
        ref={ref}
        className={`md-preview${interactive ? " md-preview-interactive" : ""}`}
        onClick={handleClick}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </>
  );
}
