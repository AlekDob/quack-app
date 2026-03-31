# Data Model: Fulltext Search

**Feature**: 001-fulltext-search | **Date**: 2026-03-30

## Entities

### ContentSearchResult (Rust → TypeScript)

A single content match within a file.

| Field | Type | Description |
|-------|------|-------------|
| file | String | Relative path from project root |
| line_number | usize / number | 1-based line number |
| line_content | String | Full text of the matching line (trimmed) |
| match_start | usize / number | Start offset of match within line_content |
| match_end | usize / number | End offset of match within line_content |

### ContentSearchResponse (Rust → TypeScript)

Wrapper for search results with metadata.

| Field | Type | Description |
|-------|------|-------------|
| results | Vec<ContentSearchResult> | Matching results (max 200) |
| total_matches | usize / number | Total matches found (may exceed 200) |
| files_searched | usize / number | Number of files scanned |
| truncated | bool / boolean | True if results were capped at max_results |

## Relationships

```
ContentSearchResponse 1──* ContentSearchResult
ContentSearchResult *──1 File (via `file` path)
```

## UI State (React)

| State | Type | Description |
|-------|------|-------------|
| searchQuery | string | Current search input text |
| searchResults | ContentSearchResponse \| null | Latest results |
| searchLoading | boolean | Whether search is in progress |
| explorerMode | 'files' \| 'search' | Active tab in explorer panel |

## Validation Rules

- `searchQuery` must be >= 2 characters before search executes
- `line_content` is trimmed to max 500 characters
- `file` paths use forward slashes, relative to project root
- `line_number` is 1-based (first line = 1)
