import { memo, useMemo } from "react";
import { formatStreamInline } from "../streamInlineFormat";

/** Live assistant tail — stream painter already coalesces to ~1 paint/frame.
 *  No typewriter reveal and no pulsing caret (both added main-thread /
 *  animation cost without helping readability). */
export const StreamingPlainText = memo(function StreamingPlainText({
  text,
}: {
  text: string;
}) {
  const html = useMemo(() => formatStreamInline(text), [text]);
  return (
    <div className="ai-stream-plain">
      <span className="ai-stream-plain-text">
        <span
          className="ai-stream-plain-md"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </span>
    </div>
  );
});
