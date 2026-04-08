/**
 * Typography constants and CSS variable application.
 * Single source of truth for font size presets and font family options.
 */

export type FontSizePreset = 'S' | 'M' | 'L' | 'XL' | 'C';

interface FontSizeScale {
  body: number;
  userMsg: number;
  h1: number;
  h2: number;
  h4: number;
  h6: number;
  code: number;
  small: number;
  terminal: number;
}

/** Fixed presets — 'C' (Custom) uses buildCustomScale() instead */
export type FixedPreset = Exclude<FontSizePreset, 'C'>;

/** Preset definitions — M bumped +2px for premium minimal feel (was S-sized before redesign) */
export const FONT_SIZE_PRESETS: Record<FixedPreset, FontSizeScale> = {
  S:  { body: 11, userMsg: 12, h1: 13, h2: 12, h4: 10, h6: 9,  code: 10, small: 9,  terminal: 11 },
  M:  { body: 13, userMsg: 14, h1: 15, h2: 14, h4: 11, h6: 10, code: 11, small: 10, terminal: 13 },
  L:  { body: 15, userMsg: 16, h1: 18, h2: 16, h4: 13, h6: 12, code: 13, small: 12, terminal: 16 },
  XL: { body: 16, userMsg: 17, h1: 20, h2: 18, h4: 14, h6: 13, code: 14, small: 13, terminal: 18 },
};

/** Build a proportional font scale from a custom base size (same offsets as M preset) */
export function buildCustomScale(basePx: number): FontSizeScale {
  return {
    body: basePx,
    userMsg: basePx + 1,
    h1: basePx + 2,
    h2: basePx + 1,
    h4: basePx - 2,
    h6: basePx - 3,
    code: basePx - 2,
    small: basePx - 3,
    terminal: basePx,
  };
}

export const DEFAULT_CUSTOM_FONT_SIZE = 13;
export const MIN_CUSTOM_FONT_SIZE = 10;
export const MAX_CUSTOM_FONT_SIZE = 22;

export const PRESET_LABELS: Record<FontSizePreset, string> = {
  S: 'Small',
  M: 'Medium',
  L: 'Large',
  XL: 'Extra Large',
  C: 'Custom',
};

export interface FontOption {
  label: string;
  value: string;
}

/** System UI font options — zero network requests */
export const UI_FONT_OPTIONS: FontOption[] = [
  { label: 'General Sans', value: "'General Sans', 'Inter', system-ui, sans-serif" },
  { label: 'Inter', value: "'Inter', 'General Sans', system-ui, sans-serif" },
  { label: 'SF Pro', value: "'SF Pro Display', 'SF Pro', -apple-system, system-ui, sans-serif" },
  { label: 'Segoe UI', value: "'Segoe UI', 'Inter', system-ui, sans-serif" },
  { label: 'System Default', value: "system-ui, -apple-system, 'Segoe UI', sans-serif" },
];

/** Monospace font options for code/terminal */
export const MONO_FONT_OPTIONS: FontOption[] = [
  { label: 'JetBrains Mono', value: "'JetBrains Mono', 'Fira Code', monospace" },
  { label: 'IBM Plex Mono', value: "'IBM Plex Mono', 'JetBrains Mono', monospace" },
  { label: 'Fira Code', value: "'Fira Code', 'JetBrains Mono', monospace" },
  { label: 'SF Mono', value: "'SF Mono', 'Monaco', 'Menlo', monospace" },
  { label: 'Menlo', value: "'Menlo', 'Monaco', 'Consolas', monospace" },
  { label: 'System Monospace', value: "ui-monospace, 'Cascadia Code', 'Consolas', monospace" },
];

export const DEFAULT_FONT_UI = UI_FONT_OPTIONS[0].value;
export const DEFAULT_FONT_MONO = MONO_FONT_OPTIONS[0].value;

export interface TypographySettings {
  fontSizePreset: FontSizePreset;
  customFontSize: number;
  fontFamilyUI: string;
  fontFamilyMono: string;
}

export const DEFAULT_TYPOGRAPHY: TypographySettings = {
  fontSizePreset: 'M',
  customFontSize: DEFAULT_CUSTOM_FONT_SIZE,
  fontFamilyUI: DEFAULT_FONT_UI,
  fontFamilyMono: DEFAULT_FONT_MONO,
};

/** Safe accessor for customFontSize — guards against undefined/NaN from stale persisted state */
export function safeCustomSize(raw: number | undefined): number {
  if (raw == null || Number.isNaN(raw)) return DEFAULT_CUSTOM_FONT_SIZE;
  return Math.max(MIN_CUSTOM_FONT_SIZE, Math.min(MAX_CUSTOM_FONT_SIZE, raw));
}

/** Resolve font sizes — uses custom scale for 'C' preset, fixed presets otherwise */
export function resolveScale(settings: TypographySettings): FontSizeScale {
  if (settings.fontSizePreset === 'C') {
    return buildCustomScale(safeCustomSize(settings.customFontSize));
  }
  return FONT_SIZE_PRESETS[settings.fontSizePreset as FixedPreset];
}

/** Apply typography CSS variables on :root — instant cascade, no re-renders */
export function applyTypography(settings: TypographySettings): void {
  const root = document.documentElement;
  const sizes = resolveScale(settings);

  // Font families
  root.style.setProperty('--font-ui', settings.fontFamilyUI);
  root.style.setProperty('--font-mono', settings.fontFamilyMono);

  // Font sizes
  root.style.setProperty('--fs-body', `${sizes.body}px`);
  root.style.setProperty('--fs-user-msg', `${sizes.userMsg}px`);
  root.style.setProperty('--fs-h1', `${sizes.h1}px`);
  root.style.setProperty('--fs-h2', `${sizes.h2}px`);
  root.style.setProperty('--fs-h4', `${sizes.h4}px`);
  root.style.setProperty('--fs-h6', `${sizes.h6}px`);
  root.style.setProperty('--fs-code', `${sizes.code}px`);
  root.style.setProperty('--fs-small', `${sizes.small}px`);
  root.style.setProperty('--fs-terminal', `${sizes.terminal}px`);
}
