import { memo, useMemo } from "react";
import { formatStreamInline } from "../streamInlineFormat";

/** Live assistant tail — stream painter already coalesces to ~1 paint/frame.
 *  Char-by-char typewriter was dropped: it added a second rAF/setState storm
 *  on top of streaming and made the UI feel heavy during agent runs. */
export const StreamingPlainText = memo(function StreamingPlainText({
  text,
  showCaret = true,
  active = true,
}: {
  text: string;
  showCaret?: boolean;
  active?: boolean;
}) {
  const html = useMemo(() => formatStreamInline(text), [text]);
  return (
    <div className="ai-stream-plain">
      <span className="ai-stream-plain-text">
        <span
          className="ai-stream-plain-md"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        {showCaret && active ? (
          <span className="ai-stream-caret" aria-hidden="true" />
        ) : null}
      </span>
    </div>
  );
});
