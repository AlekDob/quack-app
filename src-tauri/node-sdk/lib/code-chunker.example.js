#!/usr/bin/env node

// code-chunker.example.js - Practical example of using the code chunker
// Usage: node lib/code-chunker.example.js [file-path]

import { parseFile, detectLanguage, getChunkStats, filterChunks } from './code-chunker.js';
import { readFileSync, existsSync } from 'fs';

// ============================================================================
// CLI USAGE
// ============================================================================

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Usage: node lib/code-chunker.example.js [file-path]');
  console.log('');
  console.log('Examples:');
  console.log('  node lib/code-chunker.example.js src/App.tsx');
  console.log('  node lib/code-chunker.example.js lib/semantic-db.js');
  console.log('');
  process.exit(1);
}

const filePath = args[0];

if (!existsSync(filePath)) {
  console.error(`Error: File not found: ${filePath}`);
  process.exit(1);
}

// ============================================================================
// PARSE FILE
// ============================================================================

console.log('='.repeat(70));
console.log(`Parsing: ${filePath}`);
console.log('='.repeat(70));
console.log('');

// Step 1: Detect language
const language = detectLanguage(filePath);
if (!language) {
  console.error('Error: Unsupported file type');
  process.exit(1);
}

console.log(`Language detected: ${language}`);
console.log('');

// Step 2: Parse file
let chunks;
try {
  chunks = parseFile(filePath);
  console.log(`✓ Successfully parsed file`);
  console.log(`✓ Extracted ${chunks.length} chunks`);
  console.log('');
} catch (error) {
  console.error(`Error parsing file: ${error.message}`);
  process.exit(1);
}

// ============================================================================
// STATISTICS
// ============================================================================

console.log('Statistics:');
console.log('-'.repeat(70));

const stats = getChunkStats(chunks);
console.log(`Total chunks: ${stats.total}`);
console.log(`Average lines per chunk: ${stats.avgLinesPerChunk}`);
console.log('');

console.log('By level:');
for (const [level, count] of Object.entries(stats.byLevel)) {
  const percentage = ((count / stats.total) * 100).toFixed(1);
  console.log(`  ${level.padEnd(10)} ${count.toString().padStart(4)} (${percentage}%)`);
}
console.log('');

// ============================================================================
// CHUNKS BREAKDOWN
// ============================================================================

console.log('Chunks Breakdown:');
console.log('-'.repeat(70));

// Group chunks by level
const byLevel = {
  file: [],
  class: [],
  function: [],
  method: [],
};

for (const chunk of chunks) {
  byLevel[chunk.level].push(chunk);
}

// Display file chunk
if (byLevel.file.length > 0) {
  console.log(`\n[FILE LEVEL] (${byLevel.file.length})`);
  for (const chunk of byLevel.file) {
    console.log(`  ${chunk.name} (${chunk.endLine} lines)`);
  }
}

// Display classes
if (byLevel.class.length > 0) {
  console.log(`\n[CLASSES] (${byLevel.class.length})`);
  for (const chunk of byLevel.class) {
    const lines = chunk.endLine - chunk.startLine + 1;
    console.log(`  ${chunk.name} (lines ${chunk.startLine}-${chunk.endLine}, ${lines} lines)`);
  }
}

// Display functions
if (byLevel.function.length > 0) {
  console.log(`\n[FUNCTIONS] (${byLevel.function.length})`);
  for (const chunk of byLevel.function) {
    const lines = chunk.endLine - chunk.startLine + 1;
    console.log(`  ${chunk.name} (lines ${chunk.startLine}-${chunk.endLine}, ${lines} lines)`);
  }
}

// Display methods (grouped by parent)
if (byLevel.method.length > 0) {
  console.log(`\n[METHODS] (${byLevel.method.length})`);

  // Group methods by parent class
  const methodsByClass = new Map();

  for (const method of byLevel.method) {
    // Find parent class
    const parentClass = chunks.find(c =>
      c.level === 'class' &&
      c.startLine < method.startLine &&
      c.endLine > method.endLine
    );

    const parentName = parentClass ? parentClass.name : 'unknown';

    if (!methodsByClass.has(parentName)) {
      methodsByClass.set(parentName, []);
    }
    methodsByClass.get(parentName).push(method);
  }

  for (const [className, methods] of methodsByClass.entries()) {
    console.log(`\n  ${className}:`);
    for (const method of methods) {
      const lines = method.endLine - method.startLine + 1;
      console.log(`    - ${method.name}() (lines ${method.startLine}-${method.endLine}, ${lines} lines)`);
    }
  }
}

console.log('');

// ============================================================================
// CODE PREVIEW
// ============================================================================

console.log('Code Preview (first 3 chunks):');
console.log('-'.repeat(70));

const previewChunks = chunks.slice(1, 4); // Skip file chunk, show next 3

for (const chunk of previewChunks) {
  console.log(`\n[${chunk.level.toUpperCase()}] ${chunk.name} (lines ${chunk.startLine}-${chunk.endLine})`);

  // Show first 5 lines of content
  const lines = chunk.content.split('\n').slice(0, 5);
  for (const line of lines) {
    console.log(`  ${line}`);
  }

  if (chunk.content.split('\n').length > 5) {
    console.log(`  ... (${chunk.content.split('\n').length - 5} more lines)`);
  }
}

console.log('');

// ============================================================================
// ANALYSIS
// ============================================================================

console.log('Analysis:');
console.log('-'.repeat(70));

// Find largest chunks
const sortedBySize = [...chunks]
  .filter(c => c.level !== 'file')
  .sort((a, b) => (b.endLine - b.startLine) - (a.endLine - a.startLine));

console.log('\nLargest chunks:');
for (const chunk of sortedBySize.slice(0, 5)) {
  const lines = chunk.endLine - chunk.startLine + 1;
  console.log(`  ${lines.toString().padStart(4)} lines - [${chunk.level}] ${chunk.name}`);
}

// Find methods with most lines (potential refactoring candidates)
const largeMethods = byLevel.method
  .map(m => ({ ...m, lines: m.endLine - m.startLine + 1 }))
  .filter(m => m.lines > 20)
  .sort((a, b) => b.lines - a.lines);

if (largeMethods.length > 0) {
  console.log('\nLarge methods (>20 lines, may need refactoring):');
  for (const method of largeMethods) {
    console.log(`  ${method.lines.toString().padStart(4)} lines - ${method.name}()`);
  }
}

// Complexity hint
const avgMethodLines = byLevel.method.length > 0
  ? Math.round(byLevel.method.reduce((sum, m) => sum + (m.endLine - m.startLine + 1), 0) / byLevel.method.length)
  : 0;

console.log(`\nAverage method length: ${avgMethodLines} lines`);

if (avgMethodLines > 15) {
  console.log('  ⚠️  Methods are relatively long on average');
} else if (avgMethodLines > 10) {
  console.log('  ℹ️  Methods are moderately sized');
} else {
  console.log('  ✓ Methods are concise');
}

console.log('');
console.log('='.repeat(70));
