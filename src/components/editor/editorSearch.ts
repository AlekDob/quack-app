/**
 * Editor Search
 *
 * Search state management, decorations, and helper functions
 * for CodeMirror 6 search/replace functionality.
 *
 * @module editorSearch
 */

import { StateField, StateEffect } from '@codemirror/state';
import { Decoration, EditorView } from '@codemirror/view';
import type { Range } from '@codemirror/state';
import type { SearchOptions } from './editorTypes';

// ==========================================
// State effects and fields
// ==========================================

/** Effect to update search match decorations */
export const setSearchMatches = StateEffect.define<Range<Decoration>[]>();

/** Field storing current search match decorations */
export const searchMatchesField = StateField.define<Range<Decoration>[]>({
  create: () => [],
  update(matches, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setSearchMatches)) return effect.value;
    }
    return matches;
  },
  provide: f => EditorView.decorations.from(
    f, matches => Decoration.set(matches)
  ),
});

// ==========================================
// Decorations
// ==========================================

/** Decoration for non-current search matches */
export const searchMatchDecoration = Decoration.mark({
  class: 'cm-search-match',
});

/** Decoration for the currently focused match */
export const currentSearchMatchDecoration = Decoration.mark({
  class: 'cm-search-match-current',
});

// ==========================================
// Search helpers
// ==========================================

/** Match position in the document */
export interface SearchMatch {
  from: number;
  to: number;
}

/** Build a RegExp from query and search options */
function buildSearchRegex(
  query: string,
  options: SearchOptions,
): RegExp {
  if (options.regex) {
    return new RegExp(query, options.caseSensitive ? 'g' : 'gi');
  }
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = options.wholeWord ? `\\b${escaped}\\b` : escaped;
  return new RegExp(pattern, options.caseSensitive ? 'g' : 'gi');
}

/** Find all matches of query in the given text */
export function findAllMatches(
  text: string,
  query: string,
  options: SearchOptions,
): SearchMatch[] {
  if (!query) return [];
  const matches: SearchMatch[] = [];
  try {
    const regex = buildSearchRegex(query, options);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      matches.push({ from: match.index, to: match.index + match[0].length });
    }
  } catch {
    // Invalid regex — return empty
  }
  return matches;
}

/** Build decoration ranges from matches, highlighting the current one */
export function buildSearchDecorations(
  matches: SearchMatch[],
  currentIndex: number,
): Range<Decoration>[] {
  return matches.map((m, i) => {
    const deco = i === currentIndex
      ? currentSearchMatchDecoration
      : searchMatchDecoration;
    return deco.range(m.from, m.to);
  });
}
