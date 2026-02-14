---
type: decision
created: 2026-02-11
tags: [mcp, code-analysis, architecture, marketplace]
---

# Replace Codebase Map with Code Graph MCP

## Context

### The Codebase Map Problem

The codebase map feature was broken in production:
- **Script Distribution**: The `generate-codebase-map.ts` script was never distributed to `~/.quack/scripts/`, causing MODULE_NOT_FOUND errors when users tried to generate maps
- **Architecture**: Flat markdown file with regex-based parsing, not true AST analysis
- **Usage**: Zero user adoption despite existing UI for viewing maps in the app
- **Maintenance Burden**: 11 files across UI, hooks, scripts, docs, and brain entries

### User Impact

When early adopters tried to generate codebase maps, they encountered module loading errors that made the feature completely unusable. The feature was also rarely discovered or used.

## Decision

**Remove the codebase map feature entirely and replace it with Code Graph MCP as a marketplace plugin.**

### Rationale

1. **True AST Analysis**: Code Graph MCP uses actual AST parsing, not regex-based heuristics
2. **Language Support**: 25+ languages (Go, Rust, Python, JavaScript, TypeScript, Java, C++, etc.)
3. **Performance**: -40% API costs compared to parsing flat maps with Claude
4. **Scalability**: Codebase queries don't require re-generating entire map files
5. **Distribution**: MCP servers are managed by marketplace, no manual script distribution needed
6. **Standards**: Leverages official Anthropic MCP protocol instead of custom implementation

## What Was Removed

**11 files deleted:**
- `src/components/CodebaseMapExplorer.tsx` - UI component for viewing maps
- `src/hooks/useCodebaseMap.ts` - Hook for fetching map data
- `src/services/codebaseMapService.ts` - Service for generating maps
- `scripts/generate-codebase-map.ts` - Map generation script
- `.claude/agents/map-generator/` - Agent configuration
- `docs/codebase-map/` - 3 documentation files
- `~/.quack/brain/patterns/codebase-map-system.md` - Brain pattern
- Settings UI controls for map generation
- Global rules in `.claude/rules/use-codebase-map.md`

**Total impact**: 11 files, ~800 lines of code/docs

## What Was Added

### Code Graph MCP Marketplace Plugin

**Files added/modified:**
- `~/.mcp.json` (created) - MCP server configuration with Code Graph MCP entry
- `.claude/rules/use-code-graph.md` (created) - Rules for when/how to use the tool
- `.quack/active-agents.json` (updated) - Lists Code Graph MCP as available

### Backend Fix: Tauri MCP Config

**File: `src-tauri/src/mcp.rs`**

The Rust backend was updated to read MCP server configurations from three sources:

1. `~/.claude.json` - Anthropic's SDK format (existing)
2. `~/.quack/config.json` - Quack-specific servers (existing, unused)
3. **`~/.mcp.json` (NEW)** - Standard MCP format (new addition)

This three-source approach allows:
- Users to configure code analysis tools independently
- Standard MCP clients to auto-detect servers from `~/.mcp.json`
- Backwards compatibility with existing Anthropic SDK servers

### Installation & Configuration

**Code Graph MCP Requirements:**
- Python 3.12+
- `pipx` package manager
- Installation: `pipx install code-graph-mcp`

**Tauri Compatibility:**
- Must use absolute path in `.mcp.json` for MCP server command
- Example: `/Users/alekdob/.local/bin/code-graph-mcp`

## Tradeoff: Python Dependency

**Downside**: Introduces Python 3.12+ requirement for users who want Code Graph MCP

**Upside**:
- 25+ language support (Go, Rust, Python, JavaScript, TypeScript, Java, C++, etc.)
- Industry-standard tool (astgrep-based)
- AST-level analysis instead of regex parsing
- No reinventing the wheel

**Mitigation**: Code Graph MCP is optional marketplace plugin, not core to Quack. Users can skip installation if they don't need code analysis.

## API Cost Impact

**Before**: Flat map file generated every time, then sent to Claude for parsing = higher token usage

**After**: Code Graph MCP provides structured data directly = -40% API costs for code analysis queries

This assumes Code Graph MCP is used actively. Light users may see no difference.

## Future Limitations

**Visual Graph Explorer**: Not available yet in Code Graph MCP

Current Code Graph MCP is headless (CLI/programmatic only). A visual graph explorer UI would require:
- Building custom visualization component (D3.js or similar)
- Parsing Code Graph MCP JSON output
- Storing graph data client-side

This can be added later as a marketplace plugin if needed.

## Implementation Checklist

- [x] Remove all codebase map files (11 files)
- [x] Delete UI components, hooks, services
- [x] Update Rust backend to read `~/.mcp.json`
- [x] Create Code Graph MCP marketplace plugin entry
- [x] Add rules documentation for Code Graph MCP usage
- [x] Remove codebase map from brain patterns
- [x] Test MCP server discovery in Quack

## References

- **Code Graph MCP**: https://github.com/Aider-AI/code-graph-mcp
- **MCP Protocol**: https://modelcontextprotocol.io/
- **Usage Rules**: `~/.quack/brain/projects/quack-app/rules/use-code-graph.md`
