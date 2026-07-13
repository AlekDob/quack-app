import { useTypewriterReveal } from "../useTypewriterReveal";

/** Live assistant tail — smooth char reveal + inline caret. */
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
  return (
    <div className="ai-stream-plain">
      <span className="ai-stream-plain-text">
        {visible}
        {showCaret && active ? (
          <span className="ai-stream-caret" aria-hidden="true" />
        ) : null}
      </span>
    </div>
  );
}
