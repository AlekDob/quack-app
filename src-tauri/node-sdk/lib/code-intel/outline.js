// Brain: code-intel-mcp-server
// AST outline extraction using tree-sitter

import { readFileSync } from 'fs';
import { getParser } from './parser.js';

const DEFINITION_TYPES = new Set([
  'function_declaration',
  'class_declaration',
  'interface_declaration',
  'type_alias_declaration',
  'enum_declaration',
  'lexical_declaration',
]);

/**
 * Extract a structured outline from a source file.
 * @param {string} filePath
 * @returns {Array<{name: string, kind: string, line: number, endLine: number, exported: boolean, children: Array}>}
 */
export function getOutline(filePath) {
  const parser = getParser(filePath);
  if (!parser) return [];

  let source;
  try {
    source = readFileSync(filePath, 'utf-8');
  } catch {
    return [];
  }

  const tree = parser.parse(source);
  const symbols = [];

  for (const node of tree.rootNode.children) {
    const symbol = extractSymbol(node);
    if (symbol) symbols.push(symbol);
  }

  return symbols;
}

/**
 * Extract a symbol from a top-level AST node.
 */
function extractSymbol(node) {
  // Handle export statements by unwrapping
  if (node.type === 'export_statement') {
    const child = findDefinitionChild(node);
    if (!child) return null;
    const symbol = extractDefinition(child);
    if (symbol) symbol.exported = true;
    return symbol;
  }

  if (DEFINITION_TYPES.has(node.type)) {
    return extractDefinition(node);
  }

  return null;
}

/**
 * Find the definition child inside an export_statement.
 */
function findDefinitionChild(exportNode) {
  for (const child of exportNode.children) {
    if (DEFINITION_TYPES.has(child.type)) return child;
  }
  return null;
}

/**
 * Extract definition details from a definition AST node.
 */
function extractDefinition(node) {
  const kind = nodeTypeToKind(node.type);
  const name = extractName(node);
  if (!name) return null;

  const result = {
    name,
    kind,
    line: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
    exported: false,
    children: [],
  };

  // Extract class members
  if (node.type === 'class_declaration') {
    result.children = extractClassMembers(node);
  }

  // Handle lexical_declaration with arrow functions
  if (node.type === 'lexical_declaration') {
    const declarator = node.children.find(
      (c) => c.type === 'variable_declarator'
    );
    if (declarator) {
      const init = declarator.childForFieldName('value');
      if (init && init.type === 'arrow_function') {
        result.kind = 'function';
      }
    }
  }

  return result;
}

/**
 * Extract the name identifier from a node.
 */
function extractName(node) {
  if (node.type === 'lexical_declaration') {
    const declarator = node.children.find(
      (c) => c.type === 'variable_declarator'
    );
    if (declarator) {
      const nameNode = declarator.children.find(
        (c) => c.type === 'identifier'
      );
      return nameNode?.text || null;
    }
    return null;
  }

  for (const child of node.children) {
    if (child.type === 'identifier' || child.type === 'type_identifier') {
      return child.text;
    }
  }
  return null;
}

/**
 * Extract method definitions from a class body.
 */
function extractClassMembers(classNode) {
  const members = [];
  const body = classNode.children.find((c) => c.type === 'class_body');
  if (!body) return members;

  for (const member of body.children) {
    if (member.type === 'method_definition') {
      const name = member.children.find(
        (c) => c.type === 'property_identifier'
      );
      if (name) {
        members.push({
          name: name.text,
          kind: 'method',
          line: member.startPosition.row + 1,
          endLine: member.endPosition.row + 1,
          exported: false,
          children: [],
        });
      }
    }
  }
  return members;
}

/**
 * Map AST node type to a human-readable kind.
 */
function nodeTypeToKind(nodeType) {
  const kindMap = {
    function_declaration: 'function',
    class_declaration: 'class',
    interface_declaration: 'interface',
    type_alias_declaration: 'type',
    enum_declaration: 'enum',
    lexical_declaration: 'variable',
  };
  return kindMap[nodeType] || 'unknown';
}
