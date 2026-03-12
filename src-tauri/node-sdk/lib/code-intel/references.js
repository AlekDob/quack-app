// Brain: code-intel-mcp-server
// Symbol reference finder using tree-sitter

import { readFileSync } from 'fs';
import { walkFiles } from './walker.js';
import { getParser, SUPPORTED_EXTENSIONS } from './parser.js';

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
  // PHP
  'function_definition',
  'trait_declaration',
  'const_element',
  'method_declaration',
  // Java
  'record_declaration',
  'annotation_type_declaration',
  'constructor_declaration',
  'field_declaration',
]);

/** Identifier node types across TS/JS, Swift, and PHP. */
const IDENTIFIER_TYPES = new Set([
  'identifier',
  'type_identifier',
  'simple_identifier',
  'name', // PHP
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

  if (IDENTIFIER_TYPES.has(node.type) && node.text === symbol) {
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
  if (IDENTIFIER_TYPES.has(node.type) && node.text === symbol) {
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

  // TS/JS imports
  if (parent.type === 'import_specifier') return 'import';
  if (parent.type === 'import_clause') return 'import';

  // Swift imports
  if (parent.type === 'import_declaration') return 'import';

  // Function/method calls
  if (parent.type === 'call_expression') return 'call';
  if (parent.type === 'new_expression') return 'call';

  // TS/JS type references
  if (parent.type === 'type_annotation') return 'type_reference';
  if (parent.type === 'type_reference') return 'type_reference';
  if (parent.type === 'generic_type') return 'type_reference';

  // Swift type references
  if (parent.type === 'user_type') return 'type_reference';
  if (parent.type === 'inheritance_specifier') return 'type_reference';
  if (parent.type === 'as_expression') return 'type_reference';

  // Assignments
  if (parent.type === 'assignment_expression') return 'assignment';
  if (parent.type === 'assignment') return 'assignment';

  // PHP imports (use statements)
  if (parent.type === 'namespace_use_clause') return 'import';
  if (parent.type === 'qualified_name') return 'import';

  // PHP type references
  if (parent.type === 'base_clause') return 'type_reference';
  if (parent.type === 'class_interface_clause') return 'type_reference';
  if (parent.type === 'named_type') return 'type_reference';
  if (parent.type === 'use_declaration') return 'type_reference';

  // PHP object creation
  if (parent.type === 'object_creation_expression') return 'call';

  // PHP function calls
  if (parent.type === 'function_call_expression') return 'call';
  if (parent.type === 'scoped_call_expression') return 'call';
  if (parent.type === 'member_call_expression') return 'call';

  // Swift navigation (method call chain)
  if (parent.type === 'navigation_suffix') return 'call';

  // Java imports
  if (parent.type === 'scoped_identifier' && hasAncestor(identifierNode, 'import_declaration')) return 'import';

  // Java method calls
  if (parent.type === 'method_invocation') return 'call';
  if (parent.type === 'object_creation_expression') return 'call';

  // Java type references
  if (parent.type === 'type_list') return 'type_reference'; // implements/extends list
  if (parent.type === 'superclass') return 'type_reference';
  if (parent.type === 'super_interfaces') return 'type_reference';
  if (parent.type === 'type_arguments') return 'type_reference'; // generics
  if (parent.type === 'annotation') return 'type_reference';
  if (parent.type === 'catches') return 'type_reference';
  if (parent.type === 'throws') return 'type_reference';

  if (DEFINITION_NODE_TYPES.has(parent.type)) return 'definition';

  // Check grandparent for export > definition
  const grandparent = parent.parent;
  if (grandparent && DEFINITION_NODE_TYPES.has(grandparent.type)) {
    return 'definition';
  }

  // Swift pattern in property_declaration = definition
  if (parent.type === 'pattern' && grandparent?.type === 'property_declaration') {
    return 'definition';
  }

  return 'other';
}

/**
 * Check if a node has an ancestor of the given type.
 */
function hasAncestor(node, ancestorType) {
  let current = node.parent;
  while (current) {
    if (current.type === ancestorType) return true;
    current = current.parent;
  }
  return false;
}
