// Brain: code-intel-mcp-server
// AST outline extraction using tree-sitter

import { readFileSync } from 'fs';
import { getParser, getLanguageName } from './parser.js';

const DEFINITION_TYPES = new Set([
  // TS/JS
  'function_declaration',
  'class_declaration',
  'interface_declaration',
  'type_alias_declaration',
  'enum_declaration',
  'lexical_declaration',
  // Swift
  'protocol_declaration',
  'property_declaration',
  'typealias_declaration',
  'init_declaration',
  // PHP
  'function_definition',
  'trait_declaration',
  'const_declaration',
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
  const lang = getLanguageName(filePath);
  const isSwift = lang === 'swift';
  const isPhp = lang === 'php';

  for (const node of tree.rootNode.children) {
    const symbol = extractSymbol(node, isSwift, isPhp);
    if (symbol) symbols.push(symbol);
  }

  return symbols;
}

/**
 * Extract a symbol from a top-level AST node.
 */
function extractSymbol(node, isSwift, isPhp) {
  // Handle export statements by unwrapping (TS/JS only)
  if (node.type === 'export_statement') {
    const child = findDefinitionChild(node);
    if (!child) return null;
    const symbol = extractDefinition(child, isSwift, isPhp);
    if (symbol) symbol.exported = true;
    return symbol;
  }

  if (DEFINITION_TYPES.has(node.type)) {
    return extractDefinition(node, isSwift, isPhp);
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
function extractDefinition(node, isSwift, isPhp) {
  const kind = isSwift
    ? swiftNodeTypeToKind(node)
    : isPhp
      ? phpNodeTypeToKind(node.type)
      : nodeTypeToKind(node.type);
  const name = extractName(node, isSwift, isPhp);
  if (!name) return null;

  const exported = isSwift
    ? isSwiftPublic(node)
    : isPhp
      ? isPhpPublic(node)
      : false;

  const result = {
    name,
    kind,
    line: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
    exported,
    children: [],
  };

  // Extract class/struct/enum members
  if (node.type === 'class_declaration') {
    result.children = isSwift
      ? extractSwiftMembers(node)
      : isPhp
        ? extractPhpMembers(node)
        : extractClassMembers(node);
  }

  // Extract PHP interface/trait members
  if (isPhp && (node.type === 'interface_declaration' || node.type === 'trait_declaration')) {
    result.children = extractPhpMembers(node);
  }

  // Extract protocol members
  if (node.type === 'protocol_declaration') {
    result.children = extractProtocolMembers(node);
  }

  // Handle lexical_declaration with arrow functions (TS/JS)
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
function extractName(node, isSwift, isPhp) {
  // PHP const_declaration: name is inside const_element child
  if (isPhp && node.type === 'const_declaration') {
    const constEl = node.children.find((c) => c.type === 'const_element');
    if (constEl) {
      const nameNode = constEl.children.find((c) => c.type === 'name');
      return nameNode?.text || null;
    }
    return null;
  }

  // TS/JS lexical_declaration
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

  // Swift property_declaration: name is inside pattern child
  if (node.type === 'property_declaration') {
    const pattern = node.children.find((c) => c.type === 'pattern');
    if (pattern) {
      const nameNode = pattern.children.find(
        (c) => c.type === 'simple_identifier'
      );
      return nameNode?.text || pattern.text || null;
    }
    return null;
  }

  // Swift init_declaration
  if (node.type === 'init_declaration') {
    return 'init';
  }

  for (const child of node.children) {
    if (
      child.type === 'identifier' ||
      child.type === 'type_identifier' ||
      child.type === 'simple_identifier' ||
      (isPhp && child.type === 'name')
    ) {
      return child.text;
    }
    // Swift extension: name is inside user_type > type_identifier
    if (child.type === 'user_type') {
      const typeId = child.children.find(
        (c) => c.type === 'type_identifier'
      );
      if (typeId) return typeId.text;
    }
  }
  return null;
}

/**
 * Extract method definitions from a class body (TS/JS).
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
 * Extract members from a Swift class/struct/enum body.
 */
function extractSwiftMembers(classNode) {
  const members = [];
  const body = classNode.children.find(
    (c) => c.type === 'class_body' || c.type === 'enum_class_body'
  );
  if (!body) return members;

  for (const member of body.children) {
    if (member.type === 'function_declaration') {
      const name = member.children.find(
        (c) => c.type === 'simple_identifier'
      );
      if (name) {
        members.push({
          name: name.text,
          kind: 'method',
          line: member.startPosition.row + 1,
          endLine: member.endPosition.row + 1,
          exported: isSwiftPublic(member),
          children: [],
        });
      }
    }

    if (member.type === 'property_declaration') {
      const pattern = member.children.find((c) => c.type === 'pattern');
      const name = pattern?.children.find(
        (c) => c.type === 'simple_identifier'
      );
      if (name || pattern) {
        members.push({
          name: name?.text || pattern?.text || 'unknown',
          kind: 'property',
          line: member.startPosition.row + 1,
          endLine: member.endPosition.row + 1,
          exported: isSwiftPublic(member),
          children: [],
        });
      }
    }

    if (member.type === 'init_declaration') {
      members.push({
        name: 'init',
        kind: 'initializer',
        line: member.startPosition.row + 1,
        endLine: member.endPosition.row + 1,
        exported: isSwiftPublic(member),
        children: [],
      });
    }
  }
  return members;
}

/**
 * Extract members from a Swift protocol body.
 */
function extractProtocolMembers(protocolNode) {
  const members = [];
  const body = protocolNode.children.find(
    (c) => c.type === 'protocol_body'
  );
  if (!body) return members;

  for (const member of body.children) {
    if (member.type === 'protocol_function_declaration') {
      const name = member.children.find(
        (c) => c.type === 'simple_identifier'
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

    if (member.type === 'protocol_property_declaration') {
      const name = member.children.find(
        (c) => c.type === 'simple_identifier'
      );
      if (name) {
        members.push({
          name: name.text,
          kind: 'property',
          line: member.startPosition.row + 1,
          endLine: member.endPosition.row + 1,
          exported: false,
          children: [],
        });
      }
    }

    if (member.type === 'associatedtype_declaration') {
      const name = member.children.find(
        (c) => c.type === 'type_identifier'
      );
      if (name) {
        members.push({
          name: name.text,
          kind: 'associatedtype',
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
 * Extract members from a PHP class/interface/trait body.
 */
function extractPhpMembers(classNode) {
  const members = [];
  const body = classNode.children.find((c) => c.type === 'declaration_list');
  if (!body) return members;

  for (const member of body.children) {
    if (member.type === 'method_declaration') {
      const nameNode = member.children.find((c) => c.type === 'name');
      if (nameNode) {
        members.push({
          name: nameNode.text,
          kind: 'method',
          line: member.startPosition.row + 1,
          endLine: member.endPosition.row + 1,
          exported: isPhpPublic(member),
          children: [],
        });
      }
    }

    if (member.type === 'property_declaration') {
      const propEl = member.children.find((c) => c.type === 'property_element');
      if (propEl) {
        const varName = propEl.children.find((c) => c.type === 'variable_name');
        const nameNode = varName?.children.find((c) => c.type === 'name');
        if (nameNode) {
          members.push({
            name: '$' + nameNode.text,
            kind: 'property',
            line: member.startPosition.row + 1,
            endLine: member.endPosition.row + 1,
            exported: isPhpPublic(member),
            children: [],
          });
        }
      }
    }

    if (member.type === 'const_declaration') {
      const constEl = member.children.find((c) => c.type === 'const_element');
      if (constEl) {
        const nameNode = constEl.children.find((c) => c.type === 'name');
        if (nameNode) {
          members.push({
            name: nameNode.text,
            kind: 'constant',
            line: member.startPosition.row + 1,
            endLine: member.endPosition.row + 1,
            exported: isPhpPublic(member),
            children: [],
          });
        }
      }
    }
  }
  return members;
}

/**
 * Check if a PHP declaration has public visibility (or no visibility = public by default for interfaces).
 */
function isPhpPublic(node) {
  for (const child of node.children) {
    if (child.type === 'visibility_modifier') {
      return child.text === 'public';
    }
  }
  // PHP: no visibility modifier on class/interface/trait/function = public at top level
  return true;
}

/**
 * Map PHP AST node type to a human-readable kind.
 */
function phpNodeTypeToKind(nodeType) {
  const kindMap = {
    function_definition: 'function',
    class_declaration: 'class',
    interface_declaration: 'interface',
    trait_declaration: 'trait',
    enum_declaration: 'enum',
    const_declaration: 'constant',
  };
  return kindMap[nodeType] || 'unknown';
}

/**
 * Map AST node type to a human-readable kind (TS/JS).
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

/**
 * Map Swift AST node to kind, detecting keyword for class_declaration.
 * In Swift tree-sitter, class/struct/enum/extension/actor all use class_declaration.
 */
function swiftNodeTypeToKind(node) {
  if (node.type === 'class_declaration') {
    // Keyword may not be first child (modifiers like public/private come first)
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
