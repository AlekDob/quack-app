# Quack Brain - Phase 2: Migration Tools

**Status**: ✅ Implemented
**Date**: 2025-01-05
**Branch**: `feature/quack-brain`

## Overview

Phase 2 implements migration tools to import existing data from legacy Quack Memory and MCP Memory into Quack Brain. This enables seamless transition to the unified memory system while preserving historical data.

## Architecture

### Data Sources

1. **MCP Memory** (`~/.npm/_npx/.../memory.jsonl`)
   - MCP Server Memory installation via NPX
   - JSONL format with entities and relations
   - Located in NPX cache directory

2. **Quack Memory** (`quack-memories.json`)
   - Legacy Quack memory store via Tauri Store
   - JSON array format with memory objects
   - Contains content, category, timestamps

### Migration Strategy

#### Idempotent Operations
- All imports are **safe to run multiple times**
- Duplicate detection based on entity name
- Uses `INSERT OR IGNORE` for relations
- Skipped duplicates are tracked in results

#### Data Validation
- Empty content/names are skipped
- Parse errors are logged but don't stop import
- Result includes detailed statistics

#### Error Handling
- Errors collected in results array
- Individual failures don't abort import
- Detailed error messages for debugging

## Implementation

### Backend (Rust)

**File**: `/src-tauri/src/brain/commands.rs`

#### New Types

```rust
/// Import result with detailed statistics
#[derive(Debug, Clone, Serialize)]
pub struct ImportResult {
    pub imported_entities: usize,
    pub imported_relations: usize,
    pub skipped: usize,
    pub errors: Vec<String>,
}

/// Migration status showing available data sources
#[derive(Debug, Clone, Serialize)]
pub struct MigrationStatus {
    pub mcp_memory_available: bool,
    pub mcp_memory_count: usize,
    pub quack_memory_count: usize,
    pub brain_entity_count: usize,
}
```

#### Commands

1. **`brain_import_mcp_memory`**
   - Searches NPX cache for MCP Memory installation
   - Parses JSONL format line by line
   - Imports entities with observations
   - Imports relations (resolves by name)
   - Returns detailed statistics

2. **`brain_import_quack_memory`**
   - Reads from Tauri Store
   - Generates entity names from content (slugified)
   - Preserves original creation timestamps
   - Maps categories to entity types
   - Returns detailed statistics

3. **`brain_get_migration_status`**
   - Checks MCP Memory availability
   - Counts entities in each source
   - Returns current Brain entity count
   - Used for migration UI

### Frontend (TypeScript)

**File**: `/src/services/brainService.ts`

#### Interfaces

```typescript
export interface ImportResult {
  importedEntities: number;
  importedRelations: number;
  skipped: number;
  errors: string[];
}

export interface MigrationStatus {
  mcpMemoryAvailable: boolean;
  mcpMemoryCount: number;
  quackMemoryCount: number;
  brainEntityCount: number;
}
```

#### Functions

```typescript
// Import from MCP Memory
export async function importFromMCPMemory(): Promise<ImportResult>

// Import from Quack Memory
export async function importFromQuackMemory(): Promise<ImportResult>

// Get migration status
export async function getMigrationStatus(): Promise<MigrationStatus>
```

All functions are also available via the singleton:

```typescript
import { brainService } from '@/services/brainService';

const result = await brainService.importFromMCPMemory();
```

## Usage Examples

### Check Migration Status

```typescript
import { getMigrationStatus } from '@/services/brainService';

const status = await getMigrationStatus();

console.log(`MCP Memory: ${status.mcpMemoryCount} entities`);
console.log(`Quack Memory: ${status.quackMemoryCount} entities`);
console.log(`Brain: ${status.brainEntityCount} entities`);

if (status.mcpMemoryAvailable && status.mcpMemoryCount > 0) {
  console.log('MCP Memory import available');
}
```

### Import from MCP Memory

```typescript
import { importFromMCPMemory } from '@/services/brainService';

const result = await importFromMCPMemory();

console.log(`Imported: ${result.importedEntities} entities`);
console.log(`Relations: ${result.importedRelations}`);
console.log(`Skipped: ${result.skipped} duplicates`);

if (result.errors.length > 0) {
  console.warn('Errors:', result.errors);
}
```

### Import from Quack Memory

```typescript
import { importFromQuackMemory } from '@/services/brainService';

const result = await importFromQuackMemory();

console.log(`Imported: ${result.importedEntities} entities`);
console.log(`Skipped: ${result.skipped} duplicates`);
```

### Complete Migration Flow

```typescript
import { brainService } from '@/services/brainService';

// 1. Check status
const status = await brainService.getMigrationStatus();

// 2. Import MCP Memory if available
if (status.mcpMemoryAvailable && status.mcpMemoryCount > 0) {
  const mcpResult = await brainService.importFromMCPMemory();
  console.log('MCP Memory imported:', mcpResult);
}

// 3. Import Quack Memory if available
if (status.quackMemoryCount > 0) {
  const quackResult = await brainService.importFromQuackMemory();
  console.log('Quack Memory imported:', quackResult);
}

// 4. Verify final state
const finalStatus = await brainService.getMigrationStatus();
console.log('Brain entity count:', finalStatus.brainEntityCount);
```

## Data Transformation

### MCP Memory → Brain

**Input** (JSONL):
```json
{"type":"entity","name":"user_preferences","entityType":"preference","observations":["Prefers TypeScript strict mode"]}
{"type":"relation","from":"user_preferences","to":"quack-app","relationType":"belongs_to_project"}
```

**Output** (SQLite):
- Entity: `id`, `name`, `entity_type`, `created_at`, `updated_at`
- Observations: Array of `{ id, content, created_at }`
- Relations: `from_entity_id`, `to_entity_id`, `relation_type`

### Quack Memory → Brain

**Input** (Tauri Store):
```json
{
  "id": "abc123",
  "content": "Fixed authentication bug",
  "category": "bug_fix",
  "createdAt": 1704477600000
}
```

**Output** (SQLite):
- Entity name: `fixed_authentication_bug_abc123` (slugified)
- Entity type: `bug_fix` (from category)
- Observation: Original content
- Timestamps: Preserved from original

## Implementation Details

### MCP Memory Path Resolution

1. Check `~/.npm/_npx/` directory
2. Iterate through NPX cache directories
3. Look for `node_modules/@modelcontextprotocol/server-memory/dist/memory.jsonl`
4. Use first found file

### Entity Name Generation (Quack Memory)

```rust
// Take first 50 chars, slugify, append ID prefix
let name = content.chars()
    .take(50)
    .collect::<String>()
    .to_lowercase()
    .chars()
    .map(|c| if c.is_alphanumeric() { c } else { '_' })
    .collect::<String>();
let name = format!("{}_{}", name.trim_matches('_'), &id[..8]);
```

### Duplicate Detection

**MCP Memory**:
- Check if entity name already exists
- Skip if found (increment `skipped` counter)

**Quack Memory**:
- Generate consistent name from content + ID
- Check if name already exists
- Skip if found (increment `skipped` counter)

## Testing

### Manual Testing

1. **Setup**:
   ```bash
   # Install MCP Memory
   npx @modelcontextprotocol/server-memory

   # Add test entities
   # (via Claude Code with MCP Memory enabled)
   ```

2. **Test MCP Import**:
   ```typescript
   const result = await importFromMCPMemory();
   console.log(result);
   ```

3. **Test Quack Import**:
   ```typescript
   const result = await importFromQuackMemory();
   console.log(result);
   ```

4. **Verify Idempotency**:
   ```typescript
   const first = await importFromMCPMemory();
   const second = await importFromMCPMemory();

   // All entities should be skipped in second run
   console.assert(second.skipped === first.importedEntities);
   ```

### Integration Testing

```typescript
// Test migration status
const status = await getMigrationStatus();
expect(status.mcpMemoryAvailable).toBeDefined();
expect(status.brainEntityCount).toBeGreaterThanOrEqual(0);

// Test MCP import
const mcpResult = await importFromMCPMemory();
expect(mcpResult.importedEntities).toBeGreaterThanOrEqual(0);
expect(mcpResult.errors).toEqual([]);

// Test Quack import
const quackResult = await importFromQuackMemory();
expect(quackResult.importedEntities).toBeGreaterThanOrEqual(0);
expect(quackResult.errors).toEqual([]);
```

## Error Handling

### Common Errors

1. **MCP Memory Not Found**
   - Error: `"NPX cache not found - MCP Memory may not be installed"`
   - Solution: Install MCP Memory with `npx @modelcontextprotocol/server-memory`

2. **File Read Error**
   - Logged in `errors` array
   - Import continues with remaining data

3. **Parse Error**
   - Logged in `errors` array
   - Skips invalid line, continues processing

4. **Database Error**
   - Returns error immediately
   - No partial data (transaction safety)

## Performance Considerations

### Scalability

- **Streaming**: JSONL parsed line-by-line (low memory)
- **Batch Insert**: Single transaction for all imports
- **Index Usage**: Name lookups use primary key index

### Optimization

- Skip FTS update during bulk import (if needed)
- Use prepared statements for repeated queries
- Transaction per file (not per entity)

## Future Enhancements

### Phase 2.1: Advanced Migration

1. **Conflict Resolution**
   - UI for handling duplicates
   - Merge vs. skip options
   - Timestamp-based winner selection

2. **Incremental Sync**
   - Track last import timestamp
   - Only import new/updated entities
   - Two-way sync with MCP Memory

3. **Migration UI**
   - Progress bar for large imports
   - Preview before import
   - Rollback capability

4. **Export Options**
   - Export Brain to MCP Memory format
   - Export to Markdown files
   - Backup/restore functionality

### Phase 2.2: Data Quality

1. **Deduplication**
   - Fuzzy matching for similar entities
   - Merge duplicate observations
   - Relation consolidation

2. **Validation**
   - Schema validation for entity types
   - Observation format checking
   - Relation integrity verification

3. **Cleanup**
   - Remove orphaned observations
   - Delete broken relations
   - Archive old entities

## References

- **MCP Memory**: https://github.com/modelcontextprotocol/servers/tree/main/src/memory
- **Quack Brain Phase 1**: `/docs/06-proposals/quack-brain-unified-memory.md`
- **Brain Service**: `/src/services/brainService.ts`
- **Brain Commands**: `/src-tauri/src/brain/commands.rs`

## Related Files

### Backend
- `/src-tauri/src/brain/commands.rs` - Migration commands
- `/src-tauri/src/brain/types.rs` - Type definitions
- `/src-tauri/src/brain/db.rs` - Database operations
- `/src-tauri/src/lib.rs` - Command registration

### Frontend
- `/src/services/brainService.ts` - TypeScript service
- `/src/types/brain.ts` - TypeScript types

## Success Criteria

- ✅ MCP Memory import command implemented
- ✅ Quack Memory import command implemented
- ✅ Migration status command implemented
- ✅ Idempotent operations (safe to re-run)
- ✅ Error handling and logging
- ✅ TypeScript interfaces and functions
- ✅ Compilation verified (`cargo check`)
- ⏳ Integration tests (Phase 2.1)
- ⏳ Migration UI (Phase 2.1)
- ⏳ Documentation for end users (Phase 2.1)

## Conclusion

Phase 2 successfully implements migration tools for importing data from MCP Memory and Quack Memory into Quack Brain. The implementation follows data engineering best practices:

1. **Idempotent operations** - Safe to run multiple times
2. **Error resilience** - Individual failures don't stop import
3. **Data validation** - Empty/invalid data is skipped
4. **Detailed logging** - Import statistics and error tracking
5. **Scalability** - Streaming JSONL parsing for large files

The migration tools enable seamless transition to Quack Brain while preserving valuable historical data from legacy systems.
