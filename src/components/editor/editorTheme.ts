/**
 * Editor Theme
 *
 * Custom CodeMirror 6 theme and syntax highlighting styles.
 * Inspired by Atom One Dark / Material Palenight with pure black background.
 *
 * @module editorTheme
 */

import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

// Brain: pattern-code-editor-tab
/** Custom dark theme with pure black background */
export const customTheme = EditorView.theme({
  '&': {
    backgroundColor: '#000000 !important',
    color: '#abb2bf',
  },
  '.cm-content': { caretColor: '#528bff' },
  '.cm-gutters': {
    backgroundColor: '#000000 !important',
    borderRight: '1px solid #1a1a1a',
    color: '#636d83',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#0a0a0a !important',
    color: '#abb2bf',
  },
  '.cm-scroller': { backgroundColor: '#000000 !important' },
  '.cm-line': { color: '#abb2bf' },
  '.cm-activeLine': {
    backgroundColor: 'rgba(153, 187, 255, 0.04) !important',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: '#528bff !important',
    borderLeftWidth: '2px',
  },
  '&.cm-focused .cm-cursor': { borderLeftColor: '#528bff !important' },
  '&.cm-focused': { outline: 'none' },
  '.cm-selectionBackground, ::selection': {
    backgroundColor: 'rgba(67, 76, 94, 0.6) !important',
  },
  '&.cm-focused .cm-selectionBackground': {
    backgroundColor: 'rgba(67, 76, 94, 0.8) !important',
  },
  // Syntax colors
  '.cm-string': { color: '#ce9178' },
  '.cm-number': { color: '#b5cea8' },
  '.cm-keyword': { color: '#c586c0' },
  '.cm-operator': { color: '#909090' },
  '.cm-variableName': { color: '#9cdcfe' },
  '.cm-propertyName': { color: '#9cdcfe' },
  '.cm-comment': { color: '#6a9955', fontStyle: 'italic' },
  '.cm-atom': { color: '#569cd6' },
  '.cm-meta': { color: '#808080' },
  '.cm-bracket': { color: '#808080' },
  '.cm-tag': { color: '#569cd6' },
  '.cm-attributeName': { color: '#9cdcfe' },
  '.cm-attributeValue': { color: '#ce9178' },
  '.cm-typeName': { color: '#4ec9b0' },
  '.cm-definition': { color: '#dcdcaa' },
  '.cm-matchingBracket': {
    backgroundColor: 'rgba(97, 175, 239, 0.2) !important',
    outline: '1px solid rgba(97, 175, 239, 0.5)',
  },
  '.cm-nonmatchingBracket': { color: '#e06c75 !important' },
  // Search panel
  '.cm-searchMatch': {
    backgroundColor: 'rgba(255, 215, 0, 0.3) !important',
    border: '1px solid rgba(255, 215, 0, 0.5)',
  },
  '.cm-searchMatch-selected': {
    backgroundColor: 'rgba(255, 165, 0, 0.5) !important',
    border: '1px solid rgba(255, 165, 0, 0.8)',
  },
  '.cm-panels': {
    backgroundColor: '#1a1a1a !important',
    color: '#ffffff !important',
    borderBottom: '1px solid #2a2a2a !important',
    position: 'sticky !important',
    top: '0 !important',
    zIndex: '100 !important',
  },
  '.cm-panels-top': { borderBottom: '1px solid #2a2a2a !important' },
  '.cm-panel': { padding: '8px 12px !important' },
  '.cm-panel input': {
    backgroundColor: '#0a0a0a !important',
    color: '#ffffff !important',
    border: '1px solid #3a3a3a !important',
    padding: '6px 10px !important',
    borderRadius: '4px !important',
    fontSize: '13px !important',
  },
  '.cm-panel input:focus': {
    outline: 'none !important',
    border: '1px solid #528bff !important',
  },
  '.cm-panel button, .cm-panel.cm-search button, .cm-search button': {
    backgroundColor: '#2a2a2a !important',
    color: '#ffffff !important',
    border: '1px solid #3a3a3a !important',
    padding: '6px 12px !important',
    borderRadius: '4px !important',
    cursor: 'pointer !important',
    fontSize: '12px !important',
    fontWeight: '500 !important',
    transition: 'all 0.15s ease !important',
    appearance: 'none !important',
    WebkitAppearance: 'none !important',
  },
  '.cm-panel button:hover, .cm-search button:hover': {
    backgroundColor: '#3a3a3a !important',
    borderColor: '#4a4a4a !important',
  },
  '.cm-panel button:active, .cm-search button:active': {
    backgroundColor: '#4a4a4a !important',
  },
  '.cm-panel button[name="close"]': {
    color: '#888 !important',
    backgroundColor: 'transparent !important',
    border: 'none !important',
    fontSize: '16px !important',
    padding: '2px 6px !important',
  },
  '.cm-panel button[name="close"]:hover': {
    color: '#fff !important',
    backgroundColor: 'transparent !important',
  },
  '.cm-panel label, .cm-search label': {
    color: '#aaa !important',
    fontSize: '12px !important',
  },
  '.cm-panel input[type=checkbox], .cm-search input[type=checkbox]': {
    cursor: 'pointer !important',
    accentColor: '#f28c52 !important',
  },
  '&.cm-editor .cm-panels-bottom': {
    order: '-1 !important',
    borderTop: 'none !important',
    borderBottom: '1px solid #2a2a2a !important',
  },
  '&.cm-editor .cm-button': {
    backgroundColor: '#2a2a2a !important',
    color: '#ffffff !important',
    border: '1px solid #3a3a3a !important',
    padding: '6px 12px !important',
    borderRadius: '4px !important',
  },
  '&.cm-editor .cm-button:hover': { backgroundColor: '#3a3a3a !important' },
  '&.cm-editor .cm-textfield': {
    backgroundColor: '#0a0a0a !important',
    color: '#ffffff !important',
    border: '1px solid #3a3a3a !important',
    borderRadius: '4px !important',
  },
  // Custom search decorations
  '.cm-search-match': {
    backgroundColor: 'rgba(255, 215, 0, 0.25) !important',
    border: '1px solid rgba(255, 215, 0, 0.4)',
    borderRadius: '2px',
  },
  '.cm-search-match-current': {
    backgroundColor: 'rgba(242, 140, 82, 0.4) !important',
    border: '1px solid rgba(242, 140, 82, 0.6)',
    borderRadius: '2px',
    outline: '2px solid rgba(242, 140, 82, 0.3)',
  },
  // Diff line highlighting
  '.cm-line-added': {
    backgroundColor: 'rgba(0, 255, 0, 0.10) !important',
    borderLeft: '2px solid rgba(0, 255, 0, 0.5)',
    paddingLeft: '6px',
  },
  '.cm-line-modified': {
    backgroundColor: 'rgba(255, 220, 0, 0.15) !important',
    borderLeft: '2px solid rgba(255, 220, 0, 0.7)',
    paddingLeft: '6px',
  },
  '.cm-line-removed': {
    backgroundColor: 'rgba(255, 0, 0, 0.08) !important',
    borderLeft: '2px solid rgba(255, 0, 0, 0.5)',
    paddingLeft: '6px',
  },
  // Autocomplete tooltip
  '.cm-tooltip': {
    backgroundColor: '#1a1a1a !important',
    border: '1px solid #3a3a3a !important',
    borderRadius: '6px !important',
    boxShadow: '0 4px 12px rgba(0,0,0,0.5) !important',
  },
  '.cm-tooltip-autocomplete': {
    backgroundColor: '#1a1a1a !important',
  },
  '.cm-tooltip-autocomplete ul li': {
    padding: '4px 8px !important',
    color: '#abb2bf !important',
    fontSize: '13px !important',
  },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    backgroundColor: 'rgba(82, 139, 255, 0.2) !important',
    color: '#ffffff !important',
  },
  '.cm-completionIcon': {
    color: '#636d83 !important',
    marginRight: '4px !important',
  },
  '.cm-completionLabel': {
    color: '#abb2bf !important',
  },
  '.cm-completionMatchedText': {
    color: '#f28c52 !important',
    textDecoration: 'none !important',
    fontWeight: '600 !important',
  },
  '.cm-completionDetail': {
    color: '#636d83 !important',
    fontStyle: 'italic !important',
  },
  // Lint gutter & tooltips
  '.cm-lint-marker': {
    width: '8px !important',
    height: '8px !important',
  },
  '.cm-lint-marker-error': {
    content: '"" !important',
    backgroundColor: '#f44747 !important',
    borderRadius: '50% !important',
  },
  '.cm-lint-marker-warning': {
    content: '"" !important',
    backgroundColor: '#f7931e !important',
    borderRadius: '50% !important',
  },
  '.cm-lint-marker-info': {
    content: '"" !important',
    backgroundColor: '#528bff !important',
    borderRadius: '50% !important',
  },
  '.cm-tooltip-lint': {
    backgroundColor: '#1a1a1a !important',
    border: '1px solid #3a3a3a !important',
    borderRadius: '6px !important',
    padding: '8px 12px !important',
    color: '#abb2bf !important',
    fontSize: '13px !important',
  },
  // Minimap
  '.cm-minimap': {
    backgroundColor: '#0a0a0a !important',
    borderLeft: '1px solid #1a1a1a !important',
  },
  '.cm-minimap-overlay': {
    backgroundColor: 'rgba(82, 139, 255, 0.15) !important',
    borderTop: '1px solid rgba(82, 139, 255, 0.3)',
    borderBottom: '1px solid rgba(82, 139, 255, 0.3)',
  },
});

/** VS Code Dark+ inspired syntax highlighting */
export const customHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: '#c586c0' },
  { tag: t.name, color: '#9cdcfe' },
  { tag: t.deleted, color: '#ce9178' },
  { tag: t.inserted, color: '#b5cea8' },
  { tag: t.changed, color: '#569cd6' },
  { tag: t.invalid, color: '#f44747' },
  { tag: t.comment, color: '#6a9955', fontStyle: 'italic' },
  { tag: t.variableName, color: '#9cdcfe' },
  { tag: [t.string, t.special(t.brace)], color: '#ce9178' },
  { tag: t.number, color: '#b5cea8' },
  { tag: t.bool, color: '#569cd6' },
  { tag: t.null, color: '#569cd6' },
  { tag: t.operator, color: '#d4d4d4' },
  { tag: t.punctuation, color: '#d4d4d4' },
  { tag: t.bracket, color: '#ffd700' },
  { tag: t.angleBracket, color: '#808080' },
  { tag: t.tagName, color: '#569cd6' },
  { tag: t.attributeName, color: '#9cdcfe' },
  { tag: t.className, color: '#4ec9b0' },
  { tag: t.propertyName, color: '#9cdcfe' },
  { tag: t.function(t.variableName), color: '#dcdcaa' },
  { tag: t.definition(t.variableName), color: '#dcdcaa' },
  { tag: t.typeName, color: '#4ec9b0' },
  { tag: t.self, color: '#569cd6' },
  { tag: t.constant(t.variableName), color: '#4fc1ff' },
  // Markdown-specific
  { tag: [t.heading, t.heading1, t.heading2, t.heading3], color: '#569cd6', fontWeight: 'bold' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strong, fontWeight: 'bold' },
  { tag: t.strikethrough, textDecoration: 'line-through', color: '#808080' },
  { tag: t.link, color: '#4fc1ff', textDecoration: 'underline' },
  { tag: t.url, color: '#4fc1ff' },
  { tag: t.quote, color: '#6a9955', fontStyle: 'italic' },
  { tag: t.monospace, backgroundColor: 'rgba(255,255,255,0.06)' },
]);

/** Pre-built syntax highlighting extension */
export const highlightExtension = syntaxHighlighting(customHighlightStyle);
