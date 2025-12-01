# Changelog

All notable changes to Quack will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2025-07-14

The biggest update since launch. This release completely transforms how you work with AI agents.

### New Agent Architecture: Droids & Skills

Completely rebuilt agent system from scratch:

- **Droids** - Specialized subagents that work in isolation and return focused results
- **Skills** - Modular abilities that Claude automatically discovers and uses
- **Teaching System** - Define when to use skills and which droids to invoke

Your agents are now smarter, more focused, and truly autonomous.

### Droid Factory

Create your own specialized AI agents directly in Quack:

- Template-based or fully custom droids
- Configure tools, model, and specialization
- Built-in agents guide you through the creation process

### Integrated Documentation

No more switching between apps - the complete Quack Guide is now built-in:

- Access via "Guide" button in sidebar
- Dark theme matching Quack design
- Always up-to-date

### Smarter Stamina Management

Completely reworked token tracking:

- Fresh agents start at 100% stamina
- Real-time FREE tokens display
- Accurate overhead calculation per project

### UX Improvements

- **Compact Chat View** - More content, less clutter
- **Custom Backgrounds** - Personalize your workspace
- **New Agent Layout** - More intuitive agent panel
- **Independent Terminal System** - Each terminal operates autonomously

### New Configuration Sections

- **MCP Manager** - Configure Model Context Protocol servers
- **Hooks Manager** - Set up automation hooks

### Bug Fixes & Stability

Numerous fixes including message duplication, session recovery, and terminal state detection.

### Download

**macOS Universal (Apple Silicon + Intel):**
- Download `Quack_0.2.0_universal.dmg`

### Installation
1. Download the `.dmg` file
2. Open the downloaded file
3. Drag Quack to your Applications folder
4. Open Quack from Applications
5. On first launch, go to System Settings > Privacy & Security and click "Open Anyway"

---

## [0.1.1] - 2025-06-XX

### Initial Public Release

- Multi-terminal PTY system
- File explorer integration
- Git integration
- AI streaming with Claude
- Voice recording
- Telegram integration
- Plugin system
- MCP servers support

---

## [0.1.0] - 2025-06-XX

### MVP Release

Initial release of Quack - A multi-agentic Tauri desktop app with integrated terminals, file explorer, Git, AI assistant, and more.
