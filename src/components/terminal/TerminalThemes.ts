/**
 * Terminal Theme Definitions
 *
 * Collection of popular terminal color schemes for XTerm.js
 * Each theme includes full 16-color ANSI palette + UI colors
 */

import type { ITheme } from '@xterm/xterm';

export type TerminalThemeName =
  | 'dracula'
  | 'tokyo-night'
  | 'one-dark'
  | 'catppuccin-mocha'
  | 'nord'
  | 'gruvbox-dark'
  | 'solarized-dark'
  | 'github-dark'
  | 'monokai'
  | 'default';

/**
 * Terminal theme definition with metadata
 */
export interface TerminalTheme {
  name: TerminalThemeName;
  label: string;
  description: string;
  colors: ITheme;
}

/**
 * Dracula Theme
 * https://draculatheme.com/
 */
const draculaTheme: ITheme = {
  background: '#282a36',
  foreground: '#f8f8f2',
  cursor: '#f8f8f2',
  cursorAccent: '#282a36',
  selectionBackground: '#44475a',
  black: '#21222c',
  red: '#ff5555',
  green: '#50fa7b',
  yellow: '#f1fa8c',
  blue: '#bd93f9',
  magenta: '#ff79c6',
  cyan: '#8be9fd',
  white: '#f8f8f2',
  brightBlack: '#6272a4',
  brightRed: '#ff6e6e',
  brightGreen: '#69ff94',
  brightYellow: '#ffffa5',
  brightBlue: '#d6acff',
  brightMagenta: '#ff92df',
  brightCyan: '#a4ffff',
  brightWhite: '#ffffff',
};

/**
 * Tokyo Night Theme
 * https://github.com/enkia/tokyo-night-vscode-theme
 */
const tokyoNightTheme: ITheme = {
  background: '#1a1b26',
  foreground: '#a9b1d6',
  cursor: '#c0caf5',
  cursorAccent: '#1a1b26',
  selectionBackground: '#33467c',
  black: '#15161e',
  red: '#f7768e',
  green: '#9ece6a',
  yellow: '#e0af68',
  blue: '#7aa2f7',
  magenta: '#bb9af7',
  cyan: '#7dcfff',
  white: '#a9b1d6',
  brightBlack: '#414868',
  brightRed: '#f7768e',
  brightGreen: '#9ece6a',
  brightYellow: '#e0af68',
  brightBlue: '#7aa2f7',
  brightMagenta: '#bb9af7',
  brightCyan: '#7dcfff',
  brightWhite: '#c0caf5',
};

/**
 * One Dark Theme (Atom)
 * https://github.com/atom/atom/tree/master/packages/one-dark-syntax
 */
const oneDarkTheme: ITheme = {
  background: '#282c34',
  foreground: '#abb2bf',
  cursor: '#528bff',
  cursorAccent: '#282c34',
  selectionBackground: '#3e4451',
  black: '#282c34',
  red: '#e06c75',
  green: '#98c379',
  yellow: '#e5c07b',
  blue: '#61afef',
  magenta: '#c678dd',
  cyan: '#56b6c2',
  white: '#abb2bf',
  brightBlack: '#5c6370',
  brightRed: '#e06c75',
  brightGreen: '#98c379',
  brightYellow: '#e5c07b',
  brightBlue: '#61afef',
  brightMagenta: '#c678dd',
  brightCyan: '#56b6c2',
  brightWhite: '#ffffff',
};

/**
 * Catppuccin Mocha Theme
 * https://github.com/catppuccin/catppuccin
 */
const catppuccinMochaTheme: ITheme = {
  background: '#1e1e2e',
  foreground: '#cdd6f4',
  cursor: '#f5e0dc',
  cursorAccent: '#1e1e2e',
  selectionBackground: '#585b70',
  black: '#45475a',
  red: '#f38ba8',
  green: '#a6e3a1',
  yellow: '#f9e2af',
  blue: '#89b4fa',
  magenta: '#f5c2e7',
  cyan: '#94e2d5',
  white: '#bac2de',
  brightBlack: '#585b70',
  brightRed: '#f38ba8',
  brightGreen: '#a6e3a1',
  brightYellow: '#f9e2af',
  brightBlue: '#89b4fa',
  brightMagenta: '#f5c2e7',
  brightCyan: '#94e2d5',
  brightWhite: '#a6adc8',
};

/**
 * Nord Theme
 * https://www.nordtheme.com/
 */
const nordTheme: ITheme = {
  background: '#2e3440',
  foreground: '#d8dee9',
  cursor: '#d8dee9',
  cursorAccent: '#2e3440',
  selectionBackground: '#434c5e',
  black: '#3b4252',
  red: '#bf616a',
  green: '#a3be8c',
  yellow: '#ebcb8b',
  blue: '#81a1c1',
  magenta: '#b48ead',
  cyan: '#88c0d0',
  white: '#e5e9f0',
  brightBlack: '#4c566a',
  brightRed: '#bf616a',
  brightGreen: '#a3be8c',
  brightYellow: '#ebcb8b',
  brightBlue: '#81a1c1',
  brightMagenta: '#b48ead',
  brightCyan: '#8fbcbb',
  brightWhite: '#eceff4',
};

/**
 * Gruvbox Dark Theme
 * https://github.com/morhetz/gruvbox
 */
const gruvboxDarkTheme: ITheme = {
  background: '#282828',
  foreground: '#ebdbb2',
  cursor: '#ebdbb2',
  cursorAccent: '#282828',
  selectionBackground: '#504945',
  black: '#282828',
  red: '#cc241d',
  green: '#98971a',
  yellow: '#d79921',
  blue: '#458588',
  magenta: '#b16286',
  cyan: '#689d6a',
  white: '#a89984',
  brightBlack: '#928374',
  brightRed: '#fb4934',
  brightGreen: '#b8bb26',
  brightYellow: '#fabd2f',
  brightBlue: '#83a598',
  brightMagenta: '#d3869b',
  brightCyan: '#8ec07c',
  brightWhite: '#ebdbb2',
};

/**
 * Solarized Dark Theme
 * https://ethanschoonover.com/solarized/
 */
const solarizedDarkTheme: ITheme = {
  background: '#002b36',
  foreground: '#839496',
  cursor: '#839496',
  cursorAccent: '#002b36',
  selectionBackground: '#073642',
  black: '#073642',
  red: '#dc322f',
  green: '#859900',
  yellow: '#b58900',
  blue: '#268bd2',
  magenta: '#d33682',
  cyan: '#2aa198',
  white: '#eee8d5',
  brightBlack: '#002b36',
  brightRed: '#cb4b16',
  brightGreen: '#586e75',
  brightYellow: '#657b83',
  brightBlue: '#839496',
  brightMagenta: '#6c71c4',
  brightCyan: '#93a1a1',
  brightWhite: '#fdf6e3',
};

/**
 * GitHub Dark Theme
 * https://github.com/primer/github-vscode-theme
 */
const githubDarkTheme: ITheme = {
  background: '#0d1117',
  foreground: '#c9d1d9',
  cursor: '#c9d1d9',
  cursorAccent: '#0d1117',
  selectionBackground: '#264f78',
  black: '#484f58',
  red: '#ff7b72',
  green: '#3fb950',
  yellow: '#d29922',
  blue: '#58a6ff',
  magenta: '#bc8cff',
  cyan: '#39c5cf',
  white: '#b1bac4',
  brightBlack: '#6e7681',
  brightRed: '#ffa198',
  brightGreen: '#56d364',
  brightYellow: '#e3b341',
  brightBlue: '#79c0ff',
  brightMagenta: '#d2a8ff',
  brightCyan: '#56d4dd',
  brightWhite: '#f0f6fc',
};

/**
 * Monokai Theme
 * https://monokai.pro/
 */
const monokaiTheme: ITheme = {
  background: '#272822',
  foreground: '#f8f8f2',
  cursor: '#f8f8f0',
  cursorAccent: '#272822',
  selectionBackground: '#49483e',
  black: '#272822',
  red: '#f92672',
  green: '#a6e22e',
  yellow: '#f4bf75',
  blue: '#66d9ef',
  magenta: '#ae81ff',
  cyan: '#a1efe4',
  white: '#f8f8f2',
  brightBlack: '#75715e',
  brightRed: '#f92672',
  brightGreen: '#a6e22e',
  brightYellow: '#f4bf75',
  brightBlue: '#66d9ef',
  brightMagenta: '#ae81ff',
  brightCyan: '#a1efe4',
  brightWhite: '#f9f8f5',
};

/**
 * Default Quack Theme (current green theme)
 */
const defaultTheme: ITheme = {
  background: '#000000',
  foreground: '#00ff00',
  cursor: '#00ff00',
  cursorAccent: '#000000',
  selectionBackground: 'rgba(0, 255, 0, 0.3)',
  black: '#000000',
  red: '#cd0000',
  green: '#00cd00',
  yellow: '#cdcd00',
  blue: '#0000ee',
  magenta: '#cd00cd',
  cyan: '#00cdcd',
  white: '#e5e5e5',
  brightBlack: '#7f7f7f',
  brightRed: '#ff0000',
  brightGreen: '#00ff00',
  brightYellow: '#ffff00',
  brightBlue: '#5c5cff',
  brightMagenta: '#ff00ff',
  brightCyan: '#00ffff',
  brightWhite: '#ffffff',
};

/**
 * All available terminal themes
 */
export const TERMINAL_THEMES: Record<TerminalThemeName, TerminalTheme> = {
  'dracula': {
    name: 'dracula',
    label: 'Dracula',
    description: 'Dark theme with vibrant purple and pink',
    colors: draculaTheme,
  },
  'tokyo-night': {
    name: 'tokyo-night',
    label: 'Tokyo Night',
    description: 'Dark theme inspired by Tokyo\'s night skyline',
    colors: tokyoNightTheme,
  },
  'one-dark': {
    name: 'one-dark',
    label: 'One Dark',
    description: 'Atom\'s iconic One Dark theme',
    colors: oneDarkTheme,
  },
  'catppuccin-mocha': {
    name: 'catppuccin-mocha',
    label: 'Catppuccin Mocha',
    description: 'Soothing pastel theme for the high-spirited',
    colors: catppuccinMochaTheme,
  },
  'nord': {
    name: 'nord',
    label: 'Nord',
    description: 'Arctic, north-bluish color palette',
    colors: nordTheme,
  },
  'gruvbox-dark': {
    name: 'gruvbox-dark',
    label: 'Gruvbox Dark',
    description: 'Retro groove color scheme',
    colors: gruvboxDarkTheme,
  },
  'solarized-dark': {
    name: 'solarized-dark',
    label: 'Solarized Dark',
    description: 'Precision colors for machines and people',
    colors: solarizedDarkTheme,
  },
  'github-dark': {
    name: 'github-dark',
    label: 'GitHub Dark',
    description: 'GitHub\'s dark color scheme',
    colors: githubDarkTheme,
  },
  'monokai': {
    name: 'monokai',
    label: 'Monokai',
    description: 'Smooth color scheme for code editors',
    colors: monokaiTheme,
  },
  'default': {
    name: 'default',
    label: 'Classic Green',
    description: 'Classic terminal green on black',
    colors: defaultTheme,
  },
};

/**
 * Get theme by name (with fallback to default)
 */
export function getTerminalTheme(name: TerminalThemeName): TerminalTheme {
  return TERMINAL_THEMES[name] || TERMINAL_THEMES.default;
}

/**
 * Get all theme names for selection UI
 */
export function getThemeNames(): TerminalThemeName[] {
  return Object.keys(TERMINAL_THEMES) as TerminalThemeName[];
}

/**
 * Get all themes as array for selection UI
 */
export function getAllThemes(): TerminalTheme[] {
  return Object.values(TERMINAL_THEMES);
}
