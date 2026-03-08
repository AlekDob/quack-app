// Brain: code-intel-mcp-server
// Import analysis using tree-sitter

import { readFileSync, existsSync } from 'fs';
import { dirname, join, extname } from 'path';
import { getParser, getLanguageName } from './parser.js';

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
  const isSwift = getLanguageName(filePath) === 'swift';

  const isPhp = getLanguageName(filePath) === 'php';

  for (const node of tree.rootNode.children) {
    if (isSwift && node.type === 'import_declaration') {
      const importInfo = extractSwiftImport(node);
      if (importInfo) imports.push(importInfo);
      continue;
    }

    if (isPhp && node.type === 'namespace_use_declaration') {
      const phpImports = extractPhpUseStatement(node);
      imports.push(...phpImports);
      continue;
    }

    if (!isSwift && !isPhp && node.type === 'import_statement') {
      const importInfo = extractImportInfo(node, fileDir, resolveRelative);
      if (importInfo) imports.push(importInfo);
    }
  }

  return { file: filePath, imports };
}

// --- Swift imports ---

/**
 * Extract import details from a Swift import_declaration.
 * Swift: `import Foundation`, `import UIKit`, `import struct SwiftUI.View`
 */
function extractSwiftImport(node) {
  const line = node.startPosition.row + 1;
  const identifiers = [];

  for (const child of node.children) {
    if (child.type === 'identifier' || child.type === 'simple_identifier') {
      identifiers.push(child.text);
    }
  }

  if (identifiers.length === 0) return null;

  const source = identifiers.join('.');
  return {
    source,
    resolvedPath: null,
    symbols: [{ name: source, alias: null, isDefault: true }],
    isDefault: true,
    isNamespace: true,
    line,
  };
}

// --- PHP imports ---

/**
 * Extract import details from a PHP namespace_use_declaration.
 * Handles: `use App\Models\User;`, `use App\Services\{A, B};`, `use App\Enums\Status as StatusEnum;`
 */
function extractPhpUseStatement(node) {
  const line = node.startPosition.row + 1;
  const results = [];

  // Check for grouped use: use App\Services\{A, B};
  const group = node.children.find((c) => c.type === 'namespace_use_group');
  if (group) {
    // Prefix is a namespace_name before the group
    const prefixNode = node.children.find((c) => c.type === 'namespace_name');
    const prefix = prefixNode ? prefixNode.text + '\\' : '';

    for (const child of group.children) {
      if (child.type === 'namespace_use_clause') {
        const name = child.children.find((c) => c.type === 'name');
        if (name) {
          const source = prefix + name.text;
          results.push({
            source,
            resolvedPath: null,
            symbols: [{ name: name.text, alias: null, isDefault: true }],
            isDefault: true,
            isNamespace: false,
            line,
          });
        }
      }
    }
    return results;
  }

  // Single use: use App\Models\User; or use App\Enums\Status as StatusEnum;
  const clause = node.children.find((c) => c.type === 'namespace_use_clause');
  if (clause) {
    const qualifiedName = clause.children.find((c) => c.type === 'qualified_name');
    const source = qualifiedName ? qualifiedName.text : clause.text;

    // Extract the short name (last segment)
    const nameNodes = [];
    const walkNames = (n) => {
      for (const c of n.children) {
        if (c.type === 'name') nameNodes.push(c.text);
        walkNames(c);
      }
    };
    walkNames(qualifiedName || clause);
    const shortName = nameNodes[nameNodes.length - 1] || source;

    // Check for alias: `as AliasName`
    const aliasNode = clause.children.find(
      (c, i, arr) => c.type === 'name' && i > 0 && arr[i - 1]?.type === 'as'
    );
    const alias = aliasNode ? aliasNode.text : null;

    results.push({
      source,
      resolvedPath: null,
      symbols: [{ name: shortName, alias, isDefault: true }],
      isDefault: true,
      isNamespace: false,
      line,
    });
  }

  return results;
}

// --- TS/JS imports ---

/**
 * Extract import details from a TS/JS import_statement AST node.
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

  if (extname(basePath) && existsSync(basePath)) {
    return basePath;
  }

  for (const ext of RESOLVE_EXTENSIONS) {
    const withExt = basePath + ext;
    if (existsSync(withExt)) return withExt;
  }

  for (const indexFile of INDEX_FILES) {
    const indexPath = join(basePath, indexFile);
    if (existsSync(indexPath)) return indexPath;
  }

  return null;
}
