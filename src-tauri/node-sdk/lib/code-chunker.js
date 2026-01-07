// code-chunker.js - Tree-sitter based code chunker for semantic search
// Extracts hierarchical code chunks (file, class, function, method) from source files

import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';
import JavaScript from 'tree-sitter-javascript';
import { readFileSync, existsSync } from 'fs';
import { extname, basename } from 'path';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Supported programming languages
 */
export const SUPPORTED_LANGUAGES = [
  'typescript',
  'javascript',
  'tsx', // TypeScript React
  'jsx', // JavaScript React
];

/**
 * File extension to language mapping
 */
const EXTENSION_MAP = {
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.js': 'javascript',
  '.jsx': 'jsx',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
};

/**
 * Node types to extract per language
 * Mapping: language -> { nodeType -> chunkLevel }
 */
const NODE_TYPES = {
  typescript: {
    // Classes and types
    'class_declaration': 'class',
    'interface_declaration': 'class',
    'type_alias_declaration': 'class',
    'enum_declaration': 'class',

    // Functions
    'function_declaration': 'function',
    'function_signature': 'function',
    'arrow_function': 'function',
    'function_expression': 'function',
    'generator_function_declaration': 'function',

    // Methods (inside classes)
    'method_definition': 'method',
    'method_signature': 'method',
  },
  tsx: {
    // Same as TypeScript + JSX
    'class_declaration': 'class',
    'interface_declaration': 'class',
    'type_alias_declaration': 'class',
    'enum_declaration': 'class',
    'function_declaration': 'function',
    'arrow_function': 'function',
    'function_expression': 'function',
    'generator_function_declaration': 'function',
    'method_definition': 'method',
  },
  javascript: {
    'class_declaration': 'class',
    'function_declaration': 'function',
    'arrow_function': 'function',
    'function_expression': 'function',
    'generator_function_declaration': 'function',
    'method_definition': 'method',
  },
  jsx: {
    // Same as JavaScript
    'class_declaration': 'class',
    'function_declaration': 'function',
    'arrow_function': 'function',
    'function_expression': 'function',
    'generator_function_declaration': 'function',
    'method_definition': 'method',
  },
};

// ============================================================================
// PARSER SETUP
// ============================================================================

/**
 * Create and configure a tree-sitter parser for a language
 * @param {string} language - Language identifier (typescript, javascript, tsx, jsx)
 * @returns {Parser} Configured parser
 */
function createParser(language) {
  const parser = new Parser();

  switch (language) {
    case 'typescript':
      parser.setLanguage(TypeScript.typescript);
      break;
    case 'tsx':
      parser.setLanguage(TypeScript.tsx);
      break;
    case 'javascript':
    case 'jsx':
      parser.setLanguage(JavaScript);
      break;
    default:
      throw new Error(`Unsupported language: ${language}`);
  }

  return parser;
}

// ============================================================================
// LANGUAGE DETECTION
// ============================================================================

/**
 * Detect language from file extension
 * @param {string} filePath - Path to the file
 * @returns {string|null} Language identifier or null if unsupported
 */
export function detectLanguage(filePath) {
  const ext = extname(filePath).toLowerCase();
  return EXTENSION_MAP[ext] || null;
}

// ============================================================================
// NAME EXTRACTION
// ============================================================================

/**
 * Extract identifier name from a node
 * @param {Node} node - Tree-sitter node
 * @returns {string|null} Identifier name or null
 */
function extractName(node) {
  // Try to find 'name' field
  const nameNode = node.childForFieldName('name');
  if (nameNode) {
    return nameNode.text;
  }

  // Try to find 'identifier' child
  const identifierNode = node.children.find(child =>
    child.type === 'identifier' ||
    child.type === 'property_identifier' ||
    child.type === 'type_identifier'
  );

  if (identifierNode) {
    return identifierNode.text;
  }

  // For arrow functions and function expressions, try to get variable name
  if (node.type === 'arrow_function' || node.type === 'function_expression') {
    // Check if parent is a variable_declarator
    let parent = node.parent;
    while (parent) {
      if (parent.type === 'variable_declarator') {
        const varName = parent.childForFieldName('name');
        if (varName) {
          return varName.text;
        }
      }
      if (parent.type === 'pair') {
        // Object property
        const key = parent.childForFieldName('key');
        if (key) {
          return key.text;
        }
      }
      if (parent.type === 'assignment_expression') {
        const left = parent.childForFieldName('left');
        if (left) {
          return left.text;
        }
      }
      parent = parent.parent;
    }
  }

  return null;
}

// ============================================================================
// CHUNK EXTRACTION
// ============================================================================

/**
 * Check if a node is inside a class
 * @param {Node} node - Tree-sitter node
 * @returns {boolean} True if node is inside a class
 */
function isInsideClass(node) {
  let parent = node.parent;
  while (parent) {
    if (parent.type === 'class_declaration' || parent.type === 'class_body') {
      return true;
    }
    parent = parent.parent;
  }
  return false;
}

/**
 * Extract chunks from a tree-sitter syntax tree
 * @param {Tree} tree - Tree-sitter syntax tree
 * @param {string} content - Source code content
 * @param {string} language - Language identifier
 * @returns {Array<Chunk>} Array of extracted chunks
 */
function extractChunks(tree, content, language) {
  const chunks = [];
  const lines = content.split('\n');
  const nodeTypeMap = NODE_TYPES[language] || NODE_TYPES.javascript;

  // Traverse the tree and collect nodes
  const nodesToProcess = [];

  function traverse(node) {
    const level = nodeTypeMap[node.type];

    if (level) {
      // Check if it's a method (inside a class)
      if (level === 'function' && isInsideClass(node)) {
        nodesToProcess.push({ node, level: 'method' });
      } else {
        nodesToProcess.push({ node, level });
      }
    }

    // Recursively traverse children
    for (let i = 0; i < node.childCount; i++) {
      traverse(node.child(i));
    }
  }

  traverse(tree.rootNode);

  // Process collected nodes
  for (const { node, level } of nodesToProcess) {
    const name = extractName(node);
    const startLine = node.startPosition.row + 1; // 1-indexed
    const endLine = node.endPosition.row + 1;
    const chunkContent = node.text;

    // Find parent chunk ID (for methods inside classes)
    let parentId = null;
    if (level === 'method') {
      // Find the enclosing class
      let parent = node.parent;
      while (parent) {
        if (parent.type === 'class_declaration') {
          // Find the chunk corresponding to this class
          const classChunk = chunks.find(chunk =>
            chunk.level === 'class' &&
            chunk.startLine === parent.startPosition.row + 1
          );
          if (classChunk) {
            parentId = classChunk.id; // Will be set later by DB
          }
          break;
        }
        parent = parent.parent;
      }
    }

    chunks.push({
      level,
      name: name || `anonymous_${level}`,
      startLine,
      endLine,
      content: chunkContent,
      parentId, // Will be updated with actual DB ID after insertion
      language,
    });
  }

  return chunks;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Parse a file and extract code chunks
 * @param {string} filePath - Absolute path to the file
 * @param {string|null} content - Optional file content (will read from file if not provided)
 * @returns {Array<Chunk>} Array of extracted chunks
 *
 * @typedef {Object} Chunk
 * @property {'file'|'class'|'function'|'method'} level - Chunk level
 * @property {string} name - Name of the chunk (function/class name)
 * @property {number} startLine - Start line number (1-indexed)
 * @property {number} endLine - End line number (1-indexed)
 * @property {string} content - Source code content
 * @property {number|null} parentId - Parent chunk ID (for nesting)
 * @property {string} language - Language identifier
 */
export function parseFile(filePath, content = null) {
  // Detect language
  const language = detectLanguage(filePath);
  if (!language) {
    throw new Error(`Unsupported file type: ${filePath}`);
  }

  // Read content if not provided
  if (content === null) {
    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    content = readFileSync(filePath, 'utf8');
  }

  // Create parser
  const parser = createParser(language);

  // Parse the file
  const tree = parser.parse(content);

  // Extract chunks
  const chunks = extractChunks(tree, content, language);

  // Add a file-level chunk
  const lines = content.split('\n');
  chunks.unshift({
    level: 'file',
    name: basename(filePath),
    startLine: 1,
    endLine: lines.length,
    content: content,
    parentId: null,
    language,
  });

  return chunks;
}

/**
 * Parse multiple files and extract chunks
 * @param {Array<string>} filePaths - Array of file paths
 * @returns {Object} Map of filePath -> chunks
 */
export function parseFiles(filePaths) {
  const results = {};

  for (const filePath of filePaths) {
    try {
      results[filePath] = parseFile(filePath);
    } catch (error) {
      console.error(`[CodeChunker] Error parsing ${filePath}: ${error.message}`);
      results[filePath] = null;
    }
  }

  return results;
}

/**
 * Get statistics about parsed chunks
 * @param {Array<Chunk>} chunks - Array of chunks
 * @returns {Object} Statistics object
 */
export function getChunkStats(chunks) {
  const stats = {
    total: chunks.length,
    byLevel: {},
    byLanguage: {},
    avgLinesPerChunk: 0,
  };

  let totalLines = 0;

  for (const chunk of chunks) {
    // Count by level
    stats.byLevel[chunk.level] = (stats.byLevel[chunk.level] || 0) + 1;

    // Count by language
    stats.byLanguage[chunk.language] = (stats.byLanguage[chunk.language] || 0) + 1;

    // Calculate lines
    totalLines += (chunk.endLine - chunk.startLine + 1);
  }

  stats.avgLinesPerChunk = chunks.length > 0 ? Math.round(totalLines / chunks.length) : 0;

  return stats;
}

/**
 * Filter chunks by level
 * @param {Array<Chunk>} chunks - Array of chunks
 * @param {string|Array<string>} levels - Level(s) to filter by
 * @returns {Array<Chunk>} Filtered chunks
 */
export function filterChunks(chunks, levels) {
  const levelSet = Array.isArray(levels) ? new Set(levels) : new Set([levels]);
  return chunks.filter(chunk => levelSet.has(chunk.level));
}
