/**
 * editorLint
 *
 * CodeMirror 6 lint/diagnostics integration.
 * Diagnostics are pushed from the Tauri backend (tsc, eslint).
 *
 * @module editorLint
 */

import { linter, lintGutter, type Diagnostic } from '@codemirror/lint';
import { StateEffect, StateField } from '@codemirror/state';
import type { Extension } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';

/** Diagnostic entry from external tools (tsc, eslint, etc.) */
export interface ExternalDiagnostic {
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  source?: string;
}

/** Effect to push external diagnostics into the editor */
export const setDiagnostics = StateEffect.define<ExternalDiagnostic[]>();

/** Convert external diagnostics to CM6 Diagnostic format */
function toCM6Diagnostics(
  view: EditorView,
  externals: ExternalDiagnostic[]
): Diagnostic[] {
  const doc = view.state.doc;
  return externals
    .filter(d => d.line >= 1 && d.line <= doc.lines)
    .map(d => {
      const lineInfo = doc.line(d.line);
      const from = lineInfo.from + Math.max(0, (d.column || 1) - 1);
      const endLine = d.endLine && d.endLine <= doc.lines ? d.endLine : d.line;
      const endLineInfo = doc.line(endLine);
      const to = d.endColumn
        ? endLineInfo.from + Math.min(d.endColumn - 1, endLineInfo.length)
        : Math.min(from + 1, lineInfo.to);
      return {
        from: Math.min(from, lineInfo.to),
        to: Math.max(to, from),
        severity: d.severity,
        message: d.message,
        source: d.source,
      };
    });
}

/** State field that holds current external diagnostics */
const externalDiagnosticsField = StateField.define<ExternalDiagnostic[]>({
  create: () => [],
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setDiagnostics)) return effect.value;
    }
    return value;
  },
});

/** Lint extension reading from external diagnostics state */
export function buildLintExtension(): Extension {
  return [
    externalDiagnosticsField,
    lintGutter(),
    linter(view => {
      const externals = view.state.field(externalDiagnosticsField);
      return toCM6Diagnostics(view, externals);
    }),
  ];
}

/** Push diagnostics into an editor view */
export function pushDiagnostics(
  view: EditorView,
  diagnostics: ExternalDiagnostic[]
): void {
  view.dispatch({ effects: setDiagnostics.of(diagnostics) });
}
