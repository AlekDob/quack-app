# Quack Test Mode - Version 0.1.2

## 🧪 Test Mode Implementation

This file documents the Test Mode feature added in version 0.1.2.

### Features

- **🔐 Authentication Simulation**: Toggle login/logout without real Claude CLI
- **📦 Storage Isolation**: All test data saved in `-TEST.json` files
- **🎯 UI Controls**: Badge, Login/Logout and Reset buttons in TitleBar
- **🔄 State Persistence**: Auth state persists across reloads
- **🗑️ Easy Cleanup**: Simple commands to reset test environment

### Quick Start

```bash
# Start in test mode
npm run test:dev

# Clean test data
npm run test:clean

# Reset and restart
npm run test:reset
```

### Use Cases

1. **Testing new user experience** - Start with clean slate
2. **Testing auth flows** - Simulate login/logout
3. **Bug reproduction** - Isolate issues without affecting real data
4. **UI/UX testing** - Safe environment for experiments

### Technical Details

- **Context**: `src/contexts/TestModeContext.tsx`
- **Storage Utility**: `src/utils/testModeStorage.ts`
- **Wrapper**: `src/utils/tauriInvokeWrapper.ts`
- **UI Integration**: `src/components/TitleBar.tsx`

### Documentation

See `docs/TEST_MODE.md` for complete documentation.

---

**Quack! 🦆**
