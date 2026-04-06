/**
 * Accent Color System
 * Converts a single hex color into a full set of CSS variables
 * applied to :root for theming the entire app.
 */

export const DEFAULT_ACCENT = '#f28c52';

export interface AccentPreset {
  label: string;
  hex: string;
}

// Curated palette that works well with dark theme
export const ACCENT_PRESETS: AccentPreset[] = [
  { label: 'Quack Orange', hex: '#f28c52' },
  { label: 'Electric Blue', hex: '#3b82f6' },
  { label: 'Emerald', hex: '#10b981' },
  { label: 'Violet', hex: '#8b5cf6' },
  { label: 'Rose', hex: '#f43f5e' },
  { label: 'Amber', hex: '#f59e0b' },
  { label: 'Cyan', hex: '#06b6d4' },
  { label: 'Fuchsia', hex: '#d946ef' },
  { label: 'Lime', hex: '#84cc16' },
  { label: 'Sky', hex: '#0ea5e9' },
];

/** Parse hex (#rrggbb or #rgb) to [r, g, b] */
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/** Darken a color by a percentage (0-1) */
function darken(rgb: [number, number, number], amount: number): [number, number, number] {
  return rgb.map(c => Math.round(c * (1 - amount))) as [number, number, number];
}

/** Lighten a color by mixing with white */
function lighten(rgb: [number, number, number], amount: number): [number, number, number] {
  return rgb.map(c => Math.round(c + (255 - c) * amount)) as [number, number, number];
}

/** Convert RGB tuple to hex string */
function rgbToHex(rgb: [number, number, number]): string {
  return '#' + rgb.map(c => c.toString(16).padStart(2, '0')).join('');
}

/**
 * Apply accent color to CSS custom properties on :root.
 * Call this on app startup (from persisted state) and on color change.
 */
export function applyAccentColor(hex: string): void {
  const rgb = hexToRgb(hex);
  const darkRgb = darken(rgb, 0.25);
  const lightRgb = lighten(rgb, 0.75);
  const root = document.documentElement;

  root.style.setProperty('--accent-color', hex);
  root.style.setProperty('--accent-rgb', rgb.join(', '));
  root.style.setProperty('--accent-surface', `rgba(${rgb.join(', ')}, 0.10)`);
  root.style.setProperty('--accent-surface-strong', `rgba(${rgb.join(', ')}, 0.20)`);
  root.style.setProperty('--accent-border', `rgba(${rgb.join(', ')}, 0.25)`);
  root.style.setProperty('--accent-text', rgbToHex(lightRgb));
  root.style.setProperty('--accent-gradient-end', rgbToHex(darkRgb));
  root.style.setProperty('--accent-hover', rgbToHex(lighten(rgb, 0.15)));
}
