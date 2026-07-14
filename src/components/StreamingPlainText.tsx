import { useMemo } from "react";
import { useTypewriterReveal } from "../useTypewriterReveal";
import { formatStreamInline } from "../streamInlineFormat";

/** Live assistant tail — smooth char reveal + light inline markdown + caret. */
export function StreamingPlainText({
  text,
  showCaret = true,
  active = true,
}: {
  text: string;
  showCaret?: boolean;
  active?: boolean;
}) {
  const visible = useTypewriterReveal(text, active);
  const html = useMemo(() => formatStreamInline(visible), [visible]);
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
}
