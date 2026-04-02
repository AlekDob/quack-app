/**
 * Editor Diff
 *
 * Diff state management and decorations for CodeMirror 6.
 * Handles line-level added/modified/removed highlighting.
 *
 * @module editorDiff
 */

import { StateField, StateEffect } from '@codemirror/state';
import { Decoration, EditorView } from '@codemirror/view';
import type { Range } from '@codemirror/state';
import type { DiffInfo, LineChange } from './editorTypes';

// ==========================================
// State effects and fields
// ==========================================

/** Effect to update diff line decorations */
export const setDiffDecorations = StateEffect.define<Range<Decoration>[]>();

/** Field storing current diff decorations */
export const diffDecorationsField = StateField.define<Range<Decoration>[]>({
  create: () => [],
  update(decorations, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setDiffDecorations)) return effect.value;
    }
    return decorations;
  },
  provide: f => EditorView.decorations.from(
    f, decorations => Decoration.set(decorations)
  ),
});

// ==========================================
// Line decorations
// ==========================================

const lineAddedDecoration = Decoration.line({ class: 'cm-line-added' });
const lineModifiedDecoration = Decoration.line({ class: 'cm-line-modified' });
const lineRemovedDecoration = Decoration.line({ class: 'cm-line-removed' });

// ==========================================
// Diff application helpers
// ==========================================

/** Get the appropriate decoration for a change type */
function getChangeDecoration(type: 'added' | 'modified' | 'removed'): Decoration {
  switch (type) {
    case 'added': return lineAddedDecoration;
    case 'modified': return lineModifiedDecoration;
    case 'removed': return lineRemovedDecoration;
  }
}

/** Build decorations from LineChange array (preferred, more detailed) */
function buildFromLineChanges(
  view: EditorView,
  lineChanges: LineChange[],
): Range<Decoration>[] {
  const decorations: Range<Decoration>[] = [];
  for (const change of lineChanges) {
    const lineNumber = change.line - 1; // 1-indexed to 0-indexed
    if (lineNumber < 0) continue;
    try {
      const line = view.state.doc.line(lineNumber + 1);
      decorations.push(getChangeDecoration(change.type).range(line.from));
    } catch {
      // Line out of bounds — skip silently
    }
  }
  return decorations;
}

/** Build decorations from DiffInfo (fallback) */
function buildFromDiffInfo(
  view: EditorView,
  diffInfo: DiffInfo,
): Range<Decoration>[] {
  const decorations: Range<Decoration>[] = [];
  const applyLines = (lines: number[], deco: Decoration) => {
    for (const lineNum of lines) {
      try {
        const line = view.state.doc.line(lineNum);
        decorations.push(deco.range(line.from));
      } catch {
        // Line out of bounds
      }
    }
  };
  applyLines(diffInfo.additions ?? [], lineAddedDecoration);
  applyLines(diffInfo.modifications ?? [], lineModifiedDecoration);
  applyLines(diffInfo.deletions ?? [], lineRemovedDecoration);
  return decorations;
}

/**
 * Apply diff decorations to an EditorView.
 * Prefers lineChanges over diffInfo when both provided.
 * Decorations are sorted by position (CodeMirror requirement).
 */
export function applyDiffDecorations(
  view: EditorView,
  lineChanges?: LineChange[],
  diffInfo?: DiffInfo | null,
): void {
  let decorations: Range<Decoration>[] = [];

  if (lineChanges && lineChanges.length > 0) {
    decorations = buildFromLineChanges(view, lineChanges);
  } else if (diffInfo) {
    decorations = buildFromDiffInfo(view, diffInfo);
  }

  // CodeMirror requires decorations sorted by `from` position
  decorations.sort((a, b) => a.from - b.from);

  view.dispatch({ effects: setDiffDecorations.of(decorations) });
}
