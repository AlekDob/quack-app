# Contract: Tauri Command — search_in_files

**Feature**: 001-fulltext-search | **Date**: 2026-03-30

## Command Signature

```rust
#[tauri::command]
pub fn search_in_files(
    path: String,
    query: String,
    max_results: Option<usize>,    // default: 200
    case_sensitive: Option<bool>,   // default: false
) -> Result<ContentSearchResponse, String>
```

## Input

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| path | String | Yes | — | Absolute path to directory to search |
| query | String | Yes | — | Search string (plain text, no regex) |
| max_results | Option<usize> | No | 200 | Maximum number of matches to return |
| case_sensitive | Option<bool> | No | false | Whether search is case-sensitive |

## Output

```typescript
interface ContentSearchResult {
  file: string;        // relative path
  line_number: number; // 1-based
  line_content: string;
  match_start: number;
  match_end: number;
}

interface ContentSearchResponse {
  results: ContentSearchResult[];
  total_matches: number;
  files_searched: number;
  truncated: boolean;
}
```

## Invocation from React

```typescript
import { invoke } from "@tauri-apps/api/core";

const response = await invoke<ContentSearchResponse>("search_in_files", {
  path: explorerPath,
  query: searchQuery,
  maxResults: 200,
  caseSensitive: false,
});
```

## Error Cases

| Error | Description |
|-------|-------------|
| "Directory not found: {path}" | Path does not exist |
| "Not a directory: {path}" | Path is a file, not a directory |
| "Search query too short" | Query is less than 2 characters |

## Filtering Rules

- Skip files matching .gitignore patterns
- Skip binary files (detected by null bytes in first 8KB)
- Skip files > 10MB
- Skip hidden directories (.git, .svn, etc.) unless explicitly in the search path
