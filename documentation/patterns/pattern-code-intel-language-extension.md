---
type: pattern
project: quack-app
created: 2026-03-06
last_verified: 2026-03-06
tags: [code-intel, tree-sitter, language-support, mcp]
---

# Adding a New Language to code-intel

## Overview

code-intel uses tree-sitter for AST-based code navigation. Adding a new language requires updating 6 modules in `src-tauri/node-sdk/lib/code-intel/`.

## Steps

### 1. Install tree-sitter grammar

```bash
cd src-tauri/node-sdk
npm install tree-sitter-<language>
```

### 2. parser.js — Register the grammar

- Import the grammar: `import Lang from 'tree-sitter-<language>';`
- Add extension(s) to `LANGUAGE_MAP`: `'.ext': 'language'`
- Add case to `getLanguageGrammar()`: `case 'language': return Lang;`

### 3. walker.js — Exclude build artifacts

Add language-specific build dirs to `EXCLUDED_DIRS`. Examples:
- Swift: `.build`, `DerivedData`, `.swiftpm`, `Pods`
- Rust: `target`
- Python: `__pycache__`, `.venv` (already present)

### 4. outline.js — Map top-level symbols

For each new language:
- Add definition node types to `DEFINITION_TYPES` set
- Update `extractSymbol()` if the language wraps definitions differently
- Add `extractName()` logic for language-specific identifier patterns
- Add member extraction for container types (class body, etc.)
- Add a `<lang>NodeTypeToKind()` function mapping node types to human-readable kinds

### 5. definitions.js — Map definition lookups

- Add node types to `DEFINITION_NODE_TYPES` set
- Update `findMatchingIdentifier()` for language-specific identifier types
- Add `is<Lang>Public()` for access modifier detection
- Add `get<Lang>DefinitionKind()` for kind mapping

### 6. references.js — Classify reference contexts

- Add identifier node types to `IDENTIFIER_TYPES` set
- Update `classifyContext()` with language-specific parent node mappings

### 7. imports.js — Parse import statements

- Add a language-specific import extractor function
- Wire it into `getImports()` with a language check

## Key Gotchas by Language

### Swift (tree-sitter-swift)

| Gotcha | Detail |
|--------|--------|
| `class_declaration` reuse | struct, class, enum, extension, actor ALL use `class_declaration`. Keyword child (first non-modifier) differentiates them |
| Identifier types | Swift uses `simple_identifier` (not `identifier`) for function/variable names |
| Property names | Inside `pattern > simple_identifier`, not direct child |
| Extension names | Inside `user_type > type_identifier`, not direct `type_identifier` |
| Modifier ordering | `public struct Foo` → children order: `modifiers`, `struct`, `type_identifier`. Don't assume keyword is `children[0]` |
| Protocol members | Use `protocol_function_declaration`, `protocol_property_declaration` (not same as class members) |

## Testing Checklist

1. Create a test file with all major constructs (class, function, enum, imports, etc.)
2. Verify `getOutline()` returns correct kinds and names
3. Verify `findDefinition()` finds the symbol with correct kind
4. Verify `findReferences()` classifies contexts correctly (definition, call, type_reference, import)
5. Verify `getImports()` extracts module names
6. Run against existing TS/JS files to confirm no regression

## AST Exploration Script

Use this to discover node types for a new language:

```javascript
import Parser from 'tree-sitter';
import Lang from 'tree-sitter-<language>';

const parser = new Parser();
parser.setLanguage(Lang);
const tree = parser.parse(`<sample code>`);

function print(node, depth = 0) {
  const indent = '  '.repeat(depth);
  const text = node.text.substring(0, 60).replace(/\n/g, '\\n');
  if (depth <= 3) console.log(`${indent}${node.type} = ${text}`);
  for (const child of node.children) print(child, depth + 1);
}

print(tree.rootNode);
```
