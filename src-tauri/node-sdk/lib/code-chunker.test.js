// code-chunker.test.js - Test suite for tree-sitter code chunker
// Tests chunk extraction for TypeScript/JavaScript files

import {
  parseFile,
  detectLanguage,
  getChunkStats,
  filterChunks,
  SUPPORTED_LANGUAGES,
} from './code-chunker.js';

// ============================================================================
// TEST SAMPLES
// ============================================================================

const SAMPLE_TYPESCRIPT = `
// Sample TypeScript file
interface User {
  id: number;
  name: string;
}

class UserService {
  constructor(private db: Database) {}

  async getUser(id: number): Promise<User> {
    return this.db.query('SELECT * FROM users WHERE id = ?', [id]);
  }

  async createUser(data: Partial<User>): Promise<User> {
    return this.db.insert('users', data);
  }
}

function formatUser(user: User): string {
  return \`\${user.name} (#\${user.id})\`;
}

const anonymousFunction = (x: number) => x * 2;

export { UserService, formatUser };
`;

const SAMPLE_JAVASCRIPT = `
// Sample JavaScript file
class Calculator {
  add(a, b) {
    return a + b;
  }

  subtract(a, b) {
    return a - b;
  }
}

function multiply(a, b) {
  return a * b;
}

const divide = (a, b) => {
  if (b === 0) throw new Error('Division by zero');
  return a / b;
};

module.exports = { Calculator, multiply, divide };
`;

const SAMPLE_TSX = `
// Sample TSX file
import React from 'react';

interface ButtonProps {
  label: string;
  onClick: () => void;
}

export const Button: React.FC<ButtonProps> = ({ label, onClick }) => {
  return <button onClick={onClick}>{label}</button>;
};

function App() {
  const handleClick = () => {
    console.log('Clicked!');
  };

  return (
    <div>
      <Button label="Click me" onClick={handleClick} />
    </div>
  );
}

export default App;
`;

// ============================================================================
// LANGUAGE DETECTION TESTS
// ============================================================================

console.log('='.repeat(70));
console.log('TEST 1: Language Detection');
console.log('='.repeat(70));

const testFiles = [
  { path: 'example.ts', expected: 'typescript' },
  { path: 'example.tsx', expected: 'tsx' },
  { path: 'example.js', expected: 'javascript' },
  { path: 'example.jsx', expected: 'jsx' },
  { path: 'example.mjs', expected: 'javascript' },
  { path: 'example.cjs', expected: 'javascript' },
  { path: 'example.py', expected: null },
  { path: 'example.rs', expected: null },
];

let passed = 0;
let failed = 0;

for (const { path, expected } of testFiles) {
  const detected = detectLanguage(path);
  const result = detected === expected ? '✓' : '✗';
  console.log(`${result} ${path} -> ${detected} (expected: ${expected})`);

  if (detected === expected) {
    passed++;
  } else {
    failed++;
  }
}

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);

// ============================================================================
// TYPESCRIPT PARSING TEST
// ============================================================================

console.log('='.repeat(70));
console.log('TEST 2: TypeScript Parsing');
console.log('='.repeat(70));

try {
  const chunks = parseFile('test.ts', SAMPLE_TYPESCRIPT);

  console.log(`Total chunks extracted: ${chunks.length}\n`);

  for (const chunk of chunks) {
    console.log(`[${chunk.level.toUpperCase()}] ${chunk.name}`);
    console.log(`  Lines: ${chunk.startLine}-${chunk.endLine}`);
    console.log(`  Language: ${chunk.language}`);
    if (chunk.parentId !== null) {
      console.log(`  Parent: ${chunk.parentId}`);
    }
    console.log('');
  }

  // Verify expected chunks
  const expectedNames = [
    'test.ts', // file
    'User', // interface
    'UserService', // class
    'getUser', // method
    'createUser', // method
    'formatUser', // function
    'anonymousFunction', // arrow function
  ];

  const actualNames = chunks.map(c => c.name);
  const allFound = expectedNames.every(name => actualNames.includes(name));

  console.log(`Expected chunks: ${expectedNames.join(', ')}`);
  console.log(`Actual chunks: ${actualNames.join(', ')}`);
  console.log(`All expected chunks found: ${allFound ? '✓' : '✗'}\n`);

} catch (error) {
  console.error(`ERROR: ${error.message}`);
  console.error(error.stack);
}

// ============================================================================
// JAVASCRIPT PARSING TEST
// ============================================================================

console.log('='.repeat(70));
console.log('TEST 3: JavaScript Parsing');
console.log('='.repeat(70));

try {
  const chunks = parseFile('test.js', SAMPLE_JAVASCRIPT);

  console.log(`Total chunks extracted: ${chunks.length}\n`);

  for (const chunk of chunks) {
    console.log(`[${chunk.level.toUpperCase()}] ${chunk.name}`);
    console.log(`  Lines: ${chunk.startLine}-${chunk.endLine}`);
    console.log('');
  }

  // Count by level
  const byLevel = {};
  for (const chunk of chunks) {
    byLevel[chunk.level] = (byLevel[chunk.level] || 0) + 1;
  }

  console.log('Chunks by level:');
  for (const [level, count] of Object.entries(byLevel)) {
    console.log(`  ${level}: ${count}`);
  }
  console.log('');

} catch (error) {
  console.error(`ERROR: ${error.message}`);
  console.error(error.stack);
}

// ============================================================================
// TSX PARSING TEST
// ============================================================================

console.log('='.repeat(70));
console.log('TEST 4: TSX Parsing');
console.log('='.repeat(70));

try {
  const chunks = parseFile('test.tsx', SAMPLE_TSX);

  console.log(`Total chunks extracted: ${chunks.length}\n`);

  for (const chunk of chunks) {
    console.log(`[${chunk.level.toUpperCase()}] ${chunk.name}`);
    console.log(`  Lines: ${chunk.startLine}-${chunk.endLine}`);
    console.log('');
  }

} catch (error) {
  console.error(`ERROR: ${error.message}`);
  console.error(error.stack);
}

// ============================================================================
// STATS TEST
// ============================================================================

console.log('='.repeat(70));
console.log('TEST 5: Chunk Statistics');
console.log('='.repeat(70));

try {
  const chunks = parseFile('test.ts', SAMPLE_TYPESCRIPT);
  const stats = getChunkStats(chunks);

  console.log('Statistics:');
  console.log(`  Total chunks: ${stats.total}`);
  console.log(`  Average lines per chunk: ${stats.avgLinesPerChunk}`);
  console.log('\nBy level:');
  for (const [level, count] of Object.entries(stats.byLevel)) {
    console.log(`  ${level}: ${count}`);
  }
  console.log('\nBy language:');
  for (const [lang, count] of Object.entries(stats.byLanguage)) {
    console.log(`  ${lang}: ${count}`);
  }
  console.log('');

} catch (error) {
  console.error(`ERROR: ${error.message}`);
  console.error(error.stack);
}

// ============================================================================
// FILTER TEST
// ============================================================================

console.log('='.repeat(70));
console.log('TEST 6: Chunk Filtering');
console.log('='.repeat(70));

try {
  const chunks = parseFile('test.ts', SAMPLE_TYPESCRIPT);

  console.log('Filter by level: function');
  const functions = filterChunks(chunks, 'function');
  console.log(`  Found ${functions.length} functions:`);
  for (const chunk of functions) {
    console.log(`    - ${chunk.name}`);
  }
  console.log('');

  console.log('Filter by level: class');
  const classes = filterChunks(chunks, 'class');
  console.log(`  Found ${classes.length} classes:`);
  for (const chunk of classes) {
    console.log(`    - ${chunk.name}`);
  }
  console.log('');

  console.log('Filter by multiple levels: [method, function]');
  const methodsAndFunctions = filterChunks(chunks, ['method', 'function']);
  console.log(`  Found ${methodsAndFunctions.length} items:`);
  for (const chunk of methodsAndFunctions) {
    console.log(`    - [${chunk.level}] ${chunk.name}`);
  }
  console.log('');

} catch (error) {
  console.error(`ERROR: ${error.message}`);
  console.error(error.stack);
}

// ============================================================================
// EDGE CASES TEST
// ============================================================================

console.log('='.repeat(70));
console.log('TEST 7: Edge Cases');
console.log('='.repeat(70));

// Test 7.1: Empty file
console.log('7.1: Empty file');
try {
  const chunks = parseFile('empty.ts', '');
  console.log(`  ✓ Parsed empty file: ${chunks.length} chunks (expected: 1 file chunk)`);
} catch (error) {
  console.log(`  ✗ Failed: ${error.message}`);
}

// Test 7.2: File with only comments
console.log('7.2: File with only comments');
try {
  const chunks = parseFile('comments.ts', '// Just a comment\n/* Block comment */');
  console.log(`  ✓ Parsed comment-only file: ${chunks.length} chunks`);
} catch (error) {
  console.log(`  ✗ Failed: ${error.message}`);
}

// Test 7.3: Anonymous arrow function
console.log('7.3: Anonymous arrow function');
try {
  const chunks = parseFile('arrow.js', '() => { console.log("test"); }');
  console.log(`  ✓ Parsed anonymous arrow function: ${chunks.length} chunks`);
  console.log(`    Chunk names: ${chunks.map(c => c.name).join(', ')}`);
} catch (error) {
  console.log(`  ✗ Failed: ${error.message}`);
}

// Test 7.4: Nested classes
console.log('7.4: Nested classes (edge case - not common in JS/TS)');
try {
  const nestedClass = `
    class Outer {
      innerMethod() {
        class Inner {
          innerInnerMethod() {}
        }
      }
    }
  `;
  const chunks = parseFile('nested.ts', nestedClass);
  console.log(`  ✓ Parsed nested classes: ${chunks.length} chunks`);
  for (const chunk of chunks) {
    console.log(`    - [${chunk.level}] ${chunk.name} (lines ${chunk.startLine}-${chunk.endLine})`);
  }
} catch (error) {
  console.log(`  ✗ Failed: ${error.message}`);
}

console.log('');
console.log('='.repeat(70));
console.log('ALL TESTS COMPLETED');
console.log('='.repeat(70));
