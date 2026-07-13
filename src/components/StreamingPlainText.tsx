/** Live assistant tail — plain text while tokens arrive (no markdown parse). */
export function StreamingPlainText({
  text,
  showCaret = true,
}: {
  text: string;
  showCaret?: boolean;
}) {
  return (
    <div className="ai-stream-plain">
      <span className="ai-stream-plain-text">{text}</span>
      {showCaret ? (
        <span className="ai-stream-caret" aria-hidden="true" />
      ) : null}
    </div>
  );
}
