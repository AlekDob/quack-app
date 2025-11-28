import { useCallback } from 'react';
import type { Monaco } from '@monaco-editor/react';

/**
 * Custom Quack dark theme for Monaco Editor
 * Matches the CodeMirror theme used elsewhere in the app
 */
export const QUACK_THEME_NAME = 'quack-dark';

export interface MonacoThemeColors {
  background: string;
  foreground: string;
  selectionBackground: string;
  lineHighlight: string;
  gutterBackground: string;
  gutterForeground: string;
  cursor: string;
}

const defaultColors: MonacoThemeColors = {
  background: '#000000',
  foreground: '#abb2bf',
  selectionBackground: '#434c5e99',
  lineHighlight: '#99bbff0a',
  gutterBackground: '#000000',
  gutterForeground: '#636d83',
  cursor: '#528bff',
};

/**
 * Hook to configure Monaco Editor with Quack dark theme
 */
export function useMonacoTheme(customColors?: Partial<MonacoThemeColors>) {
  const colors = { ...defaultColors, ...customColors };

  const defineTheme = useCallback((monaco: Monaco) => {
    monaco.editor.defineTheme(QUACK_THEME_NAME, {
      base: 'vs-dark',
      inherit: true,
      rules: [
        // Keywords (purple/magenta like VS Code)
        { token: 'keyword', foreground: 'c586c0' },
        { token: 'keyword.control', foreground: 'c586c0' },

        // Variables and identifiers (light blue)
        { token: 'variable', foreground: '9cdcfe' },
        { token: 'variable.parameter', foreground: '9cdcfe' },
        { token: 'identifier', foreground: '9cdcfe' },

        // Strings (muted orange)
        { token: 'string', foreground: 'ce9178' },
        { token: 'string.escape', foreground: 'd7ba7d' },

        // Numbers (muted green)
        { token: 'number', foreground: 'b5cea8' },
        { token: 'number.hex', foreground: 'b5cea8' },

        // Comments (green italic)
        { token: 'comment', foreground: '6a9955', fontStyle: 'italic' },

        // Functions (yellow-gray)
        { token: 'function', foreground: 'dcdcaa' },
        { token: 'function.declaration', foreground: 'dcdcaa' },

        // Types (teal)
        { token: 'type', foreground: '4ec9b0' },
        { token: 'type.identifier', foreground: '4ec9b0' },

        // Constants (light blue)
        { token: 'constant', foreground: '4fc1ff' },

        // Tags (HTML/JSX - muted blue)
        { token: 'tag', foreground: '569cd6' },
        { token: 'tag.attribute.name', foreground: '9cdcfe' },
        { token: 'tag.attribute.value', foreground: 'ce9178' },

        // Operators (light gray)
        { token: 'operator', foreground: 'd4d4d4' },
        { token: 'delimiter', foreground: 'd4d4d4' },

        // Brackets (gold)
        { token: 'bracket', foreground: 'ffd700' },
      ],
      colors: {
        'editor.background': colors.background,
        'editor.foreground': colors.foreground,
        'editor.selectionBackground': colors.selectionBackground,
        'editor.lineHighlightBackground': colors.lineHighlight,
        'editorLineNumber.foreground': colors.gutterForeground,
        'editorLineNumber.activeForeground': colors.foreground,
        'editorGutter.background': colors.gutterBackground,
        'editorCursor.foreground': colors.cursor,

        // Minimap colors
        'minimap.background': '#0a0a0a',
        'minimapSlider.background': '#ffffff15',
        'minimapSlider.hoverBackground': '#ffffff25',
        'minimapSlider.activeBackground': '#ffffff35',

        // Diff colors for minimap and gutter
        'diffEditor.insertedTextBackground': '#22c55e20',
        'diffEditor.removedTextBackground': '#ef444420',
        'editorGutter.addedBackground': '#22c55e',
        'editorGutter.modifiedBackground': '#eab308',
        'editorGutter.deletedBackground': '#ef4444',

        // Scrollbar
        'scrollbar.shadow': '#00000000',
        'scrollbarSlider.background': '#ffffff15',
        'scrollbarSlider.hoverBackground': '#ffffff25',
        'scrollbarSlider.activeBackground': '#ffffff35',

        // Widget colors
        'editorWidget.background': '#1a1a1a',
        'editorWidget.border': '#2a2a2a',

        // Find/Replace colors
        'editor.findMatchBackground': '#ffd70050',
        'editor.findMatchHighlightBackground': '#ffd70030',
        'editor.findMatchBorder': '#ffd70080',
      },
    });
  }, [colors]);

  return { defineTheme, themeName: QUACK_THEME_NAME, colors };
}

export default useMonacoTheme;
