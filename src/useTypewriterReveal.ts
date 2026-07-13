import { useEffect, useRef, useState } from "react";
import { charsToReveal } from "./typewriterReveal";

/** Reveal `target` char-by-char; absorbs bursty CLI deltas smoothly. */
export function useTypewriterReveal(target: string, active = true): string {
  const [visible, setVisible] = useState("");
  const posRef = useRef(0);
  const rafRef = useRef(0);
  const lastAtRef = useRef(0);
  const targetRef = useRef(target);
  targetRef.current = target;

  useEffect(() => {
    if (target.length >= posRef.current) return;
    posRef.current = 0;
    setVisible("");
  }, [target]);

  useEffect(() => {
    if (!active) {
      posRef.current = targetRef.current.length;
      setVisible(targetRef.current);
    }
  }, [active]);

  useEffect(() => {
    if (!active) return;

    const frame = (time: number) => {
      const full = targetRef.current;
      const lag = full.length - posRef.current;
      if (lag <= 0) {
        setVisible(full);
        rafRef.current = requestAnimationFrame(frame);
        return;
      }
      if (!lastAtRef.current) lastAtRef.current = time;
      const elapsed = time - lastAtRef.current;
      const step = charsToReveal(lag, elapsed);
      if (step <= 0) {
        rafRef.current = requestAnimationFrame(frame);
        return;
      }
      posRef.current = Math.min(full.length, posRef.current + step);
      lastAtRef.current = time;
      setVisible(full.slice(0, posRef.current));
      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(rafRef.current);
      lastAtRef.current = 0;
    };
  }, [active]);

  return active ? visible : target;
}
