---
type: pattern
project: quack-app
created: 2026-01-11
migrated: true
---

# feature-authentication-flow

## Authentication Architecture - Quack uses a multi-layer strategy for Claude/Anthropic authentication

### Priority Order: 1) ANTHROPIC_API_KEY env variable (pay-per-token), 2) Claude Code OAuth (~/.claude.json), 3) macOS Keychain, 4) AWS Bedrock / Google Vertex AI

### Credential Locations: ~/.claude.json (OAuth), ~/.claude/.credentials.json (standard), ~/.config/claude-code/auth.json, macOS Keychain

### Auth Types: OAuth (Claude Pro/Max subscription) or ApiKey (pay-per-use)

### Communication: Rust spawns node-sdk/stream-claude.js which imports @anthropic-ai/claude-agent-sdk and calls api.anthropic.com

### Key Files: claude_auth.rs (credential reading), claude_cli.rs (SDK spawning), stream-claude.js (SDK wrapper)

### Security: NO header spoofing, uses official SDK, SDK handles telemetry, supports both OAuth and API keys
