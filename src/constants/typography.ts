/**
 * Typography constants and CSS variable application.
 * Single source of truth for font size presets and font family options.
 */

export type FontSizePreset = 'S' | 'M' | 'L' | 'XL';

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

/** Preset definitions — M matches current hardcoded defaults */
export const FONT_SIZE_PRESETS: Record<FontSizePreset, FontSizeScale> = {
  S:  { body: 11, userMsg: 12, h1: 13, h2: 12, h4: 10, h6: 9,  code: 10, small: 9,  terminal: 12 },
  M:  { body: 12, userMsg: 13, h1: 14, h2: 13, h4: 11, h6: 10, code: 11, small: 10, terminal: 14 },
  L:  { body: 14, userMsg: 15, h1: 16, h2: 15, h4: 13, h6: 12, code: 13, small: 12, terminal: 16 },
  XL: { body: 16, userMsg: 17, h1: 18, h2: 17, h4: 15, h6: 14, code: 15, small: 14, terminal: 18 },
};

export const PRESET_LABELS: Record<FontSizePreset, string> = {
  S: 'Small',
  M: 'Medium',
  L: 'Large',
  XL: 'Extra Large',
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
  fontFamilyUI: string;
  fontFamilyMono: string;
}

export const DEFAULT_TYPOGRAPHY: TypographySettings = {
  fontSizePreset: 'M',
  fontFamilyUI: DEFAULT_FONT_UI,
  fontFamilyMono: DEFAULT_FONT_MONO,
};

/** Apply typography CSS variables on :root — instant cascade, no re-renders */
export function applyTypography(settings: TypographySettings): void {
  const root = document.documentElement;
  const sizes = FONT_SIZE_PRESETS[settings.fontSizePreset];

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
