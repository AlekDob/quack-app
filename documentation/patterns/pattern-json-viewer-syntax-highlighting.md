---
type: pattern
created: 2026-01-10
---

# JSON Viewer Syntax Highlighting

Reusable JSON viewer component with syntax highlighting using regex-based approach.

Location: src/components/JsonViewer.tsx + JsonViewer.css

Usage: `<JsonViewer data={jsonString} maxHeight="500px" />`

Automatic JSON parsing with graceful fallback to plain text if invalid.

Color scheme: keys (#82aaff blue), strings (#c3e88d green), numbers (#f78c6c orange), booleans (#c792ea purple), null (#697098 gray).

Monospace font stack: Fira Code, JetBrains Mono, SF Mono, Monaco, Cascadia Code.

Dark theme optimized: rgba backgrounds, custom scrollbar styling.

Can be used anywhere in the app for displaying JSON data: tool outputs, API responses, debug views.
