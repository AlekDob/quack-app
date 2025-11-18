# 📚 Quack App Documentation

Welcome to the Quack App documentation! This directory contains comprehensive guides, technical analysis, and troubleshooting documentation.

---

## 📖 Table of Contents

### Architecture & Design
- **[architecture.md](./architecture.md)** - Complete application architecture overview
  - Component structure
  - Terminal system
  - Git integration
  - AI assistant architecture
  - Full technical documentation

### Bug Fixes & Analysis
- **[MESSAGE_DUPLICATION_FIX.md](./MESSAGE_DUPLICATION_FIX.md)** - 🦆 Message duplication bug fix
  - Root cause analysis
  - Technical solution
  - Implementation details
  - Test plan

- **[TEST_RESULTS.md](./TEST_RESULTS.md)** - Test suite results (37/37 passing ✅)
  - Event deduplication tests
  - Session key stability tests
  - Integration tests
  - Performance benchmarks

- **[VERIFICATION_GUIDE.md](./VERIFICATION_GUIDE.md)** - Manual testing guide
  - 6 verification scenarios
  - Step-by-step instructions
  - Debugging checklist
  - Report templates

### Build & Development
- **[CLAUDE_SDK_BUILD_FIX.md](./CLAUDE_SDK_BUILD_FIX.md)** - Claude SDK build issues
- **[claude-sdk-integration.md](./claude-sdk-integration.md)** - SDK integration guide

### Analysis & Reports
- **[analysis-report.md](./analysis-report.md)** - General analysis reports
- **[token-counter-implementation.md](./token-counter-implementation.md)** - Token counter implementation

---

## 🐛 Bug Fixes Overview

### Message Duplication Fix (2025-01-16) ✅

**Status**: RESOLVED - All tests passing (37/37)

**Problem**:
- Messages appearing 2-3x in chat UI
- Random occurrence, affecting all agents in a project

**Root Cause**:
1. Session key instability (changed from `streamId` to `sessionId` mid-stream)
2. Weak event ID generation (timestamp-based instead of content-based)
3. Unsynchronized multi-layer deduplication

**Solution**:
- Stable session key (always uses `streamId`)
- Content-based event ID hashing
- Defense-in-depth deduplication (SDK + hook layer)

**Files Modified**:
- `src/services/claudeSDK.ts` - Session key stability
- `src/hooks/useClaudeChat.ts` - Enhanced deduplication

**Tests Created**:
- `src/tests/eventDeduplication.test.ts` (17 tests)
- `src/tests/sessionKeyStability.test.ts` (9 tests)
- `src/tests/integration.deduplication.test.ts` (11 tests)

**Quick Verification**:
```bash
npm run test:dedup
```

**Detailed Guide**: See [VERIFICATION_GUIDE.md](./VERIFICATION_GUIDE.md)

---

## 🧪 Testing

### Run Tests
```bash
# All tests
npm test

# Deduplication tests only
npm run test:dedup

# Watch mode
npm run test:watch

# UI mode
npm run test:ui

# Coverage report
npm run test:coverage
```

### Test Coverage
- ✅ Event deduplication (17 tests)
- ✅ Session key stability (9 tests)
- ✅ Integration scenarios (11 tests)
- ✅ Performance benchmarks
- ✅ Edge cases (malformed events, long content, concurrency)

---

## 🚀 Quick Start

### Development
```bash
npm run tauri dev
```

### Build
```bash
npm run build
npm run tauri:build
```

### Testing
```bash
npm test
```

---

## 📊 Project Statistics

**Total Tests**: 37 (all passing ✅)
**Code Coverage**: Event deduplication, session management, integration flows
**Performance**: <500ms for 100 message exchanges
**Stability**: Zero duplicates in all 37 test scenarios

---

## 🔧 Troubleshooting

### Message Duplication Issues
1. Check console for `🦆 DUPLICATE DETECTED` warnings
2. Verify session key stability (should be `stream-xxx`)
3. Run deduplication tests: `npm run test:dedup`
4. Follow [VERIFICATION_GUIDE.md](./VERIFICATION_GUIDE.md)

### Build Issues
- See [CLAUDE_SDK_BUILD_FIX.md](./CLAUDE_SDK_BUILD_FIX.md)

### General Issues
- Check [architecture.md](./architecture.md) for system overview
- Review [analysis-report.md](./analysis-report.md)

---

## 📝 Contributing

When adding new documentation:
1. Place files in the appropriate category
2. Update this README.md with links
3. Follow the existing documentation structure
4. Include code examples and test results when applicable

---

## 🦆 About Quack

Quack is a multi-agentic Tauri desktop app with integrated terminals, file explorer, Git, AI assistant, voice recording, PIP windows, marketplace, and MCP servers - powered by Claude Agent SDK.

**Tech Stack**: Tauri 2.8.5, React 19.1.1, TypeScript 5.8.3, Claude Agent SDK 0.1.14

---

**Last Updated**: 2025-01-16
**Version**: 0.1.3
