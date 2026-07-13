/** Coalesce high-frequency streaming UI commits to one paint per frame. */
export function createStreamPainter(onPaint: () => void) {
  let raf = 0;
  return {
    schedule() {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        onPaint();
      });
    },
    flush() {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      onPaint();
    },
    cancel() {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    },
  };
}
