// Brain: code-intel-mcp-server
// Symbol definition finder using tree-sitter

import { readFileSync } from 'fs';
import { walkFiles } from './walker.js';
import { getParser, getLanguageName, SUPPORTED_EXTENSIONS } from './parser.js';

const DEFINITION_NODE_TYPES = new Set([
  // TS/JS
  'function_declaration',
  'class_declaration',
  'interface_declaration',
  'type_alias_declaration',
  'enum_declaration',
  'variable_declarator',
  // Swift
  'protocol_declaration',
  'property_declaration',
  'typealias_declaration',
  'init_declaration',
]);

/**
 * Find all definitions of a symbol across the project.
 * @param {string} symbol - Symbol name to find
 * @param {string} projectPath - Root project directory
 * @param {string[]} [fileExtensions] - File extensions to search
 * @returns {{ symbol: string, definitions: Array<{file: string, line: number, column: number, kind: string, exported: boolean, preview: string}> }}
 */
export function findDefinition(
  symbol,
  projectPath,
  fileExtensions = SUPPORTED_EXTENSIONS
) {
  const files = walkFiles(projectPath, fileExtensions);
  const definitions = [];

  for (const filePath of files) {
    let source;
    try {
      source = readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    // Quick pre-filter: skip files that don't contain the symbol
    if (!source.includes(symbol)) continue;

    const parser = getParser(filePath);
    if (!parser) continue;

    const tree = parser.parse(source);
    const lines = source.split('\n');
    const isSwift = getLanguageName(filePath) === 'swift';

    findDefinitionNodes(tree.rootNode, symbol, filePath, lines, definitions, isSwift);
  }

  return { symbol, definitions };
}

/**
 * Recursively search AST for definition nodes matching the symbol.
 */
function findDefinitionNodes(node, symbol, filePath, lines, results, isSwift) {
  if (DEFINITION_NODE_TYPES.has(node.type)) {
    const match = findMatchingIdentifier(node, symbol, isSwift);
    if (match) {
      const exported = isSwift ? isSwiftPublic(node) : isExported(node);
      const kind = isSwift
        ? getSwiftDefinitionKind(node)
        : getDefinitionKind(node);
      const line = match.startPosition.row + 1;
      const preview = lines[match.startPosition.row]?.trim() || '';

      results.push({
        file: filePath,
        line,
        column: match.startPosition.column,
        kind,
        exported,
        preview,
      });
    }
  }

  for (const child of node.children) {
    findDefinitionNodes(child, symbol, filePath, lines, results, isSwift);
  }
}

/**
 * Find an identifier child that matches the symbol name.
 */
function findMatchingIdentifier(node, symbol, isSwift) {
  // Swift property_declaration: name is inside pattern child
  if (isSwift && node.type === 'property_declaration') {
    const pattern = node.children.find((c) => c.type === 'pattern');
    if (pattern) {
      const nameNode = pattern.children.find(
        (c) => c.type === 'simple_identifier' && c.text === symbol
      );
      if (nameNode) return nameNode;
      // Fallback: pattern itself might be the name
      if (pattern.text === symbol) return pattern;
    }
    return null;
  }

  for (const child of node.children) {
    if (
      (child.type === 'identifier' ||
       child.type === 'type_identifier' ||
       child.type === 'simple_identifier') &&
      child.text === symbol
    ) {
      return child;
    }
  }
  return null;
}

/**
 * Check if a definition node is inside an export_statement (TS/JS).
 */
function isExported(node) {
  let current = node.parent;
  while (current) {
    if (current.type === 'export_statement') return true;
    if (current.type === 'lexical_declaration') {
      current = current.parent;
      continue;
    }
    break;
  }
  return false;
}

/**
 * Check if a Swift declaration has public/open access modifier.
 */
function isSwiftPublic(node) {
  for (const child of node.children) {
    if (child.type === 'modifiers' || child.type === 'modifier') {
      const text = child.text;
      if (text === 'public' || text === 'open') return true;
    }
  }
  return false;
}

/**
 * Get the kind of definition from the node type (TS/JS).
 */
function getDefinitionKind(node) {
  const kindMap = {
    function_declaration: 'function',
    class_declaration: 'class',
    interface_declaration: 'interface',
    type_alias_declaration: 'type',
    enum_declaration: 'enum',
    variable_declarator: 'variable',
  };
  return kindMap[node.type] || 'unknown';
}

/**
 * Get the kind of definition from a Swift AST node.
 */
function getSwiftDefinitionKind(node) {
  if (node.type === 'class_declaration') {
    const keywordMap = {
      class: 'class',
      struct: 'struct',
      enum: 'enum',
      extension: 'extension',
      actor: 'actor',
    };
    for (const child of node.children) {
      if (keywordMap[child.type]) return keywordMap[child.type];
    }
    return 'class';
  }

  const kindMap = {
    function_declaration: 'function',
    protocol_declaration: 'protocol',
    property_declaration: 'variable',
    typealias_declaration: 'type',
    init_declaration: 'initializer',
  };
  return kindMap[node.type] || 'unknown';
}
