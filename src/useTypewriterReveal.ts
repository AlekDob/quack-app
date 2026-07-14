import { useCallback, useEffect, useRef, useState } from "react";
import { charsToReveal } from "./typewriterReveal";

/** Reveal `target` char-by-char; absorbs bursty CLI deltas smoothly. */
export function useTypewriterReveal(target: string, active = true): string {
  const [visible, setVisible] = useState("");
  const posRef = useRef(0);
  const rafRef = useRef(0);
  const lastAtRef = useRef(0);
  const targetRef = useRef(target);
  targetRef.current = target;

  const cancelLoop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    lastAtRef.current = 0;
  }, []);

  const schedule = useCallback(() => {
    if (rafRef.current) return;

    const frame = (time: number) => {
      rafRef.current = 0;
      const full = targetRef.current;
      const lag = full.length - posRef.current;
      if (lag <= 0) return;

      if (!lastAtRef.current) lastAtRef.current = time;
      const step = charsToReveal(lag, time - lastAtRef.current);
      if (step <= 0) {
        rafRef.current = requestAnimationFrame(frame);
        return;
      }
      posRef.current = Math.min(full.length, posRef.current + step);
      lastAtRef.current = time;
      const next = full.slice(0, posRef.current);
      setVisible((prev) => (prev === next ? prev : next));
      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (target.length >= posRef.current) return;
    posRef.current = 0;
    setVisible("");
    cancelLoop();
  }, [target, cancelLoop]);

  useEffect(() => {
    if (!active) {
      cancelLoop();
      posRef.current = targetRef.current.length;
      setVisible(targetRef.current);
      return;
    }
    schedule();
    return cancelLoop;
  }, [active, schedule, cancelLoop]);

  useEffect(() => {
    if (!active) return;
    if (target.length > posRef.current) schedule();
  }, [target, active, schedule]);

  return active ? visible : target;
}
