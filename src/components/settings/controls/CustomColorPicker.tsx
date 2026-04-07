import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

// Brain: fix-custom-color-picker-webkit — WKWebView doesn't support <input type="color">

interface CustomColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
  onClose: () => void;
  anchorPos: { x: number; y: number };
}

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const hNorm = h / 360;
  if (s === 0) {
    const v = Math.round(l * 255);
    return `#${v.toString(16).padStart(2, '0').repeat(3)}`;
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = Math.round(hue2rgb(p, q, hNorm + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, hNorm) * 255);
  const b = Math.round(hue2rgb(p, q, hNorm - 1 / 3) * 255);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function isValidHex(hex: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(hex);
}

const PICKER_WIDTH = 240;
const PICKER_HEIGHT = 220; // approximate total height

export default function CustomColorPicker({ value, onChange, onClose, anchorPos }: CustomColorPickerProps) {
  const [hsl, setHsl] = useState(() => hexToHsl(value));
  const [hexInput, setHexInput] = useState(value);
  const hueBarRef = useRef<HTMLDivElement>(null);
  const slBarRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const isDraggingHue = useRef(false);
  const isDraggingSl = useRef(false);

  // Compute fixed position: above anchor, centered horizontally
  const computeStyle = (): React.CSSProperties => {
    let left = anchorPos.x - PICKER_WIDTH / 2;
    let top = anchorPos.y - PICKER_HEIGHT - 12;
    // Clamp to viewport
    left = Math.max(8, Math.min(left, window.innerWidth - PICKER_WIDTH - 8));
    if (top < 8) top = anchorPos.y + 80; // flip below if no space above
    return { position: 'fixed', left, top, zIndex: 10000 };
  };

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Use setTimeout to avoid the same click that opened it from closing it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const applyHsl = useCallback((h: number, s: number, l: number) => {
    setHsl([h, s, l]);
    const hex = hslToHex(h, s, l);
    setHexInput(hex);
    onChange(hex);
  }, [onChange]);

  const handleHueInteraction = useCallback((clientX: number) => {
    const bar = hueBarRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const h = (x / rect.width) * 360;
    applyHsl(h, hsl[1], hsl[2]);
  }, [hsl, applyHsl]);

  const handleSlInteraction = useCallback((clientX: number, clientY: number) => {
    const bar = slBarRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(clientY - rect.top, rect.height));
    const s = x / rect.width;
    const l = 1 - y / rect.height;
    applyHsl(hsl[0], s, l);
  }, [hsl, applyHsl]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingHue.current) handleHueInteraction(e.clientX);
      if (isDraggingSl.current) handleSlInteraction(e.clientX, e.clientY);
    };
    const handleMouseUp = () => {
      isDraggingHue.current = false;
      isDraggingSl.current = false;
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleHueInteraction, handleSlInteraction]);

  const handleHexChange = (raw: string) => {
    setHexInput(raw);
    const hex = raw.startsWith('#') ? raw : `#${raw}`;
    if (isValidHex(hex)) {
      const newHsl = hexToHsl(hex);
      setHsl(newHsl);
      onChange(hex);
    }
  };

  const picker = (
    <div className="custom-color-picker" ref={pickerRef} style={computeStyle()}>
      {/* Saturation/Lightness area */}
      <div
        className="ccp-sl-area"
        ref={slBarRef}
        style={{ background: `hsl(${hsl[0]}, 100%, 50%)` }}
        onMouseDown={(e) => {
          isDraggingSl.current = true;
          handleSlInteraction(e.clientX, e.clientY);
        }}
      >
        <div className="ccp-sl-white" />
        <div className="ccp-sl-black" />
        <div
          className="ccp-sl-cursor"
          style={{
            left: `${hsl[1] * 100}%`,
            top: `${(1 - hsl[2]) * 100}%`,
            borderColor: hsl[2] > 0.5 ? '#333' : '#fff',
          }}
        />
      </div>

      {/* Hue bar */}
      <div
        className="ccp-hue-bar"
        ref={hueBarRef}
        onMouseDown={(e) => {
          isDraggingHue.current = true;
          handleHueInteraction(e.clientX);
        }}
      >
        <div
          className="ccp-hue-cursor"
          style={{ left: `${(hsl[0] / 360) * 100}%` }}
        />
      </div>

      {/* Hex input + preview */}
      <div className="ccp-footer">
        <div
          className="ccp-preview"
          style={{ background: isValidHex(hexInput) ? hexInput : value }}
        />
        <input
          className="ccp-hex-input"
          type="text"
          value={hexInput}
          onChange={(e) => handleHexChange(e.target.value)}
          spellCheck={false}
          maxLength={7}
          placeholder="#ff6b35"
        />
      </div>
    </div>
  );

  return createPortal(picker, document.body);
}
