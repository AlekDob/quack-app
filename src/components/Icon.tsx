import type { ReactNode } from "react";

// Lightweight SVG icon registry — replaces the emoji affordances that
// were scattered across the UI (📁 📂 🔍 ⎇ ⏱ ☀ 🌙 ⚙ etc.). Three reasons
// to standardize:
//
//   1. Emoji rendering varies wildly across platforms / fonts. The same
//      "branch" glyph shows as a tree icon on macOS, a fork on Windows,
//      and sometimes literal "⎇" with no graphical fallback at all on
//      bare Linux. SVGs render identically everywhere.
//   2. Emojis don't recolor. Buttons that switch between active /
//      inactive / disabled need icons that follow currentColor; emoji
//      stays its native colour and looks wrong on accent backgrounds.
//   3. Sizing emojis below ~14px breaks anti-aliasing on most platforms.
//      SVG paths scale crisply at any size.
//
// Each icon is defined inline — no dependency on lucide-react or any
// other library, which keeps the bundle small. The path data is in the
// stroke style that matches VS Code's own icons, so the visual language
// is consistent with what users expect from a code editor.

interface IconProps {
  name: IconName;
  /** Pixel size of the bounding square. Defaults to 16. */
  size?: number;
  /** Optional className passed to the root <svg>. */
  className?: string;
  /** Optional title; pass an aria-hidden parent for purely decorative
   *  icons sitting next to a labeled element. */
  title?: string;
}

export type IconName =
  | "folder"
  | "folder-open"
  | "file"
  | "search"
  | "git-branch"
  | "play"
  | "check-square"
  | "cloud"
  | "settings"
  | "save"
  | "save-auto"
  | "terminal"
  | "panel-bottom"
  | "command"
  | "sun"
  | "moon"
  | "monitor"
  | "close"
  | "refresh"
  | "chevron-down"
  | "chevron-right"
  | "chevron-up"
  | "chevron-left"
  | "plus"
  | "minus"
  | "rotate-ccw"
  | "branch"
  | "copy"
  | "code"
  | "arrow-down-circle"
  | "arrow-down-right"
  | "external-link"
  | "more-horizontal"
  | "stop"
  | "trash"
  | "edit"
  | "eye"
  | "columns-2"
  | "git-compare"
  | "send"
  | "x"
  | "check"
  | "check-circle"
  | "x-circle"
  | "alert-triangle"
  | "globe"
  | "file-text"
  | "wrench"
  | "upload"
  | "upload-cloud"
  | "download"
  | "eject"
  | "star"
  | "star-filled"
  | "link"
  | "circle"
  | "info"
  | "hash"
  | "braces"
  | "image"
  | "file-code"
  | "lock"
  | "zap"
  | "bot"
  | "whiteboard"
  | "users"
  | "chart-bar"
  | "brain"
  | "store"
  | "arrow-up"
  | "microphone"
  | "grip-vertical"
  | "grip-horizontal";

// Each entry returns the inner JSX for an svg with viewBox 0 0 24 24.
// Use stroke={currentColor} + strokeWidth + strokeLinecap/Linejoin so
// the icons follow the surrounding colour and feel cohesive.
const ICONS: Record<IconName, ReactNode> = {
  folder: (
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
  ),
  "folder-open": (
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1H5l-2 9V7Zm0 11 2-9h17l-2 9H3Z" />
  ),
  file: (
    <>
      <path d="M14 3v5h5" />
      <path d="M19 8 14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  "git-branch": (
    <>
      <line x1="6" y1="3" x2="6" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </>
  ),
  play: (
    <path d="M5 3.5v17l15-8.5-15-8.5Z" />
  ),
  "check-square": (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="m9 12 3 3 7-7" />
    </>
  ),
  cloud: (
    <path d="M17.5 19a4.5 4.5 0 1 0-1-8.9A6 6 0 0 0 3 13.5 4.5 4.5 0 0 0 7.5 19h10Z" />
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </>
  ),
  save: (
    <>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </>
  ),
  "save-auto": (
    <>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </>
  ),
  terminal: (
    <>
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </>
  ),
  "panel-bottom": (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="15" x2="21" y2="15" />
    </>
  ),
  command: (
    <path d="M18 3a3 3 0 1 0 0 6h-3V6a3 3 0 0 0-3-3Zm0 0V6m0 0v3m0 0h3a3 3 0 1 1-3 3m0 0v3m0 0v3a3 3 0 1 1-3-3m0 0h3m0 0h-3m0 0H6a3 3 0 1 1 3-3m0 0V9m0 0V6a3 3 0 1 1 3 3" />
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </>
  ),
  moon: (
    <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />
  ),
  monitor: (
    <>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </>
  ),
  close: (
    <path d="m6 6 12 12M18 6 6 18" />
  ),
  refresh: (
    <>
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <polyline points="21 3 21 8 16 8" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <polyline points="3 21 3 16 8 16" />
    </>
  ),
  "chevron-down": (
    <polyline points="6 9 12 15 18 9" />
  ),
  "chevron-right": (
    <polyline points="9 6 15 12 9 18" />
  ),
  "chevron-up": (
    <polyline points="6 15 12 9 18 15" />
  ),
  "chevron-left": (
    <polyline points="15 6 9 12 15 18" />
  ),
  plus: (
    <path d="M12 5v14M5 12h14" />
  ),
  minus: (
    <path d="M5 12h14" />
  ),
  "rotate-ccw": (
    <>
      <polyline points="3 8 3 3 8 3" />
      <path d="M3 3a9 9 0 1 1-1.5 9.5" />
    </>
  ),
  branch: (
    <>
      <line x1="6" y1="3" x2="6" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
  ),
  code: (
    <>
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </>
  ),
  "arrow-down-circle": (
    <>
      <circle cx="12" cy="12" r="9" />
      <polyline points="8 12 12 16 16 12" />
      <line x1="12" y1="8" x2="12" y2="16" />
    </>
  ),
  "arrow-down-right": (
    <>
      <line x1="6" y1="6" x2="18" y2="18" />
      <polyline points="11 18 18 18 18 11" />
    </>
  ),
  "external-link": (
    <>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </>
  ),
  "more-horizontal": (
    <>
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="5" cy="12" r="1.5" fill="currentColor" />
      <circle cx="19" cy="12" r="1.5" fill="currentColor" />
    </>
  ),
  stop: (
    <rect x="6" y="6" width="12" height="12" rx="1" />
  ),
  trash: (
    <>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </>
  ),
  edit: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s4-8 10-8 10 8 10 8-4 8-10 8-10-8-10-8Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  "columns-2": (
    <>
      <rect x="3" y="4" width="8" height="16" rx="1" />
      <rect x="13" y="4" width="8" height="16" rx="1" />
    </>
  ),
  "git-compare": (
    <>
      <circle cx="6" cy="6" r="3" />
      <circle cx="18" cy="18" r="3" />
      <path d="M8.5 8.5 15.5 15.5" />
      <path d="M15 8.5V6h2.5" />
      <path d="M8.5 15.5H6V18" />
    </>
  ),
  send: (
    <>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </>
  ),
  x: <path d="m6 6 12 12M18 6 6 18" />,
  check: <polyline points="5 12 10 17 19 7" />,
  "check-circle": (
    <>
      <circle cx="12" cy="12" r="9" />
      <polyline points="8 12 11 15 16 9" />
    </>
  ),
  "x-circle": (
    <>
      <circle cx="12" cy="12" r="9" />
      <line x1="9" y1="9" x2="15" y2="15" />
      <line x1="15" y1="9" x2="9" y2="15" />
    </>
  ),
  "alert-triangle": (
    <>
      <path d="M12 3 2 21h20L12 3Z" />
      <line x1="12" y1="10" x2="12" y2="14" />
      <line x1="12" y1="17" x2="12" y2="17.01" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <path d="M12 3a13 13 0 0 1 0 18 13 13 0 0 1 0-18Z" />
    </>
  ),
  "file-text": (
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <polyline points="14 3 14 8 19 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </>
  ),
  wrench: (
    <path d="M14.7 6.3a3.5 3.5 0 0 1 0 4.95l-1.06 1.06 4.6 4.6a2 2 0 0 1-2.83 2.83l-4.6-4.6-1.06 1.06a3.5 3.5 0 0 1-4.95 0L3.7 14.5a3.5 3.5 0 0 1 0-4.95L8.65 4.6a3.5 3.5 0 0 1 4.95 0l1.1 1.7Z" />
  ),
  upload: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </>
  ),
  "upload-cloud": (
    <>
      <polyline points="16 16 12 12 8 16" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
      <polyline points="16 16 12 12 8 16" />
    </>
  ),
  download: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </>
  ),
  eject: (
    <path d="M5 17h14L12 5 5 17Zm0 3h14" />
  ),
  zap: (
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  ),
  star: (
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  ),
  "star-filled": (
    <polygon
      points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
      fill="currentColor"
    />
  ),
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </>
  ),
  circle: <circle cx="12" cy="12" r="9" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="8.01" />
    </>
  ),
  hash: (
    <>
      <line x1="4" y1="9" x2="20" y2="9" />
      <line x1="4" y1="15" x2="20" y2="15" />
      <line x1="10" y1="3" x2="8" y2="21" />
      <line x1="16" y1="3" x2="14" y2="21" />
    </>
  ),
  // Curly braces — data files (JSON, package.json, etc.). Mirror-symmetric
  // paths so the glyph stays visually upright at 14px tree sizes.
  braces: (
    <>
      <path d="M8 3H7a2 2 0 0 0-2 2v2a2 2 0 0 1-2 2 2 2 0 0 1 2 2v2a2 2 0 0 0 2 2h1" />
      <path d="M16 3h1a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2 2 2 0 0 0-2 2v2a2 2 0 0 1-2 2h-1" />
    </>
  ),
  // Picture frame with horizon — raster/vector image files.
  image: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </>
  ),
  // Document sheet with code chevrons — source files.
  "file-code": (
    <>
      <path d="M14 3v5h5" />
      <path d="M19 8 14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <polyline points="10 13 8 15 10 17" />
      <polyline points="14 13 16 15 14 17" />
    </>
  ),
  // Padlock — lock/secret files (yarn.lock, Cargo.lock, .env).
  lock: (
    <>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  // Robot head with antenna + two eyes — a subagent (distinct from the
  // lightning `zap` used for skills).
  bot: (
    <>
      <rect x="4" y="8" width="16" height="12" rx="2" />
      <path d="M12 8V4" />
      <circle cx="12" cy="3" r="1" fill="currentColor" stroke="none" />
      <circle cx="9" cy="14" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="14" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  // Whiteboard with a tiny org-chart (root dot + 2 leaves, connected).
  // Reads as "interactive canvas" — fits the Whiteboard tab purpose.
  whiteboard: (
    <>
      <rect x="3" y="4" width="18" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="14.5" r="1.5" fill="currentColor" stroke="none" />
      <path d="M9 10 12 14.5 15 10" />
      <line x1="9" y1="21" x2="15" y2="21" />
    </>
  ),
  // Two overlapping person silhouettes — the Team tab (agents + subagents).
  users: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <circle cx="10" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  // Three vertical bars of varying height — usage / metrics panel.
  "chart-bar": (
    <>
      <line x1="6" y1="20" x2="6" y2="12" />
      <line x1="12" y1="20" x2="12" y2="6" />
      <line x1="18" y1="20" x2="18" y2="15" />
      <line x1="3" y1="20" x2="21" y2="20" />
    </>
  ),
  // Two-lobe brain — knowledge / Pinky Brain tab (reads at 16–20px).
  brain: (
    <>
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
      <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
    </>
  ),
  // Four tiles — Quack Store extensions sidebar.
  store: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  // Upward arrow — the send affordance (Cursor / spaceship-style composer).
  "arrow-up": (
    <>
      <line x1="12" y1="20" x2="12" y2="5" />
      <polyline points="6 11 12 5 18 11" />
    </>
  ),
  // Microphone — voice dictation toggle in the composer.
  microphone: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M6 11a6 6 0 0 0 12 0" />
      <line x1="12" y1="17" x2="12" y2="21" />
      <line x1="9" y1="21" x2="15" y2="21" />
    </>
  ),
  // Drag handles — six-dot grips for move affordances (dock, panels).
  "grip-vertical": (
    <>
      <circle cx="9" cy="6" r="1.5" fill="currentColor" />
      <circle cx="15" cy="6" r="1.5" fill="currentColor" />
      <circle cx="9" cy="12" r="1.5" fill="currentColor" />
      <circle cx="15" cy="12" r="1.5" fill="currentColor" />
      <circle cx="9" cy="18" r="1.5" fill="currentColor" />
      <circle cx="15" cy="18" r="1.5" fill="currentColor" />
    </>
  ),
  "grip-horizontal": (
    <>
      <circle cx="6" cy="9" r="1.5" fill="currentColor" />
      <circle cx="12" cy="9" r="1.5" fill="currentColor" />
      <circle cx="18" cy="9" r="1.5" fill="currentColor" />
      <circle cx="6" cy="15" r="1.5" fill="currentColor" />
      <circle cx="12" cy="15" r="1.5" fill="currentColor" />
      <circle cx="18" cy="15" r="1.5" fill="currentColor" />
    </>
  ),
};

export function Icon({ name, size = 16, className, title }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      style={{ display: "block", flexShrink: 0 }}
    >
      {title && <title>{title}</title>}
      {ICONS[name]}
    </svg>
  );
}
