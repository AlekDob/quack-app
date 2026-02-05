---
type: pattern
project: quack-app
created: 2026-01-10
migrated: true
---

# pattern-json-viewer-syntax-highlighting

Reusable JSON viewer component with syntax highlighting using regex-based approach

Location: src/components/JsonViewer.tsx + JsonViewer.css

Usage: <JsonViewer data={jsonString} maxHeight="500px" />

Automatic JSON parsing with graceful fallback to plain text if invalid

Color scheme: keys (#82aaff blue), strings (#c3e88d green), numbers (#f78c6c orange), booleans (#c792ea purple), null (#697098 gray)

Regex pattern: /"(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g

Monospace font stack: Fira Code, JetBrains Mono, SF Mono, Monaco, Cascadia Code

Dark theme optimized: rgba backgrounds, custom scrollbar styling

Security: Uses dangerouslySetInnerHTML (safe because we control the highlighting logic)

Can be used anywhere in the app for displaying JSON data: tool outputs, API responses, debug views
