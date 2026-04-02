/**
 * CodeEditorCodeMirror — Backwards Compatibility Wrapper
 *
 * Re-exports CodeEditorEngine and all types from the editor/ submodule.
 * Existing imports of this file continue to work without changes.
 *
 * @module CodeEditorCodeMirror
 */

// Brain: pattern-code-editor-tab
export { default } from './editor/CodeEditorEngine';
export type { CodeEditorRef, DiffInfo, DiffInfoType, LineChange, SearchOptions } from './editor/editorTypes';
