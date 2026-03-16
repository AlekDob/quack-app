import type { StructuredOutputSchema, StructuredSchemaEntry } from '../types';

/** JSON Schema for AI-generated Brain entries */
const brainEntryJsonSchema: StructuredOutputSchema = {
  type: 'object',
  properties: {
    type: {
      type: 'string',
      enum: ['gotcha', 'pattern', 'bug', 'decision', 'note'],
      description: 'Brain entry type',
    },
    project: {
      type: 'string',
      description: 'Project name (e.g., "quack-app")',
    },
    title: {
      type: 'string',
      description: 'Entry title in slug-friendly format',
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
      description: 'Relevant tags for searchability',
      minItems: 1,
      maxItems: 8,
    },
    content: {
      type: 'string',
      description: 'Markdown body of the entry',
    },
  },
  required: ['type', 'project', 'title', 'tags', 'content'],
};

/** Validated output shape from the schema */
export interface BrainEntryOutput {
  type: 'gotcha' | 'pattern' | 'bug' | 'decision' | 'note';
  project: string;
  title: string;
  tags: string[];
  content: string;
}

function validateBrainEntry(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  const validTypes = ['gotcha', 'pattern', 'bug', 'decision', 'note'];
  return (
    validTypes.includes(d.type as string) &&
    typeof d.project === 'string' &&
    typeof d.title === 'string' &&
    Array.isArray(d.tags) &&
    d.tags.length >= 1 &&
    d.tags.every((t: unknown) => typeof t === 'string') &&
    typeof d.content === 'string'
  );
}

export const brainEntrySchema: StructuredSchemaEntry = {
  name: 'brainEntry',
  version: '1.0.0',
  jsonSchema: brainEntryJsonSchema,
  validate: validateBrainEntry,
};
