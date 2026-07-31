import { useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
import { buildComposerHighlightHtml } from "../composerInputHighlight";
import { fitComposerInputHeight } from "../composerTextareaFit";

type Props = {
  text: string;
  skillNames: string[];
  featureSlug: string | null;
  /** Workspace-relative paths for `@rel` file cites (colored like chat file links). */
  fileRels?: string[];
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  children: ReactNode;
};

/** Mirror layer behind a transparent textarea — colors /skills, @features, @files. */
export function ComposerInputHighlight({
  text,
  skillNames,
  featureSlug,
  fileRels = [],
  textareaRef,
  children,
}: Props) {
  const backRef = useRef<HTMLDivElement>(null);
  const html = buildComposerHighlightHtml(
    text,
    skillNames,
    featureSlug,
    fileRels,
  );

  // Fit on every value change — including programmatic clears (send, queue,
  // history recall, session switch). onChange-only resize left height stuck.
  useLayoutEffect(() => {
    const ta = textareaRef.current;
    if (ta) fitComposerInputHeight(ta);
  }, [textareaRef, text]);

  useLayoutEffect(() => {
    const ta = textareaRef.current;
    const back = backRef.current;
    if (!ta || !back) return;
    const sync = () => {
      back.scrollTop = ta.scrollTop;
      back.scrollLeft = ta.scrollLeft;
    };
    sync();
    ta.addEventListener("scroll", sync);
    return () => ta.removeEventListener("scroll", sync);
  }, [textareaRef, text]);

  return (
    <div className="ai-input-highlight-wrap">
      <div
        ref={backRef}
        className="ai-input-highlight-backdrop"
        aria-hidden
        dangerouslySetInnerHTML={{ __html: html || "\u00a0" }}
      />
      {children}
    </div>
  );
}
