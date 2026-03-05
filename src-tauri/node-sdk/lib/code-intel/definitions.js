// Brain: code-intel-mcp-server
// Symbol definition finder using tree-sitter

import { readFileSync } from 'fs';
import { walkFiles } from './walker.js';
import { getParser, SUPPORTED_EXTENSIONS } from './parser.js';

const DEFINITION_NODE_TYPES = new Set([
  'function_declaration',
  'class_declaration',
  'interface_declaration',
  'type_alias_declaration',
  'enum_declaration',
  'variable_declarator',
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

    findDefinitionNodes(tree.rootNode, symbol, filePath, lines, definitions);
  }

  return { symbol, definitions };
}

/**
 * Recursively search AST for definition nodes matching the symbol.
 */
function findDefinitionNodes(node, symbol, filePath, lines, results) {
  // Check if this node is a definition type
  if (DEFINITION_NODE_TYPES.has(node.type)) {
    const match = findMatchingIdentifier(node, symbol);
    if (match) {
      const exported = isExported(node);
      const kind = getDefinitionKind(node);
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

  // Recurse into children
  for (const child of node.children) {
    findDefinitionNodes(child, symbol, filePath, lines, results);
  }
}

/**
 * Find an identifier child that matches the symbol name.
 */
function findMatchingIdentifier(node, symbol) {
  for (const child of node.children) {
    if (
      (child.type === 'identifier' || child.type === 'type_identifier') &&
      child.text === symbol
    ) {
      return child;
    }
  }
  return null;
}

/**
 * Check if a definition node is inside an export_statement.
 */
function isExported(node) {
  let current = node.parent;
  while (current) {
    if (current.type === 'export_statement') return true;
    // Only go up through lexical_declaration for variable_declarator
    if (current.type === 'lexical_declaration') {
      current = current.parent;
      continue;
    }
    break;
  }
  return false;
}

/**
 * Get the kind of definition from the node type.
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
