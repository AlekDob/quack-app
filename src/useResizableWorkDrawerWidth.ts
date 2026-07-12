import { useCallback, useRef, useState } from "react";
import {
  clampWorkDrawerWidth,
  getWorkDrawerWidth,
  setWorkDrawerWidth,
} from "./workDrawerWidth";

export function useResizableWorkDrawerWidth(): {
  width: number;
  onResizeDown: (e: React.MouseEvent) => void;
} {
  const [width, setWidth] = useState(() => getWorkDrawerWidth());
  const widthRef = useRef(width);
  widthRef.current = width;

  const onResizeDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = widthRef.current;
    const onMove = (ev: MouseEvent) => {
      setWidth(clampWorkDrawerWidth(startW - (ev.clientX - startX)));
    };
    const onUp = () => {
      setWorkDrawerWidth(widthRef.current);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  return { width, onResizeDown };
}
