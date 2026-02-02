#!/usr/bin/env node

/**
 * Codebase Map Generator
 * Scans .ts/.tsx files and extracts exports into a compact markdown map.
 * Pure Node.js, zero dependencies.
 *
 * Usage:
 *   node scripts/generate-codebase-map.mjs [projectPath] [outputPath]
 *   node scripts/generate-codebase-map.mjs --update-file src/foo.ts [projectPath] [outputPath]
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'fs';
import { join, relative, dirname, basename, extname } from 'path';

const EXCLUDED_DIRS = new Set([
  'node_modules', 'dist', '.next', 'target', '.quack', '.claude', '.git', 'coverage', 'build',
]);

const VALID_EXTENSIONS = new Set(['.ts', '.tsx']);

const MAX_SIG_LENGTH = 100;

// --- File discovery ---

function collectFiles(dir, rootDir) {
  const results = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.') continue;
    if (EXCLUDED_DIRS.has(entry.name)) continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(fullPath, rootDir));
    } else if (VALID_EXTENSIONS.has(extname(entry.name))) {
      results.push(fullPath);
    }
  }
  return results;
}

// --- Export extraction (regex-based) ---

function extractExports(content) {
  const exports = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed === '') continue;

    // Re-exports: export { ... } from '...'
    const reExport = trimmed.match(/^export\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/);
    if (reExport) {
      const names = reExport[1].split(',').map(n => n.trim().split(/\s+as\s+/).pop().trim());
      const source = reExport[2];
      for (const name of names) {
        if (name) exports.push(`re-export \`${name}\` from '${source}'`);
      }
      continue;
    }

    // export default function/class
    const defaultFn = trimmed.match(/^export\s+default\s+function\s+(\w+)?\s*(\([^)]*\))?/);
    if (defaultFn) {
      const name = defaultFn[1] || 'anonymous';
      const params = defaultFn[2] || '()';
      const ret = extractReturnType(trimmed);
      exports.push(formatFn(name, params, ret, true));
      continue;
    }

    const defaultClass = trimmed.match(/^export\s+default\s+class\s+(\w+)/);
    if (defaultClass) {
      exports.push(`export default class \`${defaultClass[1]}\``);
      continue;
    }

    if (trimmed.match(/^export\s+default\s+/)) {
      const rest = trimmed.replace(/^export\s+default\s+/, '').replace(/;$/, '').trim();
      if (rest && !rest.startsWith('{') && !rest.startsWith('(')) {
        exports.push(`export default \`${truncate(rest)}\``);
      }
      continue;
    }

    // export function
    const expFn = trimmed.match(/^export\s+(async\s+)?function\s+(\w+)\s*(\([^)]*\))?/);
    if (expFn) {
      const name = expFn[2];
      const params = expFn[3] || '()';
      const ret = extractReturnType(trimmed);
      exports.push(formatFn(name, params, ret, false));
      continue;
    }

    // export const/let/var with arrow function or value
    const expConst = trimmed.match(/^export\s+(const|let|var)\s+(\w+)/);
    if (expConst) {
      const name = expConst[2];
      if (isArrowFunction(trimmed, lines, i)) {
        const params = extractArrowParams(trimmed);
        const ret = extractArrowReturn(trimmed);
        exports.push(formatFn(name, params, ret, false));
      } else {
        const typeHint = extractConstType(trimmed);
        exports.push(`export const \`${name}${typeHint}\``);
      }
      continue;
    }

    // export interface
    const expIface = trimmed.match(/^export\s+interface\s+(\w+)(<[^>]+>)?/);
    if (expIface) {
      const name = expIface[1] + (expIface[2] || '');
      const fields = extractBraceFields(lines, i);
      exports.push(`export type \`${name}${fields}\``);
      continue;
    }

    // export type
    const expType = trimmed.match(/^export\s+type\s+(\w+)(<[^>]+>)?/);
    if (expType) {
      const name = expType[1] + (expType[2] || '');
      const assignment = trimmed.match(/=\s*(.+)/);
      const shortVal = assignment ? ` = ${truncate(assignment[1].replace(/;$/, ''), 60)}` : '';
      exports.push(`export type \`${name}${shortVal}\``);
      continue;
    }

    // export class
    const expClass = trimmed.match(/^export\s+class\s+(\w+)/);
    if (expClass) {
      exports.push(`export class \`${expClass[1]}\``);
      continue;
    }

    // export enum
    const expEnum = trimmed.match(/^export\s+(const\s+)?enum\s+(\w+)/);
    if (expEnum) {
      exports.push(`export enum \`${expEnum[2]}\``);
      continue;
    }
  }

  return exports;
}

function extractReturnType(line) {
  const match = line.match(/\):\s*([^{]+)/);
  return match ? match[1].trim().replace(/\{$/, '').trim() : '';
}

function extractArrowParams(line) {
  const match = line.match(/=\s*(\([^)]*\))/);
  return match ? match[1] : '()';
}

function extractArrowReturn(line) {
  // Pattern: (params): ReturnType =>
  const match = line.match(/\):\s*([^=]+)=>/);
  return match ? match[1].trim() : '';
}

function isArrowFunction(line, lines, idx) {
  // Check current and next few lines for =>
  const chunk = line + (lines[idx + 1] || '') + (lines[idx + 2] || '');
  return /=\s*(\([^)]*\)|[a-zA-Z_]\w*)\s*(:\s*[^=]+)?=>/.test(chunk)
    || /=\s*\(/.test(line);
}

function extractConstType(line) {
  const match = line.match(/:\s*([^=]+)=/);
  return match ? `: ${match[1].trim()}` : '';
}

function extractBraceFields(lines, startIdx) {
  const line = lines[startIdx];
  if (!line.includes('{')) return '';
  // Grab top-level field names from next few lines
  const fields = [];
  for (let i = startIdx + 1; i < Math.min(startIdx + 20, lines.length); i++) {
    const t = lines[i].trim();
    if (t === '}' || t.startsWith('}')) break;
    const fieldMatch = t.match(/^(\w+)[\s?:]/);
    if (fieldMatch) fields.push(fieldMatch[1]);
  }
  return fields.length > 0 ? ` { ${fields.join(', ')} }` : '';
}

function formatFn(name, params, ret, isDefault) {
  const prefix = isDefault ? 'export default fn' : 'export fn';
  const retStr = ret ? `: ${ret}` : '';
  return `${prefix} \`${truncate(`${name}${params}${retStr}`)}\``;
}

function truncate(str, max = MAX_SIG_LENGTH) {
  str = str.replace(/\s+/g, ' ').trim();
  return str.length > max ? str.slice(0, max - 3) + '...' : str;
}

// --- Map generation ---

function generateMap(projectPath, filePaths) {
  const projectName = basename(projectPath);
  const fileEntries = [];

  for (const filePath of filePaths) {
    let content;
    try {
      content = readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }
    const exports = extractExports(content);
    if (exports.length === 0) continue;
    const relPath = relative(projectPath, filePath);
    fileEntries.push({ relPath, exports });
  }

  fileEntries.sort((a, b) => a.relPath.localeCompare(b.relPath));

  const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const totalExports = fileEntries.reduce((sum, f) => sum + f.exports.length, 0);

  let md = `---\ntype: codebase-map\nproject: ${projectName}\ngenerated: ${now}\n`;
  md += `files: ${fileEntries.length}\nexports: ${totalExports}\n---\n\n# Codebase Map\n`;

  for (const entry of fileEntries) {
    md += `\n## ${entry.relPath}\n`;
    for (const exp of entry.exports) {
      md += `- ${exp}\n`;
    }
  }

  return md;
}

// --- Incremental update ---

function updateSingleFile(targetFile, projectPath, outputPath) {
  const absTarget = targetFile.startsWith('/') ? targetFile : join(projectPath, targetFile);
  const relPath = relative(projectPath, absTarget);

  let content;
  try {
    content = readFileSync(absTarget, 'utf-8');
  } catch (err) {
    console.error(`Cannot read ${absTarget}: ${err.message}`);
    process.exit(1);
  }

  const exports = extractExports(content);
  let existingMap;
  try {
    existingMap = readFileSync(outputPath, 'utf-8');
  } catch {
    console.log('No existing map found, running full scan instead.');
    return null; // signal to run full scan
  }

  // Build new section
  let newSection = '';
  if (exports.length > 0) {
    newSection = `\n## ${relPath}\n`;
    for (const exp of exports) {
      newSection += `- ${exp}\n`;
    }
  }

  // Find and replace existing section or insert in sorted position
  const sectionRegex = new RegExp(`\\n## ${escapeRegex(relPath)}\\n(?:- [^\\n]+\\n)*`, 'g');
  if (sectionRegex.test(existingMap)) {
    existingMap = existingMap.replace(sectionRegex, newSection);
  } else if (exports.length > 0) {
    // Insert in sorted position
    const sectionHeaders = [...existingMap.matchAll(/\n## ([^\n]+)\n/g)];
    let insertPos = existingMap.length;
    for (const match of sectionHeaders) {
      if (match[1].localeCompare(relPath) > 0) {
        insertPos = match.index;
        break;
      }
    }
    existingMap = existingMap.slice(0, insertPos) + newSection + existingMap.slice(insertPos);
  }

  // Update frontmatter counts
  existingMap = updateFrontmatterCounts(existingMap);
  return existingMap;
}

function updateFrontmatterCounts(md) {
  const sections = md.match(/\n## [^\n]+\n/g) || [];
  const exportLines = md.match(/\n- [^\n]+/g) || [];
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  md = md.replace(/^(generated: ).+$/m, `$1${now}`);
  md = md.replace(/^(files: )\d+$/m, `$1${sections.length}`);
  md = md.replace(/^(exports: )\d+$/m, `$1${exportLines.length}`);
  return md;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// --- CLI entrypoint ---

function main() {
  const args = process.argv.slice(2);

  let updateFile = null;
  let positional = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--update-file' && args[i + 1]) {
      updateFile = args[++i];
    } else if (!args[i].startsWith('-')) {
      positional.push(args[i]);
    }
  }

  const projectPath = positional[0] || process.cwd();
  const outputPath = positional[1] || join(projectPath, '.quack', 'codebase-map.md');

  // Ensure output directory exists
  const outDir = dirname(outputPath);
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  const start = performance.now();

  if (updateFile) {
    const result = updateSingleFile(updateFile, projectPath, outputPath);
    if (result !== null) {
      writeFileSync(outputPath, result, 'utf-8');
      const elapsed = (performance.now() - start).toFixed(0);
      console.log(`Updated ${updateFile} in map (${elapsed}ms) -> ${outputPath}`);
      return;
    }
    // fallthrough to full scan if no existing map
  }

  // Full scan
  const files = collectFiles(projectPath, projectPath);
  const md = generateMap(projectPath, files);
  writeFileSync(outputPath, md, 'utf-8');

  const elapsed = (performance.now() - start).toFixed(0);
  const fileCount = (md.match(/\n## /g) || []).length;
  const exportCount = (md.match(/\n- /g) || []).length;
  console.log(`Scanned ${files.length} files, mapped ${fileCount} files with ${exportCount} exports (${elapsed}ms)`);
  console.log(`Output: ${outputPath}`);
}

main();
