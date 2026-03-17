/**
 * Structured Output Service
 *
 * Wrapper that builds an outputFormat config from a registered schema,
 * validates the response, and falls back to text parsing on failure.
 * Retry capped at 1 to avoid infinite loops.
 */

import { getSchema } from '../schemas';
import type { StructuredOutputFormat, StructuredSchemaEntry } from '../types';

/** Result of a structured output generation attempt */
export interface StructuredOutputResult<T = unknown> {
  success: boolean;
  data: T | null;
  raw: string;
  schemaName: string;
  retried: boolean;
}

/** Build an SDK-compatible outputFormat from a schema name */
export function buildOutputFormat(schemaName: string): StructuredOutputFormat | null {
  const schema = getSchema(schemaName);
  if (!schema) return null;

  return {
    type: 'json_schema',
    schema: schema.jsonSchema,
  };
}

/** Parse and validate a raw JSON response against a registered schema */
export function parseStructuredResponse<T>(
  schemaName: string,
  raw: string,
): StructuredOutputResult<T> {
  const schema = getSchema(schemaName);
  if (!schema) {
    return { success: false, data: null, raw, schemaName, retried: false };
  }

  return attemptParse<T>(schema, raw, schemaName);
}

/** Core parse + validate logic */
function attemptParse<T>(
  schema: StructuredSchemaEntry,
  raw: string,
  schemaName: string,
): StructuredOutputResult<T> {
  try {
    const parsed = JSON.parse(raw);

    if (schema.validate(parsed)) {
      return { success: true, data: parsed as T, raw, schemaName, retried: false };
    }

    return { success: false, data: null, raw, schemaName, retried: false };
  } catch {
    return { success: false, data: null, raw, schemaName, retried: false };
  }
}

/**
 * Build a corrective prompt for a retry attempt.
 * Used when the first response fails validation.
 */
export function buildRetryPrompt(schemaName: string, raw: string): string {
  const schema = getSchema(schemaName);
  if (!schema) return '';

  const schemaStr = JSON.stringify(schema.jsonSchema, null, 2);
  return [
    'The previous response did not match the required JSON schema.',
    'Please return ONLY valid JSON matching this schema:',
    '```json',
    schemaStr,
    '```',
    '',
    'Previous (invalid) response:',
    '```',
    raw.substring(0, 500),
    '```',
  ].join('\n');
}

/** Extract JSON from a text response that may contain markdown fences */
export function extractJsonFromText(text: string): string | null {
  // Try to find a JSON code block first
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) return fenceMatch[1].trim();

  // Try to find a raw JSON object
  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) return objectMatch[0].trim();

  return null;
}

/**
 * Full pipeline: parse raw response, extract JSON if needed, validate.
 * Returns validated data or null with the raw text for fallback processing.
 */
export function processStructuredOutput<T>(
  schemaName: string,
  raw: string,
): StructuredOutputResult<T> {
  // First try direct parse
  const direct = parseStructuredResponse<T>(schemaName, raw);
  if (direct.success) return direct;

  // Try extracting JSON from markdown/text
  const extracted = extractJsonFromText(raw);
  if (extracted) {
    const fromExtracted = parseStructuredResponse<T>(schemaName, extracted);
    if (fromExtracted.success) {
      return { ...fromExtracted, retried: true };
    }
  }

  return { success: false, data: null, raw, schemaName, retried: true };
}
