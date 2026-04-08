/**
 * editorLanguages
 *
 * Shared language extension factory for CodeMirror 6.
 * Maps language identifiers to CM6 extensions (official packages)
 * or StreamLanguage wrappers (legacy CM5 modes for Swift, Kotlin, Dart, etc.).
 *
 * @module editorLanguages
 */

import type { Extension } from '@codemirror/state';
import { StreamLanguage } from '@codemirror/language';

// Official CM6 language packages
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { python } from '@codemirror/lang-python';
import { rust } from '@codemirror/lang-rust';
import { go } from '@codemirror/lang-go';
import { java } from '@codemirror/lang-java';
import { php } from '@codemirror/lang-php';
import { cpp } from '@codemirror/lang-cpp';
import { sql } from '@codemirror/lang-sql';
import { yaml } from '@codemirror/lang-yaml';
import { xml } from '@codemirror/lang-xml';
import { sass } from '@codemirror/lang-sass';
import { less } from '@codemirror/lang-less';
import { vue } from '@codemirror/lang-vue';

// Legacy CM5 modes via StreamLanguage wrapper
import { swift as swiftMode } from '@codemirror/legacy-modes/mode/swift';
import { kotlin as kotlinMode, dart as dartMode } from '@codemirror/legacy-modes/mode/clike';
import { shell as shellMode } from '@codemirror/legacy-modes/mode/shell';
import { ruby as rubyMode } from '@codemirror/legacy-modes/mode/ruby';
import { toml as tomlMode } from '@codemirror/legacy-modes/mode/toml';

type LangFactory = () => Extension;

/** Language factory map: language ID -> CM6 Extension factory */
const factories: Record<string, LangFactory> = {
  // Official CM6 packages
  javascript: () => javascript({ jsx: true }),
  typescript: () => javascript({ typescript: true, jsx: true }),
  html: () => html(),
  css: () => css(),
  json: () => json(),
  markdown: () => markdown(),
  python: () => python(),
  rust: () => rust(),
  go: () => go(),
  java: () => java(),
  php: () => php(),
  cpp: () => cpp(),
  c: () => cpp(),
  sql: () => sql(),
  yaml: () => yaml(),
  xml: () => xml(),
  scss: () => sass(),
  sass: () => sass(),
  less: () => less(),
  vue: () => vue(),

  // Legacy CM5 modes (StreamLanguage wrapper)
  swift: () => StreamLanguage.define(swiftMode),
  kotlin: () => StreamLanguage.define(kotlinMode),
  dart: () => StreamLanguage.define(dartMode),
  shell: () => StreamLanguage.define(shellMode),
  ruby: () => StreamLanguage.define(rubyMode),
  toml: () => StreamLanguage.define(tomlMode),
};

/** Map language string to CodeMirror 6 language extension */
export function getLanguageExtension(language: string): Extension {
  const factory = factories[language];
  return factory ? factory() : [];
}

/** List of all supported language IDs */
export const supportedLanguages = Object.keys(factories);

/** Languages with reliable tree-sitter outline support */
export const outlineSupportedLanguages = new Set([
  'javascript',
  'typescript',
  'python',
  'rust',
  'go',
  'java',
  'php',
  'cpp',
  'c',
  'ruby',
  'swift',
  'kotlin',
  'dart',
  'vue',
]);
