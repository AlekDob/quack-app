/**
 * editorAutocomplete
 *
 * CodeMirror 6 autocomplete configuration.
 * Language packages provide completions; this module enables the UI.
 *
 * @module editorAutocomplete
 */

import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { keymap } from '@codemirror/view';
import type { Extension } from '@codemirror/state';

/** Autocomplete extension with dark theme styling */
export function buildAutocompleteExtension(): Extension {
  return [
    closeBrackets(),
    autocompletion({
      activateOnTyping: true,
      maxRenderedOptions: 20,
      icons: true,
    }),
    keymap.of([...closeBracketsKeymap, ...completionKeymap]),
  ];
}
