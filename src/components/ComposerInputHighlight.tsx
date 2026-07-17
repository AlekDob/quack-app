import { useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
import { buildComposerHighlightHtml } from "../composerInputHighlight";

type Props = {
  text: string;
  skillNames: string[];
  featureSlug: string | null;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  children: ReactNode;
};

/** Mirror layer behind a transparent textarea — colors /skills and @features. */
export function ComposerInputHighlight({
  text,
  skillNames,
  featureSlug,
  textareaRef,
  children,
}: Props) {
  const backRef = useRef<HTMLDivElement>(null);
  const html = buildComposerHighlightHtml(text, skillNames, featureSlug);

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
