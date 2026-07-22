import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  enrichMarkdownWithFileLinks,
  looksLikeOpenableFilePath,
  normalizeFileLinkPath,
} from "../chatFileLinks";
import { onMdPreviewScroll, setEditorGoto } from "../editorState";
import { renderMarkdown } from "../markdown";
import { IS_MACOS } from "../theme";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";

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
  /** Right-click → Reveal in Finder / File Explorer. */
  onFileReveal?: (path: string) => void;
}

const REVEAL_LABEL = IS_MACOS
  ? "Reveal in Finder"
  : "Reveal in File Explorer";

/** Resolve a local file path from an anchor href (`file://`, abs, rel). */
function filePathFromHref(href: string): string | null {
  const h = href.trim();
  if (!h || h === "#") return null;
  if (/^(?:https?|mailto|tel):/i.test(h)) return null;
  if (/^file:/i.test(h)) {
    try {
      return decodeURIComponent(new URL(h).pathname);
    } catch {
      return null;
    }
  }
  if (!looksLikeOpenableFilePath(h)) return null;
  return normalizeFileLinkPath(h);
}

/** Prefer `data-file-link`, else a file-like `href` on the nearest `<a>`. */
function filePathFromTarget(target: HTMLElement): string | null {
  const fileLink = target.closest<HTMLElement>("[data-file-link]");
  const raw = fileLink?.dataset.fileLink;
  if (raw) return raw;
  const a = target.closest("a[href]");
  if (!a) return null;
  return filePathFromHref(a.getAttribute("href") ?? "");
}

function fileLinkMenuItems(
  path: string,
  onFileOpen?: (path: string) => void,
  onFileReveal?: (path: string) => void,
): (ContextMenuItem | "separator")[] {
  const items: (ContextMenuItem | "separator")[] = [];
  if (onFileOpen) {
    items.push({ label: "Open", onClick: () => onFileOpen(path) });
  }
  if (onFileReveal) {
    items.push({
      label: REVEAL_LABEL,
      onClick: () => onFileReveal(path),
    });
  }
  if (items.length) items.push("separator");
  items.push({
    label: "Copy Path",
    onClick: async () => {
      try {
        await navigator.clipboard.writeText(path);
      } catch {
        /* ignore */
      }
    },
  });
  return items;
}

/** Memoized so parent re-renders during streaming don't re-run
 *  renderMarkdown on committed (unchanged) messages. The `content`
 *  prop is a string (value-compared by React.memo) and `onFileOpen`
 *  is stabilized with useCallback in the parent. */
export const MarkdownPreview = memo(function MarkdownPreview({
  content,
  interactive = false,
  onFileOpen,
  onFileReveal,
}: Props) {
  const html = useMemo(() => {
    let out = renderMarkdown(content);
    if (onFileOpen) out = enrichMarkdownWithFileLinks(out);
    return out;
  }, [content, onFileOpen]);
  const ref = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    items: (ContextMenuItem | "separator")[];
  } | null>(null);

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
    const filePath = filePathFromTarget(target);
    if (filePath && onFileOpen) {
      e.preventDefault();
      onFileOpen(filePath);
      return;
    }
    const copyBtn = target.closest<HTMLButtonElement>("[data-md-copy]");
    if (copyBtn) {
      const wrapper = copyBtn.closest(".md-code-block, .md-callout-wrap");
      const code = wrapper?.querySelector("code");
      const callout = wrapper?.querySelector("blockquote");
      const text = code?.textContent ?? callout?.textContent?.trim() ?? "";
      try {
        void navigator.clipboard?.writeText(text);
      } catch {
        // Older / restricted environments — silently no-op.
      }
      copyBtn.classList.add("is-copied");
      copyBtn.setAttribute("aria-label", "Copied");
      copyBtn.title = "Copied";
      window.setTimeout(() => {
        if (!copyBtn.isConnected) return;
        copyBtn.classList.remove("is-copied");
        copyBtn.setAttribute("aria-label", "Copy");
        copyBtn.title = "Copy";
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

  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onFileOpen && !onFileReveal) return;
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const path = filePathFromTarget(target);
    if (!path) return;
    e.preventDefault();
    e.stopPropagation();
    setMenu({
      x: e.clientX,
      y: e.clientY,
      items: fileLinkMenuItems(path, onFileOpen, onFileReveal),
    });
  };

  return (
    <>
      <div
        ref={ref}
        className={`md-preview${interactive ? " md-preview-interactive" : ""}`}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menu.items}
          onClose={() => setMenu(null)}
        />
      )}
    </>
  );
});
