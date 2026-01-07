/**
 * Vitest tests for Code Chunker
 *
 * Tests tree-sitter based code chunking for:
 * - Language detection
 * - TypeScript/JavaScript/TSX/JSX parsing
 * - Chunk extraction (file, class, function, method levels)
 * - Hierarchical parent-child relationships
 * - Chunk statistics and filtering
 */

import { describe, it, expect } from 'vitest';
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  SUPPORTED_LANGUAGES,
  detectLanguage,
  parseFile,
  parseFiles,
  getChunkStats,
  filterChunks,
} from './code-chunker.js';

describe('Code Chunker', () => {
  describe('Language Detection', () => {
    it('should detect TypeScript files', () => {
      expect(detectLanguage('file.ts')).toBe('typescript');
    });

    it('should detect TSX files', () => {
      expect(detectLanguage('Component.tsx')).toBe('tsx');
    });

    it('should detect JavaScript files', () => {
      expect(detectLanguage('script.js')).toBe('javascript');
    });

    it('should detect JSX files', () => {
      expect(detectLanguage('Component.jsx')).toBe('jsx');
    });

    it('should detect .mjs as JavaScript', () => {
      expect(detectLanguage('module.mjs')).toBe('javascript');
    });

    it('should detect .cjs as JavaScript', () => {
      expect(detectLanguage('module.cjs')).toBe('javascript');
    });

    it('should return null for unsupported extensions', () => {
      expect(detectLanguage('file.py')).toBeNull();
      expect(detectLanguage('file.rb')).toBeNull();
      expect(detectLanguage('file.unknown')).toBeNull();
    });

    it('should handle paths with multiple dots', () => {
      expect(detectLanguage('/path/to/file.test.ts')).toBe('typescript');
    });
  });

  describe('Parse TypeScript', () => {
    it('should extract file-level chunk', () => {
      const code = `const greeting = "Hello, World!";`;
      const tempFile = join(tmpdir(), `test-${Date.now()}.ts`);

      try {
        writeFileSync(tempFile, code);
        const chunks = parseFile(tempFile);

        expect(chunks.length).toBeGreaterThan(0);

        const fileChunk = chunks.find(c => c.level === 'file');
        expect(fileChunk).toBeTruthy();
        expect(fileChunk.name).toContain('.ts');
        expect(fileChunk.content).toBe(code);
      } finally {
        if (existsSync(tempFile)) unlinkSync(tempFile);
      }
    });

    it('should extract function declarations', () => {
      const code = `
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
      `.trim();

      const tempFile = join(tmpdir(), `test-${Date.now()}.ts`);

      try {
        writeFileSync(tempFile, code);
        const chunks = parseFile(tempFile);

        const funcChunks = chunks.filter(c => c.level === 'function');
        expect(funcChunks.length).toBeGreaterThan(0);

        const greetFunc = funcChunks.find(c => c.name === 'greet');
        expect(greetFunc).toBeTruthy();
        expect(greetFunc.startLine).toBe(1);
        expect(greetFunc.content).toContain('greet');
      } finally {
        if (existsSync(tempFile)) unlinkSync(tempFile);
      }
    });

    it('should extract class declarations', () => {
      const code = `
class UserService {
  constructor(private db: Database) {}

  findUser(id: number) {
    return this.db.query('SELECT * FROM users WHERE id = ?', id);
  }
}
      `.trim();

      const tempFile = join(tmpdir(), `test-${Date.now()}.ts`);

      try {
        writeFileSync(tempFile, code);
        const chunks = parseFile(tempFile);

        const classChunks = chunks.filter(c => c.level === 'class');
        expect(classChunks.length).toBeGreaterThan(0);

        const userService = classChunks.find(c => c.name === 'UserService');
        expect(userService).toBeTruthy();
        expect(userService.content).toContain('class UserService');
      } finally {
        if (existsSync(tempFile)) unlinkSync(tempFile);
      }
    });

    it('should extract methods from classes', () => {
      const code = `
class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }

  multiply(a: number, b: number): number {
    return a * b;
  }
}
      `.trim();

      const tempFile = join(tmpdir(), `test-${Date.now()}.ts`);

      try {
        writeFileSync(tempFile, code);
        const chunks = parseFile(tempFile);

        const methodChunks = chunks.filter(c => c.level === 'method');
        expect(methodChunks.length).toBe(2);

        const addMethod = methodChunks.find(c => c.name === 'add');
        const multiplyMethod = methodChunks.find(c => c.name === 'multiply');

        expect(addMethod).toBeTruthy();
        expect(multiplyMethod).toBeTruthy();
      } finally {
        if (existsSync(tempFile)) unlinkSync(tempFile);
      }
    });

    it('should extract interfaces', () => {
      const code = `
interface User {
  id: number;
  name: string;
  email: string;
}
      `.trim();

      const tempFile = join(tmpdir(), `test-${Date.now()}.ts`);

      try {
        writeFileSync(tempFile, code);
        const chunks = parseFile(tempFile);

        const interfaceChunks = chunks.filter(c => c.level === 'class' && c.content.includes('interface'));
        expect(interfaceChunks.length).toBeGreaterThan(0);
      } finally {
        if (existsSync(tempFile)) unlinkSync(tempFile);
      }
    });

    it('should extract arrow functions', () => {
      const code = `
const add = (a: number, b: number): number => a + b;
      `.trim();

      const tempFile = join(tmpdir(), `test-${Date.now()}.ts`);

      try {
        writeFileSync(tempFile, code);
        const chunks = parseFile(tempFile);

        const funcChunks = chunks.filter(c => c.level === 'function');
        expect(funcChunks.length).toBeGreaterThan(0);
      } finally {
        if (existsSync(tempFile)) unlinkSync(tempFile);
      }
    });

    it('should handle complex nested structures', () => {
      const code = `
class Service {
  private helper = {
    process() {
      return 42;
    }
  };

  public async execute() {
    return this.helper.process();
  }
}
      `.trim();

      const tempFile = join(tmpdir(), `test-${Date.now()}.ts`);

      try {
        writeFileSync(tempFile, code);
        const chunks = parseFile(tempFile);

        expect(chunks.length).toBeGreaterThan(0);

        const classChunk = chunks.find(c => c.level === 'class');
        const methodChunks = chunks.filter(c => c.level === 'method');

        expect(classChunk).toBeTruthy();
        expect(methodChunks.length).toBeGreaterThan(0);
      } finally {
        if (existsSync(tempFile)) unlinkSync(tempFile);
      }
    });
  });

  describe('Parse JavaScript', () => {
    it('should extract function declarations', () => {
      const code = `
function greet(name) {
  return 'Hello, ' + name + '!';
}
      `.trim();

      const tempFile = join(tmpdir(), `test-${Date.now()}.js`);

      try {
        writeFileSync(tempFile, code);
        const chunks = parseFile(tempFile);

        const funcChunks = chunks.filter(c => c.level === 'function');
        expect(funcChunks.length).toBeGreaterThan(0);

        const greetFunc = funcChunks.find(c => c.name === 'greet');
        expect(greetFunc).toBeTruthy();
      } finally {
        if (existsSync(tempFile)) unlinkSync(tempFile);
      }
    });

    it('should extract class declarations', () => {
      const code = `
class User {
  constructor(name) {
    this.name = name;
  }

  greet() {
    return 'Hello, ' + this.name;
  }
}
      `.trim();

      const tempFile = join(tmpdir(), `test-${Date.now()}.js`);

      try {
        writeFileSync(tempFile, code);
        const chunks = parseFile(tempFile);

        const classChunks = chunks.filter(c => c.level === 'class');
        const methodChunks = chunks.filter(c => c.level === 'method');

        expect(classChunks.length).toBeGreaterThan(0);
        expect(methodChunks.length).toBeGreaterThan(0);
      } finally {
        if (existsSync(tempFile)) unlinkSync(tempFile);
      }
    });
  });

  describe('Parse TSX/JSX', () => {
    it('should extract React function components', () => {
      const code = `
export function Button({ label, onClick }) {
  return <button onClick={onClick}>{label}</button>;
}
      `.trim();

      const tempFile = join(tmpdir(), `test-${Date.now()}.tsx`);

      try {
        writeFileSync(tempFile, code);
        const chunks = parseFile(tempFile);

        const funcChunks = chunks.filter(c => c.level === 'function');
        expect(funcChunks.length).toBeGreaterThan(0);

        const buttonFunc = funcChunks.find(c => c.name === 'Button');
        expect(buttonFunc).toBeTruthy();
        expect(buttonFunc.content).toContain('<button');
      } finally {
        if (existsSync(tempFile)) unlinkSync(tempFile);
      }
    });

    it('should extract React class components', () => {
      const code = `
class Counter extends React.Component {
  render() {
    return <div>{this.props.count}</div>;
  }
}
      `.trim();

      const tempFile = join(tmpdir(), `test-${Date.now()}.tsx`);

      try {
        writeFileSync(tempFile, code);
        const chunks = parseFile(tempFile);

        const classChunks = chunks.filter(c => c.level === 'class');
        const methodChunks = chunks.filter(c => c.level === 'method');

        expect(classChunks.length).toBeGreaterThan(0);
        expect(methodChunks.length).toBeGreaterThan(0);
      } finally {
        if (existsSync(tempFile)) unlinkSync(tempFile);
      }
    });
  });

  describe('Chunk Properties', () => {
    it('should include all required chunk properties', () => {
      const code = `
function test() {
  return "test";
}
      `.trim();

      const tempFile = join(tmpdir(), `test-${Date.now()}.ts`);

      try {
        writeFileSync(tempFile, code);
        const chunks = parseFile(tempFile);

        chunks.forEach(chunk => {
          expect(chunk).toHaveProperty('level');
          expect(chunk).toHaveProperty('name');
          expect(chunk).toHaveProperty('startLine');
          expect(chunk).toHaveProperty('endLine');
          expect(chunk).toHaveProperty('content');
          expect(chunk).toHaveProperty('language');
        });
      } finally {
        if (existsSync(tempFile)) unlinkSync(tempFile);
      }
    });

    it('should have correct line numbers', () => {
      const code = `// Line 1
// Line 2
function test() {  // Line 3
  return "test";   // Line 4
}                  // Line 5`;

      const tempFile = join(tmpdir(), `test-${Date.now()}.ts`);

      try {
        writeFileSync(tempFile, code);
        const chunks = parseFile(tempFile);

        const funcChunk = chunks.find(c => c.level === 'function' && c.name === 'test');
        expect(funcChunk).toBeTruthy();
        expect(funcChunk.startLine).toBe(3);
        expect(funcChunk.endLine).toBe(5);
      } finally {
        if (existsSync(tempFile)) unlinkSync(tempFile);
      }
    });

    it('should extract correct content', () => {
      const code = `
function greet(name: string) {
  return \`Hello, \${name}!\`;
}
      `.trim();

      const tempFile = join(tmpdir(), `test-${Date.now()}.ts`);

      try {
        writeFileSync(tempFile, code);
        const chunks = parseFile(tempFile);

        const funcChunk = chunks.find(c => c.level === 'function');
        expect(funcChunk.content).toContain('function greet');
        expect(funcChunk.content).toContain('name: string');
      } finally {
        if (existsSync(tempFile)) unlinkSync(tempFile);
      }
    });
  });

  describe('parseFile with content parameter', () => {
    it('should parse from provided content instead of reading file', () => {
      const code = `function test() { return 42; }`;
      const tempFile = join(tmpdir(), `test-${Date.now()}.ts`);

      // Create empty file
      writeFileSync(tempFile, '');

      try {
        const chunks = parseFile(tempFile, code);

        const funcChunk = chunks.find(c => c.level === 'function');
        expect(funcChunk).toBeTruthy();
        expect(funcChunk.content).toContain('return 42');
      } finally {
        if (existsSync(tempFile)) unlinkSync(tempFile);
      }
    });
  });

  describe('parseFiles (batch)', () => {
    it('should parse multiple files at once', () => {
      const tempDir = join(tmpdir(), `test-batch-${Date.now()}`);
      mkdirSync(tempDir, { recursive: true });

      const file1 = join(tempDir, 'file1.ts');
      const file2 = join(tempDir, 'file2.ts');

      writeFileSync(file1, 'function test1() {}');
      writeFileSync(file2, 'function test2() {}');

      try {
        const results = parseFiles([file1, file2]);

        // parseFiles returns an object, not an array
        expect(Object.keys(results)).toHaveLength(2);
        expect(results[file1]).toBeTruthy();
        expect(results[file2]).toBeTruthy();
        expect(results[file1].length).toBeGreaterThan(0);
        expect(results[file2].length).toBeGreaterThan(0);
      } finally {
        unlinkSync(file1);
        unlinkSync(file2);
      }
    });

    it('should handle errors gracefully', () => {
      const nonExistent = join(tmpdir(), 'nonexistent.ts');
      const results = parseFiles([nonExistent]);

      // parseFiles returns an object with null for errors
      expect(Object.keys(results)).toHaveLength(1);
      expect(results[nonExistent]).toBeNull();
    });
  });

  describe('getChunkStats', () => {
    it('should calculate chunk statistics', () => {
      const chunks = [
        { level: 'file', name: 'test.ts', startLine: 1, endLine: 20, content: 'content', language: 'typescript' },
        { level: 'class', name: 'A', startLine: 1, endLine: 10, content: 'class A', language: 'typescript' },
        { level: 'function', name: 'func1', startLine: 11, endLine: 15, content: 'func1', language: 'typescript' },
        { level: 'function', name: 'func2', startLine: 16, endLine: 20, content: 'func2', language: 'typescript' },
      ];

      const stats = getChunkStats(chunks);

      expect(stats.total).toBe(4);
      expect(stats.byLevel.file).toBe(1);
      expect(stats.byLevel.class).toBe(1);
      expect(stats.byLevel.function).toBe(2);
    });
  });

  describe('filterChunks', () => {
    it('should filter chunks by level', () => {
      const chunks = [
        { level: 'file', name: 'test.ts', startLine: 1, endLine: 20, content: 'content', language: 'typescript' },
        { level: 'class', name: 'A', startLine: 1, endLine: 10, content: 'class A', language: 'typescript' },
        { level: 'function', name: 'func1', startLine: 11, endLine: 15, content: 'func1', language: 'typescript' },
        { level: 'method', name: 'method1', startLine: 5, endLine: 7, content: 'method1', language: 'typescript' },
      ];

      const functionsOnly = filterChunks(chunks, ['function']);
      expect(functionsOnly).toHaveLength(1);
      expect(functionsOnly[0].level).toBe('function');

      const classesAndMethods = filterChunks(chunks, ['class', 'method']);
      expect(classesAndMethods).toHaveLength(2);
    });

    it('should return empty array when filtering with empty levels', () => {
      const chunks = [
        { level: 'file', name: 'test.ts', startLine: 1, endLine: 20, content: 'content', language: 'typescript' },
        { level: 'function', name: 'func1', startLine: 11, endLine: 15, content: 'func1', language: 'typescript' },
      ];

      // filterChunks with empty array returns empty (no levels to match)
      const result = filterChunks(chunks, []);
      expect(result).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should throw for non-existent file without content', () => {
      const nonExistent = join(tmpdir(), 'nonexistent.ts');
      expect(() => parseFile(nonExistent)).toThrow();
    });

    it('should throw for unsupported file type', () => {
      const pythonFile = join(tmpdir(), `test-${Date.now()}.py`);
      writeFileSync(pythonFile, 'def test(): pass');

      try {
        expect(() => parseFile(pythonFile)).toThrow('Unsupported file type');
      } finally {
        if (existsSync(pythonFile)) unlinkSync(pythonFile);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty files', () => {
      const code = '';
      const tempFile = join(tmpdir(), `test-${Date.now()}.ts`);

      try {
        writeFileSync(tempFile, code);
        const chunks = parseFile(tempFile);

        // Should at least have file-level chunk
        const fileChunk = chunks.find(c => c.level === 'file');
        expect(fileChunk).toBeTruthy();
      } finally {
        if (existsSync(tempFile)) unlinkSync(tempFile);
      }
    });

    it('should handle files with only comments', () => {
      const code = `
// This is a comment
/* This is a block comment */
      `.trim();

      const tempFile = join(tmpdir(), `test-${Date.now()}.ts`);

      try {
        writeFileSync(tempFile, code);
        const chunks = parseFile(tempFile);

        // Should have file chunk but no function/class chunks
        expect(chunks.some(c => c.level === 'file')).toBe(true);
      } finally {
        if (existsSync(tempFile)) unlinkSync(tempFile);
      }
    });

    it('should handle very large files', () => {
      // Create a file with many functions
      const functions = [];
      for (let i = 0; i < 100; i++) {
        functions.push(`function func${i}() { return ${i}; }`);
      }
      const code = functions.join('\n\n');

      const tempFile = join(tmpdir(), `test-${Date.now()}.ts`);

      try {
        writeFileSync(tempFile, code);
        const chunks = parseFile(tempFile);

        const funcChunks = chunks.filter(c => c.level === 'function');
        expect(funcChunks.length).toBe(100);
      } finally {
        if (existsSync(tempFile)) unlinkSync(tempFile);
      }
    });

    it('should handle unicode and special characters', () => {
      const code = `
function グリート(名前: string) {
  return \`こんにちは、\${名前}さん！\`;
}
      `.trim();

      const tempFile = join(tmpdir(), `test-${Date.now()}.ts`);

      try {
        writeFileSync(tempFile, code, 'utf8');
        const chunks = parseFile(tempFile);

        const funcChunk = chunks.find(c => c.level === 'function');
        expect(funcChunk).toBeTruthy();
        expect(funcChunk.content).toContain('グリート');
        expect(funcChunk.content).toContain('こんにちは');
      } finally {
        if (existsSync(tempFile)) unlinkSync(tempFile);
      }
    });
  });
});
