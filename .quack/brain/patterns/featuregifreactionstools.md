---
type: pattern
project: quack-app
created: 2026-01-08
migrated: true
---

# feature_gif_reactions_tools

[2026-01-08] Implemented GIF reactions for tool/MCP usage in Quack chat

Uses Giphy API with tool-to-keyword mapping for contextual GIFs

Components: giphyService.ts, ToolGifWidget.tsx, useToolGifReaction.ts, ToolGifOverlay.tsx

Settings toggle in General > Chat Experience

Rate limited (500ms between requests), max 2 concurrent GIFs

GIF cache in memory to avoid repeated API calls

Family-friendly only (rating: G)
