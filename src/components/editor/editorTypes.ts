/**
 * Editor Types
 *
 * All TypeScript interfaces for the integrated code editor tab.
 * Shared between CodeEditorEngine, editorStore, and UI components.
 *
 * @module editorTypes
 */

import type { Decoration } from '@codemirror/view';
import type { Range } from '@codemirror/state';

// ==========================================
// Existing types (migrated from CodeEditorCodeMirror)
// ==========================================

/** Diff summary with line numbers for additions, deletions, modifications */
export interface DiffInfo {
  additions: number[];
  deletions: number[];
  modifications: number[];
}

/** Alias for backwards compatibility */
export type DiffInfoType = DiffInfo;

/** Search configuration options */
export interface SearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
}

/** Imperative handle exposed by CodeEditorEngine via forwardRef */
export interface CodeEditorRef {
  search: (query: string, options: SearchOptions) => { total: number; current: number };
  nextMatch: () => void;
  previousMatch: () => void;
  clearSearch: () => void;
  replace: (replaceText: string) => void;
  replaceAll: (replaceText: string) => void;
  navigateToLine: (line: number) => void;
}

/** Per-line change indicator for diff decorations */
export interface LineChange {
  line: number;
  type: 'added' | 'modified' | 'removed';
}

/** Selection state emitted by CodeEditorEngine */
export interface EditorSelectionInfo {
  selectedText: string;
  startLine: number;
  endLine: number;
}

/** Props for the CodeEditorEngine component */
export interface CodeEditorProps {
  content: string;
  filename: string | null;
  language?: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
  onSave?: (value: string) => void;
  onSelectionChange?: (selection: EditorSelectionInfo | null) => void;
  diffInfo?: DiffInfo | null;
  lineChanges?: LineChange[];
}

// ==========================================
// New types for editor tab feature
// ==========================================

/** Editor display mode */
export type EditorMode = 'edit' | 'diff';

/** Source of a diff request */
export type DiffSource = 'agent' | 'changes-panel';

/** Pending edit awaiting user action in diff mode */
export interface PendingEdit {
  filePath: string;
  originalContent: string;
  proposedContent: string;
  source: DiffSource;
  sessionKey?: string;
  toolUseId?: string;
}

/** Request to open a diff view */
export interface DiffRequest {
  filePath: string;
  original: string;
  proposed: string;
  source: DiffSource;
  sessionKey?: string;
  toolUseId?: string;
}

/** editFile tool request from agent (Tauri event payload) */
export interface EditFileRequest {
  filePath: string;
  newContent: string;
  sessionKey: string;
  toolUseId: string;
}

/** editFile tool response back to agent (Tauri event payload) */
export interface EditFileResponse {
  action: 'accept' | 'reject';
  toolUseId: string;
  sessionKey: string;
}

/** Cursor position in the editor */
export interface CursorPosition {
  line: number;
  column: number;
}

/** Decoration range used internally by search/diff */
export type DecorationRange = Range<Decoration>;
