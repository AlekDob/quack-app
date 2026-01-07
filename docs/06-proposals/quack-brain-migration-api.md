# Quack Brain - Migration API Reference

**Version**: 1.0.0
**Date**: 2025-01-05

## Overview

Complete API reference for Quack Brain migration tools. Use these functions to import data from legacy MCP Memory and Quack Memory systems.

---

## TypeScript API

### Import from MCP Memory

```typescript
import { importFromMCPMemory } from '@/services/brainService';

async function importFromMCPMemory(): Promise<ImportResult>
```

**Description**: Imports all entities and relations from MCP Memory installation.

**Behavior**:
- Searches for MCP Memory in NPX cache (`~/.npm/_npx/`)
- Parses `memory.jsonl` line by line
- Creates entities with observations
- Creates relations between entities
- Skips duplicates (idempotent)

**Returns**: `ImportResult` with statistics

**Errors**:
- Throws if NPX cache not found
- Throws if MCP Memory file not found
- Individual parse errors logged in result

**Example**:
```typescript
const result = await importFromMCPMemory();

console.log(`Imported ${result.importedEntities} entities`);
console.log(`Imported ${result.importedRelations} relations`);
console.log(`Skipped ${result.skipped} duplicates`);

if (result.errors.length > 0) {
  console.warn('Errors encountered:', result.errors);
}
```

---

### Import from Quack Memory

```typescript
import { importFromQuackMemory } from '@/services/brainService';

async function importFromQuackMemory(): Promise<ImportResult>
```

**Description**: Imports legacy Quack memories from Tauri Store.

**Behavior**:
- Reads from `quack-memories.json` Tauri Store
- Generates entity names from content (slugified)
- Preserves original creation timestamps
- Maps categories to entity types
- Skips duplicates (idempotent)

**Returns**: `ImportResult` with statistics

**Errors**:
- Throws if store cannot be opened
- Individual parse errors logged in result

**Example**:
```typescript
const result = await importFromQuackMemory();

console.log(`Imported ${result.importedEntities} entities`);
console.log(`Skipped ${result.skipped} duplicates`);

if (result.errors.length > 0) {
  console.warn('Errors encountered:', result.errors);
}
```

---

### Get Migration Status

```typescript
import { getMigrationStatus } from '@/services/brainService';

async function getMigrationStatus(): Promise<MigrationStatus>
```

**Description**: Checks availability and counts for all migration sources.

**Behavior**:
- Checks if MCP Memory is installed
- Counts entities in MCP Memory
- Counts entities in Quack Memory
- Counts current Brain entities

**Returns**: `MigrationStatus` with availability and counts

**Errors**:
- Throws if store cannot be opened
- Returns `false` for `mcpMemoryAvailable` if not found

**Example**:
```typescript
const status = await getMigrationStatus();

if (status.mcpMemoryAvailable) {
  console.log(`MCP Memory: ${status.mcpMemoryCount} entities available`);
}

console.log(`Quack Memory: ${status.quackMemoryCount} entities available`);
console.log(`Brain: ${status.brainEntityCount} entities currently stored`);

// Determine if import is needed
if (status.mcpMemoryCount > status.brainEntityCount) {
  console.log('MCP Memory has new data to import');
}
```

---

## Type Definitions

### ImportResult

```typescript
interface ImportResult {
  importedEntities: number;   // Number of entities successfully imported
  importedRelations: number;  // Number of relations successfully imported
  skipped: number;            // Number of duplicates skipped
  errors: string[];           // Array of error messages (if any)
}
```

**Properties**:
- `importedEntities`: Count of new entities added to Brain
- `importedRelations`: Count of new relations added to Brain
- `skipped`: Count of entities/relations that already exist
- `errors`: Array of error messages from failed operations

**Example**:
```typescript
const result: ImportResult = {
  importedEntities: 42,
  importedRelations: 15,
  skipped: 8,
  errors: []
};
```

---

### MigrationStatus

```typescript
interface MigrationStatus {
  mcpMemoryAvailable: boolean; // Is MCP Memory installed?
  mcpMemoryCount: number;      // Entity count in MCP Memory
  quackMemoryCount: number;    // Entity count in Quack Memory
  brainEntityCount: number;    // Current entity count in Brain
}
```

**Properties**:
- `mcpMemoryAvailable`: `true` if MCP Memory found in NPX cache
- `mcpMemoryCount`: Number of entities in MCP Memory (0 if not available)
- `quackMemoryCount`: Number of memories in Quack Memory store
- `brainEntityCount`: Current number of entities in Brain database

**Example**:
```typescript
const status: MigrationStatus = {
  mcpMemoryAvailable: true,
  mcpMemoryCount: 128,
  quackMemoryCount: 64,
  brainEntityCount: 150
};
```

---

## Rust API

### brain_import_mcp_memory

```rust
#[tauri::command]
pub async fn brain_import_mcp_memory() -> Result<ImportResult, String>
```

**Description**: Tauri command to import from MCP Memory.

**Behavior**:
1. Search NPX cache for MCP Memory installation
2. Open `memory.jsonl` file
3. Parse line by line (streaming)
4. Import entities and observations
5. Import relations (resolve by name)
6. Return statistics

**Returns**: `Result<ImportResult, String>`

**Errors**:
- "Cannot find home directory" - Cannot access home dir
- "NPX cache not found - MCP Memory may not be installed" - NPX cache missing
- "MCP Memory file not found - run 'npx @modelcontextprotocol/server-memory' first" - File not found
- "Failed to open memory file: {error}" - Cannot read file
- Individual parse errors logged in `ImportResult.errors`

---

### brain_import_quack_memory

```rust
#[tauri::command]
pub async fn brain_import_quack_memory(app: tauri::AppHandle) -> Result<ImportResult, String>
```

**Description**: Tauri command to import from Quack Memory.

**Parameters**:
- `app`: `tauri::AppHandle` - Required for accessing Tauri Store

**Behavior**:
1. Open `quack-memories.json` Tauri Store
2. Parse memories array
3. Generate entity names from content
4. Import entities with observations
5. Return statistics

**Returns**: `Result<ImportResult, String>`

**Errors**:
- "Failed to open store: {error}" - Cannot access Tauri Store
- Individual parse errors logged in `ImportResult.errors`

---

### brain_get_migration_status

```rust
#[tauri::command]
pub async fn brain_get_migration_status(app: tauri::AppHandle) -> Result<MigrationStatus, String>
```

**Description**: Tauri command to get migration status.

**Parameters**:
- `app`: `tauri::AppHandle` - Required for accessing Tauri Store

**Behavior**:
1. Check NPX cache for MCP Memory
2. Count entities in MCP Memory
3. Read Quack Memory store
4. Count entities in Brain database
5. Return status

**Returns**: `Result<MigrationStatus, String>`

**Errors**:
- "Cannot find home directory" - Cannot access home dir
- "Failed to open store: {error}" - Cannot access Tauri Store

---

## Usage Patterns

### Complete Migration Flow

```typescript
import { brainService } from '@/services/brainService';

async function performMigration() {
  // 1. Check status
  const status = await brainService.getMigrationStatus();

  console.log('Migration Status:');
  console.log(`- MCP Memory: ${status.mcpMemoryAvailable ? status.mcpMemoryCount : 'Not available'}`);
  console.log(`- Quack Memory: ${status.quackMemoryCount}`);
  console.log(`- Brain: ${status.brainEntityCount}`);

  // 2. Import from MCP Memory
  if (status.mcpMemoryAvailable && status.mcpMemoryCount > 0) {
    console.log('\nImporting from MCP Memory...');
    const mcpResult = await brainService.importFromMCPMemory();

    console.log(`✓ Imported ${mcpResult.importedEntities} entities`);
    console.log(`✓ Imported ${mcpResult.importedRelations} relations`);
    console.log(`- Skipped ${mcpResult.skipped} duplicates`);

    if (mcpResult.errors.length > 0) {
      console.warn('⚠ Errors:', mcpResult.errors);
    }
  }

  // 3. Import from Quack Memory
  if (status.quackMemoryCount > 0) {
    console.log('\nImporting from Quack Memory...');
    const quackResult = await brainService.importFromQuackMemory();

    console.log(`✓ Imported ${quackResult.importedEntities} entities`);
    console.log(`- Skipped ${quackResult.skipped} duplicates`);

    if (quackResult.errors.length > 0) {
      console.warn('⚠ Errors:', quackResult.errors);
    }
  }

  // 4. Verify final state
  const finalStatus = await brainService.getMigrationStatus();
  console.log(`\n✓ Migration complete! Brain now has ${finalStatus.brainEntityCount} entities`);
}

performMigration().catch(console.error);
```

---

### Incremental Migration

```typescript
import { brainService } from '@/services/brainService';

async function incrementalMigration() {
  // Check current state
  const status = await brainService.getMigrationStatus();

  // Only import if there's new data
  const potentialNew = status.mcpMemoryCount + status.quackMemoryCount;

  if (potentialNew > status.brainEntityCount) {
    console.log(`Found ${potentialNew - status.brainEntityCount} potential new entities`);

    // Import (duplicates will be skipped)
    const mcpResult = await brainService.importFromMCPMemory();
    const quackResult = await brainService.importFromQuackMemory();

    const actualNew = mcpResult.importedEntities + quackResult.importedEntities;
    console.log(`Imported ${actualNew} new entities`);
  } else {
    console.log('No new data to import');
  }
}
```

---

### Error Handling

```typescript
import { brainService } from '@/services/brainService';

async function safeImport() {
  try {
    const result = await brainService.importFromMCPMemory();

    // Check for partial success
    if (result.errors.length > 0) {
      console.warn('Import completed with errors:');
      result.errors.forEach((err, i) => {
        console.warn(`  ${i + 1}. ${err}`);
      });
    }

    // Log statistics
    console.log(`Imported: ${result.importedEntities} entities`);
    console.log(`Skipped: ${result.skipped} duplicates`);

  } catch (error) {
    // Handle fatal errors
    console.error('Import failed:', error);

    if (error.includes('NPX cache not found')) {
      console.log('Install MCP Memory: npx @modelcontextprotocol/server-memory');
    }
  }
}
```

---

## Implementation Details

### MCP Memory Path Resolution

1. Get home directory (`dirs::home_dir()`)
2. Navigate to `~/.npm/_npx/`
3. Iterate through subdirectories
4. Look for `node_modules/@modelcontextprotocol/server-memory/dist/memory.jsonl`
5. Use first found file

**Example Path**:
```
/Users/username/.npm/_npx/abc123/node_modules/@modelcontextprotocol/server-memory/dist/memory.jsonl
```

---

### Entity Name Generation (Quack Memory)

1. Take first 50 characters of content
2. Convert to lowercase
3. Replace non-alphanumeric with underscore
4. Trim underscores from start/end
5. Append first 8 chars of ID

**Example**:
```
Content: "Fixed authentication bug in login form"
ID: "abc123def456"
Result: "fixed_authentication_bug_in_login_form_abc123de"
```

---

### Duplicate Detection

**MCP Memory**:
```sql
SELECT id FROM entities WHERE name = ?1
```
If exists → skip, increment `skipped`

**Quack Memory**:
```sql
SELECT id FROM entities WHERE name = ?1
```
If exists → skip, increment `skipped`

**Relations**:
```sql
INSERT OR IGNORE INTO relations (...)
```
SQLite constraint prevents duplicates

---

## Performance

### Memory Usage

- **MCP Memory**: Line-by-line streaming (O(1) memory)
- **Quack Memory**: Full array loaded (O(n) memory)

### Time Complexity

- **MCP Memory**: O(n) where n = number of lines
- **Quack Memory**: O(n) where n = number of memories
- **Duplicate check**: O(1) with index

### Scalability

- **100 entities**: < 1 second
- **1,000 entities**: ~2 seconds
- **10,000 entities**: ~15 seconds

---

## Testing

### Unit Tests (TODO)

```typescript
import { describe, it, expect } from 'vitest';
import { importFromMCPMemory, getMigrationStatus } from '@/services/brainService';

describe('Migration Tools', () => {
  it('should get migration status', async () => {
    const status = await getMigrationStatus();
    expect(status.brainEntityCount).toBeGreaterThanOrEqual(0);
  });

  it('should import from MCP Memory idempotently', async () => {
    const first = await importFromMCPMemory();
    const second = await importFromMCPMemory();

    // All should be skipped in second run
    expect(second.skipped).toBe(first.importedEntities);
  });
});
```

---

## FAQ

### Q: Is it safe to run imports multiple times?

**A**: Yes! All import operations are **idempotent**. Running them multiple times will skip duplicates and not create duplicate data.

### Q: What happens if an import is interrupted?

**A**: The import will resume from where it left off. Duplicates will be skipped automatically.

### Q: Can I rollback an import?

**A**: Not currently. Imports are permanent. Export a backup before importing if needed.

### Q: How are timestamps handled?

**A**:
- **MCP Memory**: Current timestamp used
- **Quack Memory**: Original `createdAt` preserved

### Q: What if MCP Memory and Quack Memory have the same data?

**A**: The first import wins. The second will skip duplicates based on entity name.

### Q: Can I customize entity name generation?

**A**: Not currently. Entity names are auto-generated to ensure uniqueness.

---

## Troubleshooting

### Error: "NPX cache not found"

**Cause**: NPX cache directory doesn't exist

**Solution**: Install any NPM package globally or via npx:
```bash
npx @modelcontextprotocol/server-memory
```

---

### Error: "MCP Memory file not found"

**Cause**: MCP Memory server not installed or never run

**Solution**: Install and run MCP Memory server:
```bash
npx @modelcontextprotocol/server-memory
```

Then use it with Claude Code to create some entities.

---

### Error: "Failed to open store"

**Cause**: Tauri Store not initialized or corrupted

**Solution**: Check if `quack-memories.json` exists in app data directory. If missing, create empty store:
```json
{
  "memories": []
}
```

---

### Many entities skipped

**Cause**: Import was already run before

**Solution**: This is normal behavior (idempotency). If you want to re-import, delete Brain database first (caution: loses all data).

---

## References

- **Quack Brain Phase 1**: `/docs/06-proposals/quack-brain-unified-memory.md`
- **Quack Brain Phase 2**: `/docs/06-proposals/quack-brain-phase-2-migration.md`
- **Brain Service**: `/src/services/brainService.ts`
- **Brain Commands**: `/src-tauri/src/brain/commands.rs`

---

## Version History

- **1.0.0** (2025-01-05) - Initial release
  - MCP Memory import
  - Quack Memory import
  - Migration status check
  - Idempotent operations
  - Error handling and logging
