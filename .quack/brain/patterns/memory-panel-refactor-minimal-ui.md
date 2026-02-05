---
type: component
project: quack-app
created: 2026-01-11
migrated: true
---

# memory-panel-refactor-minimal-ui

[2026-01-11] Refactored MemoryPanel.tsx to show minimal vault UI instead of entity list

Location: src/components/memory/MemoryPanel.tsx

Features: Vault path display, quick action buttons (Finder, IDE, Obsidian), entity count with animated brain visualization

Action buttons use custom Rust commands to bypass Tauri shell plugin limitations

Finder: invoke('reveal_in_finder', { path })

IDE: invoke('open_folder_in_ide', { ideId, folderPath })

Obsidian: invoke('open_external_url', { url: 'obsidian://open?vault=QuackBrain' })
