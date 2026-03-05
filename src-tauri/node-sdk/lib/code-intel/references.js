// Brain: code-intel-mcp-server
// Symbol reference finder using tree-sitter

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
 * Find all references to a symbol across the project.
 * @param {string} symbol - Symbol name to find
 * @param {string} projectPath - Root project directory
 * @param {Object} [options]
 * @param {boolean} [options.includeDefinition=true]
 * @param {number} [options.maxResults=50]
 * @param {string[]} [options.fileExtensions]
 * @returns {{ symbol: string, totalCount: number, references: Array }}
 */
export function findReferences(symbol, projectPath, options = {}) {
  const {
    includeDefinition = true,
    maxResults = 50,
    fileExtensions = SUPPORTED_EXTENSIONS,
  } = options;

  const files = walkFiles(projectPath, fileExtensions);
  const references = [];
  let totalCount = 0;

  for (const filePath of files) {
    if (references.length >= maxResults) break;

    let source;
    try {
      source = readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    // Quick pre-filter
    if (!source.includes(symbol)) continue;

    const parser = getParser(filePath);
    if (!parser) continue;

    const tree = parser.parse(source);
    const lines = source.split('\n');

    collectReferences(
      tree.rootNode, symbol, filePath, lines,
      references, includeDefinition, maxResults
    );
    totalCount += countIdentifiers(tree.rootNode, symbol);
  }

  return { symbol, totalCount, references };
}

/**
 * Recursively collect identifier references matching the symbol.
 */
function collectReferences(
  node, symbol, filePath, lines,
  results, includeDefinition, maxResults
) {
  if (results.length >= maxResults) return;

  if (
    (node.type === 'identifier' || node.type === 'type_identifier') &&
    node.text === symbol
  ) {
    const context = classifyContext(node);

    // Skip definitions if not requested
    if (!includeDefinition && context === 'definition') {
      return;
    }

    const line = node.startPosition.row + 1;
    const preview = lines[node.startPosition.row]?.trim() || '';

    results.push({
      file: filePath,
      line,
      column: node.startPosition.column,
      context,
      preview,
    });
    return; // Don't recurse into identifier children
  }

  for (const child of node.children) {
    collectReferences(
      child, symbol, filePath, lines,
      results, includeDefinition, maxResults
    );
  }
}

/**
 * Count total identifier occurrences (for totalCount).
 */
function countIdentifiers(node, symbol) {
  let count = 0;
  if (
    (node.type === 'identifier' || node.type === 'type_identifier') &&
    node.text === symbol
  ) {
    return 1;
  }
  for (const child of node.children) {
    count += countIdentifiers(child, symbol);
  }
  return count;
}

/**
 * Classify the context of an identifier based on its parent node.
 */
function classifyContext(identifierNode) {
  const parent = identifierNode.parent;
  if (!parent) return 'other';

  if (parent.type === 'import_specifier') return 'import';
  if (parent.type === 'import_clause') return 'import';
  if (parent.type === 'call_expression') return 'call';
  if (parent.type === 'new_expression') return 'call';
  if (parent.type === 'type_annotation') return 'type_reference';
  if (parent.type === 'type_reference') return 'type_reference';
  if (parent.type === 'generic_type') return 'type_reference';
  if (parent.type === 'assignment_expression') return 'assignment';

  if (DEFINITION_NODE_TYPES.has(parent.type)) return 'definition';

  // Check grandparent for export > definition
  const grandparent = parent.parent;
  if (grandparent && DEFINITION_NODE_TYPES.has(grandparent.type)) {
    return 'definition';
  }

  return 'other';
}
