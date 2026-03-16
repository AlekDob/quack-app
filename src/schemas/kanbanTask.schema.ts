import type { StructuredOutputSchema, StructuredSchemaEntry } from '../types';

/** JSON Schema for AI-generated Kanban tasks */
const kanbanTaskJsonSchema: StructuredOutputSchema = {
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description: 'Short task title (max 80 chars)',
    },
    description: {
      type: 'string',
      description: 'Detailed task description with context',
    },
    priority: {
      type: 'string',
      enum: ['P1', 'P2', 'P3'],
      description: 'Priority level: P1 (critical), P2 (important), P3 (nice-to-have)',
    },
    column: {
      type: 'string',
      enum: ['todo', 'in_progress', 'done'],
      description: 'Target Kanban column',
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
      description: 'Relevant tags (e.g., "bug", "feature", "refactor")',
      minItems: 1,
      maxItems: 5,
    },
  },
  required: ['title', 'description', 'priority', 'column', 'tags'],
};

/** Validated output shape from the schema */
export interface KanbanTaskOutput {
  title: string;
  description: string;
  priority: 'P1' | 'P2' | 'P3';
  column: 'todo' | 'in_progress' | 'done';
  tags: string[];
}

function validateKanbanTask(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.title === 'string' &&
    typeof d.description === 'string' &&
    ['P1', 'P2', 'P3'].includes(d.priority as string) &&
    ['todo', 'in_progress', 'done'].includes(d.column as string) &&
    Array.isArray(d.tags) &&
    d.tags.length >= 1 &&
    d.tags.every((t: unknown) => typeof t === 'string')
  );
}

export const kanbanTaskSchema: StructuredSchemaEntry = {
  name: 'kanbanTask',
  version: '1.0.0',
  jsonSchema: kanbanTaskJsonSchema,
  validate: validateKanbanTask,
};
