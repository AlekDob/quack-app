import type { StructuredSchemaEntry } from '../types';
import { kanbanTaskSchema } from './kanbanTask.schema';
import { brainEntrySchema } from './brainEntry.schema';

/** Registry of all structured output schemas */
const schemaRegistry = new Map<string, StructuredSchemaEntry>([
  [kanbanTaskSchema.name, kanbanTaskSchema],
  [brainEntrySchema.name, brainEntrySchema],
]);

/** Lookup a schema by name */
export function getSchema(name: string): StructuredSchemaEntry | undefined {
  return schemaRegistry.get(name);
}

/** List all registered schema names */
export function listSchemas(): string[] {
  return Array.from(schemaRegistry.keys());
}

/** Register a new schema (for plugin extensibility) */
export function registerSchema(schema: StructuredSchemaEntry): void {
  schemaRegistry.set(schema.name, schema);
}

export { kanbanTaskSchema } from './kanbanTask.schema';
export { brainEntrySchema } from './brainEntry.schema';
