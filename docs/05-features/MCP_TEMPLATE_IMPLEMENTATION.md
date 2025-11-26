# MCP Template Implementation

**Date**: 2025-01-18
**Status**: ✅ Completed

## Summary

Implemented an **always-visible template selector** in the MCP Server modal and added **Context7** as a built-in template. Templates are now accessible when adding OR editing servers, not just when the server list is empty.

---

## Changes Made

### 1. Backend - Template Addition (`src-tauri/src/mcp.rs`)

**Added Context7 template** to the `get_mcp_templates()` function:

```rust
MCPTemplate {
    id: "context7".to_string(),
    name: "Context7".to_string(),
    description: "Semantic search and knowledge base powered by Upstash Vector".to_string(),
    template_type: "database".to_string(),
    icon: "database".to_string(),
    config: MCPServerConfig::Stdio {
        command: "npx".to_string(),
        args: vec!["-y".to_string(), "@upstash/context7-mcp".to_string()],
        env: Some({
            let mut env = HashMap::new();
            env.insert("CONTEXT7_API_KEY".to_string(), "${CONTEXT7_API_KEY}".to_string());
            env
        }),
    },
}
```

**Configuration Details**:
- **Transport**: stdio (NOT HTTP - it's an npm package!)
- **Command**: npx
- **Args**: `-y @upstash/context7-mcp`
- **Environment Variable**: `CONTEXT7_API_KEY` (placeholder format)

**Templates now available**:
1. Filesystem
2. GitHub
3. Slack
4. PostgreSQL
5. Puppeteer
6. **Context7** (NEW)

---

### 2. Frontend - Always-Visible Selector (`src/components/MCPServerModal.tsx`)

**Before** (lines 240-267):
```tsx
{/* Template selector (only for new servers) */}
{!server && templates.length > 0 && (
  <div>
    <label>Template (optional)</label>
    <select>...</select>
  </div>
)}
```

**After**:
```tsx
{/* Template selector - Always visible */}
{templates.length > 0 && (
  <div>
    <label>Start from Template (optional)</label>
    <select
      value={selectedTemplateId}
      onChange={(e) => setSelectedTemplateId(e.target.value)}
    >
      <option value="">Custom configuration</option>
      {templates.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name} - {t.description}
        </option>
      ))}
    </select>
    <p className="text-xs mt-1">
      Select a template to auto-populate fields below
    </p>
  </div>
)}
```

**Key Changes**:
- ❌ Removed `!server` condition - now visible for both new AND existing servers
- ✅ Changed label from "Template" to "Start from Template" for clarity
- ✅ Added helper text: "Select a template to auto-populate fields below"

---

## How It Works

### User Flow

1. **User clicks "Add Server"** in MCP Servers panel
2. **Modal opens with template selector** at the top (always visible)
3. **User selects template** (e.g., "Context7 - Semantic search...")
4. **Fields auto-populate**:
   - Transport: stdio
   - Command: npx
   - Args: -y @upstash/context7-mcp
   - Env: CONTEXT7_API_KEY=${CONTEXT7_API_KEY}
5. **User replaces placeholder** with actual API key
6. **User saves** → Server added to `.mcp.json`

### Auto-Population Logic

When user selects a template, the `useEffect` hook (lines 80-122 in `MCPServerModal.tsx`) automatically:

1. Sets transport type from template config
2. Populates command/args (stdio) or url/headers (HTTP/SSE)
3. Fills environment variables with placeholders
4. Updates all text fields (argsText, envText, headersText)

---

## Context7 Setup Example

**Configuration in `.mcp.json`**:
```json
{
  "mcpServers": {
    "context7": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"],
      "env": {
        "CONTEXT7_API_KEY": "your_actual_api_key_here"
      }
    }
  }
}
```

**How to get API key**:
1. Go to https://upstash.com/
2. Create a free account
3. Create a new Vector database (Context7)
4. Copy the API key from the dashboard
5. Replace `${CONTEXT7_API_KEY}` placeholder in Quack

---

## Testing

### Manual Testing Steps

1. **Start Quack**
2. **Open MCP Servers** tab
3. **Click "Add Server"**
4. **Verify**:
   - ✅ Template selector is visible at top
   - ✅ "Context7" appears in dropdown
5. **Select Context7 template**
6. **Verify**:
   - ✅ Transport changes to "stdio"
   - ✅ Command field shows "npx"
   - ✅ Args field shows "-y @upstash/context7-mcp"
   - ✅ Env field shows "CONTEXT7_API_KEY=${CONTEXT7_API_KEY}"
7. **Replace placeholder with real API key**
8. **Click "Test"** → Should spawn process successfully
9. **Click "Add Server"** → Should save to `.mcp.json`

### Edge Cases Tested

- ✅ Empty template list (selector hidden gracefully)
- ✅ Switching between templates (fields update correctly)
- ✅ Switching from template to custom (fields preserved)
- ✅ Editing existing server (template selector still visible)

---

## File Changes Summary

### Modified Files

| File | Lines Changed | Description |
|------|---------------|-------------|
| `src-tauri/src/mcp.rs` | +16 | Added Context7 template |
| `src/components/MCPServerModal.tsx` | ~10 | Removed `!server` condition, updated label/helper text |

### No Breaking Changes

- ✅ Existing servers still work
- ✅ Custom configuration still available
- ✅ All transport types still supported (stdio, HTTP, SSE)
- ✅ Template selection is optional

---

## Future Improvements

### Potential Enhancements

1. **Template Categories**: Group templates by type (Database, API, Browser, etc.)
2. **Template Search**: Filter templates by keyword
3. **Custom Template Upload**: Allow users to add their own templates
4. **Template Validation**: Check if required commands (npx, python, etc.) are installed
5. **Template Versioning**: Allow selecting specific MCP server versions

### Additional Templates to Add

- SQLite (`@modelcontextprotocol/server-sqlite`)
- Brave Search (`@modelcontextprotocol/server-brave-search`)
- Google Maps (`@modelcontextprotocol/server-google-maps`)
- Memory (`@modelcontextprotocol/server-memory`)
- Time (`@modelcontextprotocol/server-time`)

---

## References

- **Context7 GitHub**: https://github.com/upstash/context7
- **MCP Documentation**: https://code.claude.com/docs/en/mcp
- **Upstash Console**: https://console.upstash.com/

---

## Completion Checklist

- [x] Add context7 template to backend
- [x] Remove `!server` condition from template selector
- [x] Update label and add helper text
- [x] Test template auto-population
- [x] Verify build succeeds
- [x] Document implementation

**Implementation complete!** ✅
