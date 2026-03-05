/**
 * Trigger Quality System
 * Utilities for detecting categories, calculating quality, and generating smart triggers
 */

// Quality score weights - extracted for clarity and maintainability
export const QUALITY_WEIGHTS = {
  LENGTH_LONG: 30,      // > 50 chars
  LENGTH_MEDIUM: 15,    // > 20 chars
  FILE_PATTERN: 25,     // .ts, .tsx, etc.
  FOLDER_PATH: 25,      // /components, /src, etc.
  KEYWORDS: 15,         // contains, includes, etc.
  NUMBERS: 10,          // numeric values
  VAGUE_PENALTY: -20,   // penalty for vague triggers
} as const;

// Quality levels
export type QualityLevel = 'weak' | 'moderate' | 'strong';

export interface TriggerQuality {
  level: QualityLevel;
  score: number;
  message: string;
}

/**
 * Detect trigger category from skill/droid name and description
 */
export function detectCategory(name: string, description: string): string {
  const text = `${name} ${description}`.toLowerCase();

  // Check categories in priority order
  if (hasUiKeywords(text)) return 'ui';
  if (hasTestKeywords(text)) return 'test';
  if (hasDocsKeywords(text)) return 'docs';
  if (hasApiKeywords(text)) return 'api';
  if (hasCodeKeywords(text)) return 'code';

  return 'default';
}

function hasUiKeywords(text: string): boolean {
  return text.includes('ui') ||
         text.includes('design') ||
         text.includes('style') ||
         text.includes('ux') ||
         text.includes('component');
}

function hasTestKeywords(text: string): boolean {
  return text.includes('test') ||
         text.includes('spec') ||
         text.includes('coverage') ||
         text.includes('vitest') ||
         text.includes('jest');
}

function hasDocsKeywords(text: string): boolean {
  return text.includes('doc') ||
         text.includes('readme') ||
         text.includes('comment') ||
         text.includes('guide');
}

function hasApiKeywords(text: string): boolean {
  return text.includes('api') ||
         text.includes('backend') ||
         text.includes('endpoint') ||
         text.includes('database') ||
         text.includes('fetch');
}

function hasCodeKeywords(text: string): boolean {
  return text.includes('code') ||
         text.includes('review') ||
         text.includes('refactor') ||
         text.includes('debug');
}

/**
 * Calculate trigger quality score and level
 */
export function calculateTriggerQuality(trigger: string): TriggerQuality {
  const trimmed = trigger.trim();
  const length = trimmed.length;
  const score = calculateScore(trimmed, length);

  return determineQualityLevel(score, length);
}

function calculateScore(trigger: string, length: number): number {
  let score = 0;

  // Length bonus
  if (length > 50) score += QUALITY_WEIGHTS.LENGTH_LONG;
  else if (length > 20) score += QUALITY_WEIGHTS.LENGTH_MEDIUM;

  // Pattern bonuses
  if (hasFilePattern(trigger)) score += QUALITY_WEIGHTS.FILE_PATTERN;
  if (hasFolderPath(trigger)) score += QUALITY_WEIGHTS.FOLDER_PATH;
  if (hasActionKeywords(trigger)) score += QUALITY_WEIGHTS.KEYWORDS;
  if (hasNumbers(trigger)) score += QUALITY_WEIGHTS.NUMBERS;

  // Vagueness penalty
  if (isVagueTrigger(trigger, length)) score += QUALITY_WEIGHTS.VAGUE_PENALTY;

  return score;
}

function hasFilePattern(trigger: string): boolean {
  return /\.(ts|tsx|js|jsx|css|md|test|spec|env|json)/.test(trigger);
}

function hasFolderPath(trigger: string): boolean {
  return /\/[\w-]+/.test(trigger);
}

function hasActionKeywords(trigger: string): boolean {
  return /(contains|includes|with|has|ending|in folder|more than)/i.test(trigger);
}

function hasNumbers(trigger: string): boolean {
  return /\d+/.test(trigger);
}

function isVagueTrigger(trigger: string, length: number): boolean {
  return /(when|if|about|the user asks)/i.test(trigger) && length < 40;
}

function determineQualityLevel(score: number, length: number): TriggerQuality {
  if (score < 30 || length < 20) {
    return {
      level: 'weak',
      score,
      message: 'Too vague - add file patterns, folder paths, or specific keywords',
    };
  }

  if (score < 60 || length < 50) {
    return {
      level: 'moderate',
      score,
      message: 'Good - consider adding more specific patterns or conditions',
    };
  }

  return {
    level: 'strong',
    score,
    message: 'Excellent - specific and actionable trigger',
  };
}

/**
 * Generate a smart trigger based on name, description, and category
 */
export function generateSmartTrigger(
  name: string,
  description: string,
  category: string
): string {
  const text = `${name} ${description}`.toLowerCase();

  switch (category) {
    case 'ui':
      return generateUiTrigger(text);
    case 'code':
      return generateCodeTrigger(text);
    case 'test':
      return generateTestTrigger();
    case 'docs':
      return generateDocsTrigger();
    case 'api':
      return generateApiTrigger();
    default:
      return generateDefaultTrigger(name);
  }
}

function generateUiTrigger(text: string): string {
  const suffix = text.includes('react')
    ? 'React components with className or style props'
    : 'UI-related keywords or design patterns';
  return `When editing files in /components folder that contain ${suffix}`;
}

function generateCodeTrigger(text: string): string {
  let suffix: string;
  if (text.includes('review')) {
    suffix = '"function" or "class" declarations with diff > 10 lines';
  } else if (text.includes('refactor')) {
    suffix = 'complex logic or code smells (TODO, FIXME)';
  } else {
    suffix = 'function declarations or class definitions';
  }
  return `When editing .ts or .tsx files that contain ${suffix}`;
}

function generateTestTrigger(): string {
  return 'When creating files in __tests__ folder ending with .test.ts or .spec.ts, ' +
         'or after modifying any source file in /src folder';
}

function generateDocsTrigger(): string {
  return 'When editing README.md, files in /docs folder, ' +
         'or any file containing @param, @returns, or JSDoc comments';
}

function generateApiTrigger(): string {
  return 'When editing files in /api or /services folder that contain ' +
         '"fetch", "axios", "endpoint", or "http" keywords';
}

function generateDefaultTrigger(name: string): string {
  const folderMatch = name.match(/\b(\w+)-?(expert|specialist|engineer|developer|writer)\b/i);

  if (folderMatch) {
    const topic = folderMatch[1].toLowerCase();
    return `When editing files related to ${topic} in /src folder with diff > 5 lines`;
  }

  return `When editing files that contain "${name.toLowerCase()}" keywords or related patterns`;
}

// CONCRETE, pattern-based trigger suggestions by category
export const TRIGGER_SUGGESTIONS: Record<string, string[]> = {
  'default': [
    'When editing files in specific folder (e.g., /src)',
    'When file contains specific keywords or patterns',
    'When modifying files with specific extensions',
    'When diff contains more than N lines changed',
  ],
  'ui': [
    'When editing files in /components folder',
    'When file contains "className" or "style" keywords',
    'When creating or modifying .css, .scss, or .styled files',
    'When file contains React hooks (useState, useEffect)',
  ],
  'code': [
    'When file contains "function" or "class" declarations',
    'When editing .ts, .tsx, .js, or .jsx files',
    'When diff has more than 10 lines changed',
    'When file contains TODO or FIXME comments',
  ],
  'docs': [
    'When editing README.md or files in /docs folder',
    'When file contains @param or @returns JSDoc comments',
    'When creating or modifying .md or .mdx files',
    'When file name includes "doc", "guide", or "readme"',
  ],
  'test': [
    'When creating files in __tests__ or /tests folder',
    'When file ends with .test.ts, .spec.ts, or .test.tsx',
    'After modifying any .ts file in /src folder',
    'When file contains "describe", "it", or "expect" keywords',
  ],
  'api': [
    'When file contains "fetch", "axios", or "http" keywords',
    'When editing files in /api or /services folder',
    'When modifying .env files or environment variables',
    'When file contains "endpoint", "route", or "handler"',
  ],
};

// Example triggers by category
export const EXAMPLE_TRIGGERS: Record<string, string> = {
  'default': 'When editing files in /src folder that contain "TODO" comments or have more than 50 lines changed',
  'ui': 'When editing files in /components folder that contain React hooks (useState, useEffect) or className attributes',
  'code': 'When editing .ts or .tsx files that contain "function" or "class" declarations with diff > 10 lines',
  'docs': 'When editing README.md, files in /docs folder, or any file containing @param or @returns JSDoc comments',
  'test': 'When creating files in __tests__ folder ending with .test.ts or .spec.ts, or after modifying any .ts file',
  'api': 'When editing files in /api folder that contain "fetch" or "axios", or when modifying .env configuration files',
};
