# Quack

A multi-terminal desktop app with integrated AI, built with Tauri, React, and Rust.

## Features

- Multi-terminal emulator with tabbed interface
- Claude Agent SDK integration for AI-powered coding assistance
- Built-in file explorer and git integration
- MCP (Model Context Protocol) server support
- Real-time tool tracking and agent session management
- Keyboard shortcuts and customizable workflows
- Secure API key storage via system keychain

## Supported Platforms

| Platform | Status | Guide |
|----------|--------|-------|
| macOS (Intel + Apple Silicon) | Stable | [README-MAC.md](README-MAC.md) |
| Windows 10/11 (x64) | Stable | [README-WIN.md](README-WIN.md) |
| Linux (x64 / ARM64) | Stable | [README-LINUX.md](README-LINUX.md) |

## Quick Start

### Prerequisites (all platforms)

- [Node.js](https://nodejs.org) v18+
- [Rust](https://rustup.rs) (stable, minimum 1.77.2)
- npm

### Install Dependencies

```bash
npm install
cd src-tauri/node-sdk && npm install --production && cd ../..
```

### Development

```bash
# macOS
npm run dev:mac

# Windows (PowerShell)
npm run dev:win

# Linux
npm run dev:linux
```

### Production Build

```bash
# macOS
npm run build:mac

# Windows (PowerShell)
npm run build:win

# Linux
npm run build:linux
```

### Release

```bash
# First time: create the production branch
npm run release:create-branch

# Prepare release (merge main → production)
npm run release:prepare

# Publish (push to trigger GitHub Actions)
npm run release:publish

# Linux-specific release with packaging
npm run release:linux
```

## npm Scripts Reference

### Platform-Specific Commands

| Action | macOS | Windows | Linux |
|--------|-------|---------|-------|
| Dev | `dev:mac` | `dev:win` | `dev:linux` |
| Build | `build:mac` | `build:win` | `build:linux` |
| Bundle Optimize | `optimize-bundle:mac` | `optimize-bundle:win` | `optimize-bundle:linux` |
| Release (packaging) | -- | -- | `release:linux` |
| Setup | -- | `setup:win` | `setup:linux` |

### Cross-Platform Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server only (no Tauri) |
| `npm run build` | Frontend build only |
| `npm run build:secure` | Frontend build with minification |
| `npm run release:create-branch` | Create production branch (first time) |
| `npm run release:prepare` | Merge main into production |
| `npm run release:publish` | Push production to trigger CI/CD |
| `npm run test` | Run test suite |
| `npm run lint` | Run ESLint |
| `npm run clean` | Remove dist and Vite cache |
| `npm run clean:all` | Remove dist, node_modules, and Rust target |

## Project Structure

```
quack-app/
  src/                  # React frontend (TypeScript)
  src-tauri/
    src/                # Rust backend
    node-sdk/           # Bundled Node.js SDK for Claude Agent
    icons/              # App icons (all platforms)
    tauri.conf.json     # Tauri configuration
  scripts/              # Platform-specific build/dev scripts
  public/               # Static assets
  images/               # Background images
  docs/                 # Development documentation
```

## Documentation

- [Changelog](CHANGELOG.md) -- Version history
- [MCP Setup](docs/09-reference/MCP_SETUP.md) -- Configure Model Context Protocol servers
- [MCP Integration](docs/09-reference/MCP_INTEGRATION.md) -- MCP architecture overview
- [Security](docs/09-reference/SECURITY.md) -- Security model and assessment
- [Security Improvements](docs/09-reference/SECURITY_IMPROVEMENTS.md) -- Keychain integration
- [Release System](docs/09-reference/RELEASE.md) -- Automated release pipeline
- [Test Mode](docs/09-reference/TEST_MODE_README.md) -- Isolated testing environment
- [Troubleshooting Claude Auth](docs/09-reference/TROUBLESHOOTING_CLAUDE_AUTH.md) -- Claude SDK auth issues
- [Agent Registry](docs/09-reference/agents.md) -- Team agents and roles
