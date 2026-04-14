/**
 * Vercel AI SDK tool definitions for agentic workflows.
 * Provides filesystem + search tools scoped to the project root.
 *
 * Pattern: Meow agent (tool() + Zod schemas + execute callbacks).
 * Tools are only passed to models with toolUse: true in the registry.
 */
import { tool } from 'ai';
import { z } from 'zod';
import { resolve, normalize, relative, join } from 'path';
import { readFile, writeFile, readdir, stat, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { exec } from 'child_process';

// === CONSTANTS ===
const MAX_FILE_SIZE = 512_000; // 512KB read limit
const MAX_SEARCH_RESULTS = 30;
const MAX_DIR_ENTRIES = 200;
const BASH_TIMEOUT = 30_000; // 30s per command
const MAX_BASH_OUTPUT = 100_000; // 100KB output cap
const MAX_FETCH_SIZE = 512_000; // 512KB fetch limit
const FETCH_TIMEOUT = 15_000; // 15s fetch timeout

// === SECURITY: PATH VALIDATION ===

/** Resolve and validate path stays within project root */
function safePath(projectRoot, relativePath) {
  if (!relativePath || relativePath.trim() === '') {
    throw new Error('Path must not be empty');
  }
  const full = resolve(projectRoot, normalize(relativePath));
  // WHY: trailing separator prevents sibling-dir escape (/project-evil)
  const rootWithSep = projectRoot.endsWith('/') ? projectRoot : projectRoot + '/';
  if (full !== projectRoot && !full.startsWith(rootWithSep)) {
    throw new Error('Path escapes project root');
  }
  return full;
}

// === TOOL FACTORY ===

/**
 * Build tools scoped to a project directory.
 * @param {string} projectRoot — absolute path to project
 * @returns {Record<string, import('ai').Tool>}
 */
export function buildVercelTools(projectRoot) {
  if (!projectRoot) return {};

  const root = resolve(projectRoot);

  // --- readFile ---
  const fileRead = tool({
    description:
      'Read a file from the project. Path is relative to project root. ' +
      'Returns file content as text. Max 512KB.',
    inputSchema: z.object({
      path: z.string().describe('Relative path from project root'),
    }),
    execute: async ({ path }) => {
      try {
        const full = safePath(root, path);
        const info = await stat(full);
        if (info.size > MAX_FILE_SIZE) {
          return { exists: true, truncated: true, error: `File too large (${info.size} bytes, max ${MAX_FILE_SIZE})` };
        }
        const content = await readFile(full, 'utf-8');
        return { exists: true, content, size: info.size };
      } catch (err) {
        return { exists: false, content: '', error: err.message };
      }
    },
  });

  // --- listDirectory ---
  const listDirectory = tool({
    description:
      'List files and directories. Path relative to project root. ' +
      'Returns names with type indicators (/ for dirs). Max 200 entries.',
    inputSchema: z.object({
      path: z.string().default('.').describe('Relative directory path'),
    }),
    execute: async ({ path }) => {
      try {
        const full = safePath(root, path);
        const entries = await readdir(full, { withFileTypes: true });
        const items = entries
          .filter(e => !e.isDirectory() || !isIgnoredDir(e.name))
          .slice(0, MAX_DIR_ENTRIES)
          .map(e => e.isDirectory() ? `${e.name}/` : e.name);
        return { path, entries: items, total: entries.length };
      } catch (err) {
        return { path, entries: [], error: err.message };
      }
    },
  });

  // --- searchFiles ---
  const searchFiles = tool({
    description:
      'Search for text in project files (like grep). ' +
      'Returns matching lines with file paths and line numbers. Max 30 results.',
    inputSchema: z.object({
      pattern: z.string().describe('Text or regex pattern to search for'),
      glob: z.string().default('*').describe('File glob filter (e.g. "*.ts", "src/**/*.js")'),
    }),
    execute: async ({ pattern, glob: globPattern }) => {
      try {
        const results = await grepFiles(root, pattern, globPattern);
        return { pattern, matches: results.length, results };
      } catch (err) {
        return { pattern, matches: 0, results: [], error: err.message };
      }
    },
  });

  // --- writeFile ---
  const fileWrite = tool({
    description:
      'Write content to a file. Path relative to project root. ' +
      'Creates parent directories if needed. Use for code generation and edits.',
    inputSchema: z.object({
      path: z.string().describe('Relative path from project root'),
      content: z.string().describe('Full file content to write'),
    }),
    execute: async ({ path, content }) => {
      try {
        const full = safePath(root, path);
        await mkdir(resolve(full, '..'), { recursive: true });
        await writeFile(full, content, 'utf-8');
        return { success: true, path };
      } catch (err) {
        return { success: false, path, error: err.message };
      }
    },
  });

  // --- bash ---
  const bash = tool({
    description:
      'Execute a shell command in the project directory. ' +
      'Use for running tests, installing packages, git operations, builds, linters. ' +
      'Timeout: 30s. Output capped at 100KB.',
    inputSchema: z.object({
      command: z.string().describe('Shell command to execute'),
      timeout: z.number().optional().describe('Timeout in ms (default 30000, max 60000)'),
    }),
    execute: async ({ command, timeout }) => {
      const ms = Math.min(timeout || BASH_TIMEOUT, 60_000);
      return new Promise((resolve) => {
        exec(command, { cwd: root, timeout: ms, maxBuffer: MAX_BASH_OUTPUT }, (err, stdout, stderr) => {
          const out = (stdout || '').slice(0, MAX_BASH_OUTPUT);
          const errOut = (stderr || '').slice(0, MAX_BASH_OUTPUT);
          resolve({
            exitCode: err?.code ?? 0,
            stdout: out,
            stderr: errOut,
            ...(err?.killed ? { killed: true, reason: 'timeout' } : {}),
          });
        });
      });
    },
  });

  // --- edit (surgical find & replace) ---
  const fileEdit = tool({
    description:
      'Make a surgical edit to a file: find old_string and replace with new_string. ' +
      'More efficient than rewriting entire files. old_string must be an exact, unique match.',
    inputSchema: z.object({
      path: z.string().describe('Relative path from project root'),
      old_string: z.string().describe('Exact text to find (must be unique in file)'),
      new_string: z.string().describe('Replacement text'),
    }),
    execute: async ({ path, old_string, new_string }) => {
      try {
        const full = safePath(root, path);
        const content = await readFile(full, 'utf-8');
        const count = content.split(old_string).length - 1;
        if (count === 0) {
          return { success: false, error: 'old_string not found in file' };
        }
        if (count > 1) {
          return { success: false, error: `old_string found ${count} times — must be unique. Add more context.` };
        }
        const updated = content.replace(old_string, new_string);
        await writeFile(full, updated, 'utf-8');
        return { success: true, path, replacements: 1 };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
  });

  // --- webFetch ---
  const webFetch = tool({
    description:
      'Fetch a URL and return its text content. ' +
      'Use for reading documentation, API references, web pages. ' +
      'Returns plain text (HTML tags stripped). Max 512KB.',
    inputSchema: z.object({
      url: z.string().describe('URL to fetch'),
    }),
    execute: async ({ url }) => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Quack/1.0 (AI coding assistant)' },
        });
        clearTimeout(timer);
        if (!res.ok) {
          return { success: false, status: res.status, error: res.statusText };
        }
        let text = await res.text();
        if (text.length > MAX_FETCH_SIZE) {
          text = text.slice(0, MAX_FETCH_SIZE) + '\n[...truncated]';
        }
        // Strip HTML tags for cleaner output
        if (text.includes('<html') || text.includes('<body')) {
          text = stripHtml(text);
        }
        return { success: true, url, length: text.length, content: text };
      } catch (err) {
        return { success: false, url, error: err.message };
      }
    },
  });

  // --- patch (unified diff) ---
  const patch = tool({
    description:
      'Apply a unified diff patch to a file. More powerful than edit for multi-block changes. ' +
      'Provide the patch in unified diff format (lines starting with +/- and context lines).',
    inputSchema: z.object({
      path: z.string().describe('Relative path from project root'),
      patch: z.string().describe('Unified diff content (--- a/file, +++ b/file, @@ hunks)'),
    }),
    execute: async ({ path: filePath, patch: patchText }) => {
      try {
        const full = safePath(root, filePath);
        const original = await readFile(full, 'utf-8');
        const patched = applyUnifiedPatch(original, patchText);
        await writeFile(full, patched, 'utf-8');
        return { success: true, path: filePath };
      } catch (err) {
        return { success: false, path: filePath, error: err.message };
      }
    },
  });

  return {
    fileRead, listDirectory, searchFiles, fileWrite,
    bash, fileEdit, webFetch, patch,
  };
}

// === GREP IMPLEMENTATION ===

/**
 * Simple recursive grep scoped to project root.
 * Skips node_modules, .git, and binary files.
 */
async function grepFiles(root, pattern, globPattern) {
  // WHY: pattern comes from model args — must validate before use
  let regex;
  try {
    regex = new RegExp(pattern, 'i');
  } catch {
    return [{ file: '', line: 0, text: `Invalid regex: ${pattern}` }];
  }
  const results = [];

  // WHY: recursive walk with skip list — lighter than spawning rg
  async function walk(dir) {
    if (results.length >= MAX_SEARCH_RESULTS) return;
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (results.length >= MAX_SEARCH_RESULTS) break;
      const fullPath = join(dir, entry.name);

      // Skip ignored directories
      if (entry.isDirectory()) {
        if (isIgnoredDir(entry.name)) continue;
        await walk(fullPath);
        continue;
      }

      // Skip non-text files
      if (!isTextFile(entry.name)) continue;

      // Check glob against relative path for path-qualified patterns
      const relPath = relative(root, fullPath);
      if (globPattern !== '*' && !matchGlob(relPath, globPattern)) continue;

      try {
        // Skip large files during search (S2: cap per-file reads)
        const info = await stat(fullPath);
        if (info.size > MAX_FILE_SIZE) continue;
        const content = await readFile(fullPath, 'utf-8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            const relPath = relative(root, fullPath);
            results.push({ file: relPath, line: i + 1, text: lines[i].trim() });
            if (results.length >= MAX_SEARCH_RESULTS) break;
          }
        }
      } catch { /* skip unreadable files */ }
    }
  }

  await walk(root);
  return results;
}

/** Directories to skip during search and listing */
const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'target', 'dist', 'build',
  '.next', '.nuxt', '.cache', 'coverage', '__pycache__',
]);

function isIgnoredDir(name) {
  return IGNORED_DIRS.has(name);
}

/** Check if file is likely text by extension */
function isTextFile(name) {
  const TEXT_EXTS = new Set([
    '.js', '.ts', '.tsx', '.jsx', '.json', '.md', '.txt',
    '.rs', '.toml', '.yaml', '.yml', '.html', '.css',
    '.scss', '.py', '.go', '.swift', '.vue', '.svelte',
    '.sh', '.bash', '.zsh', '.env', '.sql', '.graphql',
  ]);
  const dot = name.lastIndexOf('.');
  if (dot < 0) return false;
  return TEXT_EXTS.has(name.substring(dot).toLowerCase());
}

/** Glob match against relative file path */
function matchGlob(relPath, pattern) {
  if (pattern === '*') return true;
  // Extension-only: *.ts, *.js
  if (pattern.startsWith('*.')) {
    return relPath.endsWith(pattern.slice(1));
  }
  // Path-qualified: src/**/*.js → check dir prefix + extension
  if (pattern.includes('/')) {
    const parts = pattern.split('*').filter(Boolean);
    return parts.every(part => relPath.includes(part));
  }
  return relPath.includes(pattern.replace(/\*/g, ''));
}

// === HTML STRIPPING ===

/** Strip HTML tags and decode common entities for cleaner LLM consumption */
function stripHtml(html) {
  // Remove script/style blocks entirely
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  // Convert block elements to newlines
  text = text.replace(/<\/(p|div|h[1-6]|li|tr|br\s*\/?)>/gi, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  // Strip remaining tags
  text = text.replace(/<[^>]+>/g, '');
  // Decode entities
  text = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
  // Collapse whitespace
  text = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return text;
}

// === UNIFIED PATCH APPLICATION ===

/**
 * Apply a unified diff patch to file content.
 * Parses @@ hunks and applies +/- lines.
 */
function applyUnifiedPatch(original, patchText) {
  const lines = original.split('\n');
  const patchLines = patchText.split('\n');
  const result = [...lines];
  let offset = 0;

  for (let i = 0; i < patchLines.length; i++) {
    const hunkMatch = patchLines[i].match(/^@@\s*-(\d+)(?:,\d+)?\s*\+\d+(?:,\d+)?\s*@@/);
    if (!hunkMatch) continue;

    let lineIdx = parseInt(hunkMatch[1], 10) - 1 + offset;

    for (let j = i + 1; j < patchLines.length; j++) {
      const pl = patchLines[j];
      if (pl.startsWith('@@') || pl.startsWith('diff ') || pl.startsWith('---') || pl.startsWith('+++')) {
        i = j - 1;
        break;
      }
      if (pl.startsWith('-')) {
        result.splice(lineIdx, 1);
        offset--;
      } else if (pl.startsWith('+')) {
        result.splice(lineIdx, 0, pl.slice(1));
        lineIdx++;
        offset++;
      } else {
        // Context line (space prefix or no prefix)
        lineIdx++;
      }
      if (j === patchLines.length - 1) i = j;
    }
  }

  return result.join('\n');
}
