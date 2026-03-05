// Brain: code-intel-mcp-server
// Import analysis using tree-sitter

import { readFileSync, existsSync } from 'fs';
import { dirname, join, extname } from 'path';
import { getParser } from './parser.js';

const RESOLVE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
const INDEX_FILES = ['index.ts', 'index.tsx', 'index.js', 'index.jsx'];

/**
 * Extract all imports from a source file.
 * @param {string} filePath - Absolute path to the file
 * @param {boolean} [resolveRelative=true] - Whether to resolve relative import paths
 * @returns {{ file: string, imports: Array }}
 */
export function getImports(filePath, resolveRelative = true) {
  const parser = getParser(filePath);
  if (!parser) return { file: filePath, imports: [] };

  let source;
  try {
    source = readFileSync(filePath, 'utf-8');
  } catch {
    return { file: filePath, imports: [] };
  }

  const tree = parser.parse(source);
  const imports = [];
  const fileDir = dirname(filePath);

  for (const node of tree.rootNode.children) {
    if (node.type !== 'import_statement') continue;

    const importInfo = extractImportInfo(node, fileDir, resolveRelative);
    if (importInfo) imports.push(importInfo);
  }

  return { file: filePath, imports };
}

/**
 * Extract import details from an import_statement AST node.
 */
function extractImportInfo(node, fileDir, resolveRelative) {
  const sourceNode = findStringContent(node);
  if (!sourceNode) return null;

  const source = sourceNode.text;
  const line = node.startPosition.row + 1;

  let resolvedPath = null;
  if (resolveRelative && isRelativePath(source)) {
    resolvedPath = resolveImportPath(fileDir, source);
  }

  const symbols = [];
  let isDefault = false;
  let isNamespace = false;

  const importClause = node.children.find(
    (c) => c.type === 'import_clause'
  );

  if (importClause) {
    for (const child of importClause.children) {
      if (child.type === 'identifier') {
        isDefault = true;
        symbols.push({ name: child.text, alias: null, isDefault: true });
      }
      if (child.type === 'namespace_import') {
        isNamespace = true;
        const name = child.children.find((c) => c.type === 'identifier');
        if (name) {
          symbols.push({
            name: '*',
            alias: name.text,
            isDefault: false,
          });
        }
      }
      if (child.type === 'named_imports') {
        extractNamedImports(child, symbols);
      }
    }
  }

  return { source, resolvedPath, symbols, isDefault, isNamespace, line };
}

/**
 * Recursively extract named import specifiers.
 */
function extractNamedImports(namedImportsNode, symbols) {
  for (const child of namedImportsNode.children) {
    if (child.type === 'import_specifier') {
      const identifiers = child.children.filter(
        (c) => c.type === 'identifier'
      );
      const name = identifiers[0]?.text;
      // If there are two identifiers, second is the alias (import { X as Y })
      const alias = identifiers.length > 1 ? identifiers[1].text : null;
      if (name) {
        symbols.push({ name, alias, isDefault: false });
      }
    }
  }
}

/**
 * Find the string content node inside an import_statement.
 */
function findStringContent(importNode) {
  for (const child of importNode.children) {
    if (child.type === 'string') {
      // String node contains string_fragment child with actual text
      const fragment = child.children.find(
        (c) => c.type === 'string_fragment'
      );
      return fragment || null;
    }
  }
  return null;
}

/**
 * Check if a path is relative.
 */
function isRelativePath(importSource) {
  return importSource.startsWith('./') || importSource.startsWith('../');
}

/**
 * Resolve a relative import path by trying common extensions.
 */
function resolveImportPath(fromDir, importSource) {
  const basePath = join(fromDir, importSource);

  // Try exact path first (already has extension)
  if (extname(basePath) && existsSync(basePath)) {
    return basePath;
  }

  // Try adding extensions
  for (const ext of RESOLVE_EXTENSIONS) {
    const withExt = basePath + ext;
    if (existsSync(withExt)) return withExt;
  }

  // Try as directory with index file
  for (const indexFile of INDEX_FILES) {
    const indexPath = join(basePath, indexFile);
    if (existsSync(indexPath)) return indexPath;
  }

  return null;
}
