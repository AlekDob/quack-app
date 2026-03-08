// Brain: code-intel-mcp-server
// Tree-sitter parser setup with lazy loading and caching

import { extname } from 'path';
import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';
import JavaScript from 'tree-sitter-javascript';
import Swift from 'tree-sitter-swift';
import PHP from 'tree-sitter-php';

/**
 * Map of file extensions to language names.
 */
const LANGUAGE_MAP = {
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.swift': 'swift',
  '.php': 'php',
};

export const SUPPORTED_EXTENSIONS = Object.keys(LANGUAGE_MAP);

/**
 * Cache of initialized parsers by language name.
 * @type {Map<string, Parser>}
 */
const parserCache = new Map();

/**
 * Get the language grammar object for a given language name.
 */
function getLanguageGrammar(languageName) {
  switch (languageName) {
    case 'typescript': return TypeScript.typescript;
    case 'tsx': return TypeScript.tsx;
    case 'javascript': return JavaScript;
    case 'swift': return Swift;
    case 'php': return PHP.php;
    default: return null;
  }
}

/**
 * Get the language name for a file based on its extension.
 * @param {string} filePath
 * @returns {string|null}
 */
export function getLanguageName(filePath) {
  const ext = extname(filePath);
  return LANGUAGE_MAP[ext] || null;
}

/**
 * Get or create a tree-sitter parser for the given file.
 * Returns null if the file type is unsupported.
 * @param {string} filePath
 * @returns {Parser|null}
 */
export function getParser(filePath) {
  const languageName = getLanguageName(filePath);
  if (!languageName) return null;

  if (parserCache.has(languageName)) {
    return parserCache.get(languageName);
  }

  const grammar = getLanguageGrammar(languageName);
  if (!grammar) return null;

  const parser = new Parser();
  parser.setLanguage(grammar);
  parserCache.set(languageName, parser);

  return parser;
}
