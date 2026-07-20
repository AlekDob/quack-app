/** Run `fn` after the next paint (double rAF). Returns a cancel function.
 *  Use to defer non-critical mount work so New chat / chat switch can
 *  commit the empty UI before skills/catalog/extension probes start. */
export function afterFirstPaint(fn: () => void): () => void {
  let cancelled = false;
  let inner = 0;
  const outer = requestAnimationFrame(() => {
    inner = requestAnimationFrame(() => {
      if (!cancelled) fn();
    });
  });
  return () => {
    cancelled = true;
    cancelAnimationFrame(outer);
    if (inner) cancelAnimationFrame(inner);
  };
}
