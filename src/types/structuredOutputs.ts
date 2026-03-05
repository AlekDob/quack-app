/**
 * Structured Outputs Types
 *
 * Type definitions for Claude Agent SDK structured outputs.
 * These types ensure type safety when working with validated JSON responses from agents.
 */

// JSON Schema base types
interface JSONSchema {
  type: string;
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  required?: string[];
  enum?: string[];
  const?: unknown;
  minimum?: number;
  maximum?: number;
  format?: string;
  additionalProperties?: boolean | JSONSchema;
  $ref?: string;
  definitions?: Record<string, JSONSchema>;
}

// Output format configuration
interface OutputFormat {
  type: 'json_schema';
  json_schema: JSONSchema;
}

// ===== Web Analysis Schema =====
export interface WebAnalysisOutput {
  title: string;
  summary: string;
  key_points: string[];
  links: Array<{
    url: string;
    description: string;
  }>;
  confidence_score?: number;
  metadata?: {
    word_count?: number;
    reading_time_minutes?: number;
    last_updated?: string;
  };
}

const webAnalysisSchema: JSONSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    key_points: {
      type: 'array',
      items: { type: 'string' }
    },
    links: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          url: { type: 'string', format: 'uri' },
          description: { type: 'string' }
        },
        required: ['url', 'description']
      }
    },
    confidence_score: {
      type: 'number',
      minimum: 0,
      maximum: 1
    },
    metadata: {
      type: 'object',
      properties: {
        word_count: { type: 'number' },
        reading_time_minutes: { type: 'number' },
        last_updated: { type: 'string', format: 'date-time' }
      }
    }
  },
  required: ['title', 'summary', 'key_points']
};

// ===== Bug Report Schema =====
export type BugSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface BugIssue {
  severity: BugSeverity;
  file: string;
  line?: number;
  description: string;
  suggested_fix?: string;
  category?: string;
  impact?: string;
}

export interface BugReportOutput {
  bugs_found: BugIssue[];
  total_issues: number;
  summary?: string;
  risk_score?: number;
}

const bugReportSchema: JSONSchema = {
  type: 'object',
  properties: {
    bugs_found: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: {
            type: 'string',
            enum: ['critical', 'high', 'medium', 'low']
          },
          file: { type: 'string' },
          line: { type: 'number' },
          description: { type: 'string' },
          suggested_fix: { type: 'string' },
          category: { type: 'string' },
          impact: { type: 'string' }
        },
        required: ['severity', 'file', 'description']
      }
    },
    total_issues: { type: 'number' },
    summary: { type: 'string' },
    risk_score: {
      type: 'number',
      minimum: 0,
      maximum: 10
    }
  },
  required: ['bugs_found', 'total_issues']
};

// ===== File Analysis Schema =====
export interface FunctionInfo {
  name: string;
  lines: number;
  parameters: number;
  complexity?: number;
  start_line?: number;
  end_line?: number;
}

export interface FileAnalysisOutput {
  language: string;
  complexity_score: number;
  functions: FunctionInfo[];
  dependencies: string[];
  total_lines?: number;
  code_quality_score?: number;
  suggestions?: string[];
}

const fileAnalysisSchema: JSONSchema = {
  type: 'object',
  properties: {
    language: { type: 'string' },
    complexity_score: {
      type: 'number',
      minimum: 0,
      maximum: 100
    },
    functions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          lines: { type: 'number' },
          parameters: { type: 'number' },
          complexity: { type: 'number' },
          start_line: { type: 'number' },
          end_line: { type: 'number' }
        },
        required: ['name', 'lines', 'parameters']
      }
    },
    dependencies: {
      type: 'array',
      items: { type: 'string' }
    },
    total_lines: { type: 'number' },
    code_quality_score: {
      type: 'number',
      minimum: 0,
      maximum: 100
    },
    suggestions: {
      type: 'array',
      items: { type: 'string' }
    }
  },
  required: ['language', 'complexity_score', 'functions', 'dependencies']
};

// ===== Structured Output Result =====
interface StructuredOutputResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  raw_output?: string;
}

// ===== Schema Validators =====
export function isWebAnalysisOutput(data: unknown): data is WebAnalysisOutput {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  return (
    typeof obj.title === 'string' &&
    typeof obj.summary === 'string' &&
    Array.isArray(obj.key_points) &&
    obj.key_points.every((item: unknown) => typeof item === 'string')
  );
}

export function isBugReportOutput(data: unknown): data is BugReportOutput {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  return (
    Array.isArray(obj.bugs_found) &&
    typeof obj.total_issues === 'number'
  );
}

export function isFileAnalysisOutput(data: unknown): data is FileAnalysisOutput {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  return (
    typeof obj.language === 'string' &&
    typeof obj.complexity_score === 'number' &&
    Array.isArray(obj.functions) &&
    Array.isArray(obj.dependencies)
  );
}
