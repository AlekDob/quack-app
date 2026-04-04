---
type: feature-doc
project: quack-app
stack: Tauri (Rust + React)
created: 2026-04-04
last_verified: 2026-04-04
tags: [settings, unified-settings, preferences, configuration]
---

## Unified Settings Panel
**Purpose:** Centralized configuration panel with 15 categories, sidebar navigation, overlay animation, and persistent state via Zustand.
**Stack:** React 18 + TypeScript + Zustand + Tauri v2 invoke API

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Component | src/components/settings/UnifiedSettings.tsx | `UnifiedSettings` -- overlay container with category routing and close animation |
| Component | src/components/settings/SettingsSidebar.tsx | `SettingsSidebar`, `SettingsCategory` (type) -- sidebar nav with 15 category items |
| Component | src/components/settings/SettingsContent.tsx | `SettingsContent` -- scrollable content wrapper for active category |
| Component | src/components/settings/SettingsIcon.tsx | `SettingsIcon` -- SVG icon per category |
| Component | src/components/settings/categories/GeneralSettings.tsx | `GeneralSettings` -- profile name, GIF reactions, PiP, quack sound |
| Component | src/components/settings/categories/ClaudeCodeSettings.tsx | `ClaudeCodeSettings` -- LLM provider, auth, BTW model, Bedrock, memory, agent teams |
| Component | src/components/settings/categories/AIAssistantSettings.tsx | `AIAssistantSettings` -- OpenAI API key, model selection (GPT-4o-mini/4o/3.5), image model |
| Component | src/components/settings/categories/AgentModesSettings.tsx | `AgentModesSettings`, `ModePresetCard` -- per-mode model/effort configuration for 5 modes |
| Component | src/components/settings/categories/SecondBrainSettings.tsx | `SecondBrainSettings` -- brain path, open in Finder/Obsidian |
| Component | src/components/settings/categories/IDESettings.tsx | `IDESettings` -- IDE detection grid, auto-launch, sync focus, side-by-side, custom IDE |
| Component | src/components/settings/categories/TerminalSettings.tsx | `TerminalSettings` -- default shell selection, font, cursor behavior |
| Component | src/components/settings/categories/LicenseSettings.tsx | `LicenseSettings` -- license status, deactivation, Gumroad purchase links |
| Component | src/components/settings/categories/NotificationSettings.tsx | `NotificationSettings` -- mobile push toggle, Telegram bot config and test |
| Component | src/components/settings/categories/RemoteApiSettings.tsx | `RemoteApiSettings` -- enable/disable remote, token management, endpoint reference |
| Component | src/components/settings/categories/AppearanceSettings.tsx | `AppearanceSettings` -- background selector (images, gradients, transparent) |
| Component | src/components/settings/categories/TypographySettings.tsx | `TypographySettings`, `PresetCard`, `PreviewBlock` -- font size presets (S/M/L/XL), UI/mono font family |
| Component | src/components/settings/categories/KeyboardShortcutsSettings.tsx | `KeyboardShortcutsSettings` -- shortcut customization with conflict detection |
| Component | src/components/settings/categories/DebugSettings.tsx | `DebugSettings` -- wraps `DebugPanel` for production diagnostics |
| Component | src/components/settings/categories/AboutSettings.tsx | `AboutSettings` -- version, update checker, changelog, credits, external links |
| Component | src/components/settings/controls/SettingsRow.tsx | `SettingsRow` -- label + description + control layout row |
| Component | src/components/settings/controls/IOSSwitch.tsx | `IOSSwitch` -- iOS-style toggle switch control |
| Component | src/components/settings/controls/IOSInput.tsx | `IOSInput` -- styled text input control |
| Component | src/components/settings/controls/SectionHeader.tsx | `SectionHeader` -- title + description section divider |
| Component | src/components/settings/controls/ShortcutInput.tsx | `ShortcutInput` -- key recording input with conflict display |
| Store/State | src/stores/settingsStore.ts | `useSettingsStore` -- Zustand store with claude, terminal, general, agentModePresets, typography groups |
| Store/State | src/stores/ideStore.ts | `useIDEStore` -- IDE selection, auto-launch, sync focus, file open target |
| Store/State | src/stores/shortcutsStore.ts | `useShortcutsStore` -- keyboard shortcut bindings and conflict detection |
| Config | src/constants/typography.ts | `FONT_SIZE_PRESETS`, `UI_FONT_OPTIONS`, `MONO_FONT_OPTIONS`, `DEFAULT_TYPOGRAPHY`, `applyTypography()` |
| Config | src/config/features.ts | `getLicenseData()`, `clearLicenseData()` -- license data persistence |
| Service | src/services/ollamaService.ts | `checkOllamaRunning()`, `fetchOllamaModels()`, `getOllamaModelOptions()` |
| Service | src/services/brainFileService.ts | `getBrainRootPath()`, `setBrainCustomPath()`, `getCustomBrainPath()`, `initBrainStructure()`, `openBrainFolder()` |
| Service | src/services/modelService.ts | `getModelOptions()`, `getModelId()`, `getDefaultModel()` |
| Service | src/services/githubReleases.ts | `fetchLatestRelease()`, `getTimeSinceLastCheck()` |
| Service | src/services/shortcutsStorage.ts | `saveShortcuts()`, `loadShortcuts()`, `resetAllShortcuts()` |
| Util | src/utils/version.ts | `getCurrentVersion()`, `getBaseVersion()` |
| Component | src/components/ClaudeAuthSettings.tsx | `ClaudeAuthSettings` -- Claude OAuth/API key auth flow |
| Component | src/components/AuthDebugPanel.tsx | `AuthDebugPanel` -- authentication diagnostic panel |
| Component | src/components/DebugPanel.tsx | `DebugPanel` -- production debug tools |
| Component | src/components/ChangelogViewer.tsx | `ChangelogViewer` -- GitHub release changelog renderer |
| Component | src/components/skeletons/SettingsSkeleton.tsx | `SettingsSkeleton` -- loading placeholder |
| Style | src/components/settings/UnifiedSettings.css | Overlay, panel, sidebar, content layout styles |
| Style | src/components/settings/categories/AgentModesSettings.css | Mode preset card grid styles |
| Style | src/components/settings/categories/IDESettings.css | IDE grid, card, toggle styles |
| Style | src/components/settings/categories/LicenseSettings.css | License badge, info card styles |
| Style | src/components/settings/categories/TypographySettings.css | Preset cards, preview block, font selector styles |
| Style | src/components/settings/categories/KeyboardShortcutsSettings.css | Shortcut input, footer, help text styles |
| Style | src/components/settings/controls/ShortcutInput.css | Key recording animation and conflict indicator styles |

### Data Flow
- [User clicks gear icon] -> [UnifiedSettings overlay renders] -> [SettingsSidebar emits category] -> [renderCategory() switches component]
- [Category component] -> [useSettingsStore / useIDEStore / useShortcutsStore] -> [Zustand persist middleware] -> [localStorage `settings-storage`]
- [Category component] -> [invoke() Tauri commands] -> [Rust backend] -> [filesystem / environment vars / Tauri Store .dat files]
- [GeneralSettings userName change] -> [syncUserNameToClaudeMd()] -> [invoke('write_file_content')] -> [~/.claude/CLAUDE.md]

### Key Functions
- `UnifiedSettings({ onClose, initialCategory, onOpenTelegramSetup }) -> JSX` -- main settings overlay with animated close
- `renderCategory() -> JSX` -- switch/case routing to 15 category components
- `SettingsSidebar({ activeCategory, onSelectCategory }) -> JSX` -- sidebar navigation with icons
- `SettingsRow({ label, description, control }) -> JSX` -- reusable settings row layout
- `syncUserNameToClaudeMd(name: string) -> void` -- auto-injects display name into ~/.claude/CLAUDE.md
- `handleProviderChange(provider: LLMProviderType) -> void` -- switches LLM provider (Anthropic/Ollama/Custom)
- `handleSelectBackground(name: string) -> void` -- persists and applies background via Tauri invoke
- `ModePresetCard({ mode, title, description, color, icon }) -> JSX` -- per-mode model/effort config card
- `handleShortcutChange(id: ShortcutActionId, newKeys: string) -> void` -- updates shortcut with conflict check
- `normalizeModelId(model: string) -> string` -- migrates legacy model names (sonnet -> sonnet45)

### State
- `claude`: ClaudeSettings -- API key, model, provider, effort, BTW model, Bedrock override (global)
- `terminal`: TerminalSettings -- shell, font, cursor, scrollback (global)
- `general`: GeneralSettings -- userName, autoSave, notifications, sounds, GIF reactions, Giphy key (global)
- `agentModePresets`: AgentModePresets -- per-mode model/effort/thinking config for bypass/plan/ask/debug/chat (global)
- `typography`: TypographySettings -- font size preset (S/M/L/XL), UI font, mono font (global)
- `activeCategory`: SettingsCategory -- currently selected sidebar category (component)
- `closing`: boolean -- overlay close animation state (component)
- `preferredIDE`: string -- selected IDE identifier (global, ideStore)
- `shortcuts`: Record<ShortcutActionId, Shortcut> -- customizable keyboard bindings (global, shortcutsStore)

### External Dependencies
- Tauri invoke commands: `get_claude_env_vars`, `set_claude_env_var`, `get_claude_settings_flag`, `set_claude_settings_flag`, `get_ai_api_key`, `save_api_key`, `test_api_connection`, `list_available_shells`, `set_default_shell`, `get_background_image`, `set_background_image`, `get_remote_config`, `set_remote_enabled`, `regenerate_remote_token`, `get_mobile_notifications_enabled`, `set_mobile_notifications_enabled`, `get_telegram_config`, `set_telegram_config`, `send_telegram_test`, `deactivate_license`, `get_home_directory`, `read_file_content`, `write_file_content`, `get_local_ip`, `get_local_hostname`, `get_ai_model`, `set_ai_model`, `get_image_model`, `set_image_model`
- Tauri Store plugin: `.quack-ui-prefs.dat` for PiP and sound preferences
- Tauri Dialog plugin: directory picker for Brain custom path
- Tauri Shell plugin: open external URLs (Gumroad, GitHub, Discord, docs)
- Zustand persist middleware: `settings-storage` (localStorage), version 7 with migration chain

### UX Notes
- **Remote API > Enable Remote Access**: changing this toggle requires a Quack restart to apply the new network binding
- **Remote API > Port**: changing the port requires a Quack restart — the HTTP server binds at launch time and cannot rebind at runtime

### Config
- `settings-storage` version: 7 (migration chain v0-v7 handling legacy model IDs, debug mode, BTW, chat mode, ask mode, typography)
- Default model: `opus46` (Supabase ID format)
- Default BTW model: `haiku45`
- Default effort: `medium`
- Default shell: `/bin/zsh`
- Default font size preset: `M`
- Gumroad Setup URL: `https://alekdob.gumroad.com/l/tsvgt`
- Gumroad Expert URL: `https://alekdob.gumroad.com/l/nwuhis`
