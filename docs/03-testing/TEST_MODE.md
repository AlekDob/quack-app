# 🧪 Quack Test Mode

Test Mode provides an isolated testing environment for Quack without touching your real data. Perfect for testing new features, debugging issues, and simulating new user experiences.

## 📋 Quick Start

### Start Test Mode

```bash
npm run test:dev
```

Or manually:

```bash
VITE_TEST_MODE=true npm run tauri:dev
```

### What You'll See

When Test Mode is active, you'll see:
- 🧪 **TEST** badge in the TitleBar
- Orange background in TitleBar (like DEV MODE)
- **🔐 Login** button to simulate authentication
- **🗑️ Reset** button to clear test data
- Title: "🦆🧪 Quack [TEST MODE]"

## 🎯 Features

### 1. **Isolated Storage**

All data is stored in separate files with `-TEST` suffix:

**Normal Mode:**
```
~/Library/Application Support/com.quack.terminal/
  ├── quack-terminals.json
  ├── quack-chats.json
  ├── quack-commands.json
  └── quack-agent-chats.json
```

**Test Mode:**
```
~/Library/Application Support/com.quack.terminal/
  ├── quack-terminals-TEST.json    ← Isolated
  ├── quack-chats-TEST.json         ← Isolated
  ├── quack-commands-TEST.json      ← Isolated
  └── quack-agent-chats-TEST.json   ← Isolated
```

Your real data is **never touched** in Test Mode!

### 2. **Simulated Authentication**

Test Mode simulates Claude CLI authentication without needing the actual CLI installed.

#### Simulate Login:
1. Click **🔐 Login** button in TitleBar
2. Auth banner disappears
3. App behaves as authenticated user

#### Simulate Logout:
1. Click **🔓 Logout** button in TitleBar
2. Auth banner appears again
3. App behaves as unauthenticated user

#### Persistent State:
- Authentication state persists across reloads
- Stored in `localStorage` as `test-mode-auth`
- Independent from real Claude CLI status

### 3. **Reset Test Data**

Click **🗑️ Reset** button to:
- Clear authentication state
- Return to "logged out" state
- Keep storage files (but reset auth)

To completely wipe test storage:

```bash
npm run test:clean
```

This removes all `*-TEST.json` files.

### 4. **Reset and Restart**

```bash
npm run test:reset
```

This will:
1. Clean all test data files
2. Clear authentication state
3. Restart Quack in Test Mode

## 🔧 Implementation Details

### Architecture

Test Mode is implemented with:

1. **TestModeContext** (`src/contexts/TestModeContext.tsx`)
   - Manages test mode state
   - Handles authentication simulation
   - Provides hooks for components

2. **Storage Utilities** (`src/utils/testModeStorage.ts`)
   - `getTestModeStoreName()` - Transform storage names
   - `isTestMode()` - Check if in test mode
   - `logTestModeStorage()` - Debug logging

3. **TitleBar Integration** (`src/components/TitleBar.tsx`)
   - Visual indicators (badge, styling)
   - Control buttons (Login/Logout, Reset)
   - Auto-detects test mode

### Using Test Mode in Your Code

#### Check if in Test Mode

```typescript
import { useTestMode } from '../contexts/TestModeContext';

const MyComponent = () => {
  const { isTestMode } = useTestMode();

  if (isTestMode) {
    // Test mode specific behavior
  }
};
```

#### Use Simulated Authentication

```typescript
import { useClaudeCliAvailability } from '../contexts/TestModeContext';

const MyComponent = () => {
  const claudeCliAvailable = useClaudeCliAvailability();

  // In test mode: returns simulated auth state
  // In normal mode: returns real CLI availability
};
```

#### Use Test Mode Storage

```typescript
import { Store } from '@tauri-apps/plugin-store';
import { getTestModeStoreName } from '../utils/testModeStorage';

const MyComponent = () => {
  const loadData = async () => {
    // Automatically uses correct storage file based on mode
    const storeName = getTestModeStoreName('quack-terminals.json');
    const store = await Store.load(storeName);
    // Normal: quack-terminals.json
    // Test:   quack-terminals-TEST.json
  };
};
```

## 🎮 Usage Scenarios

### Scenario 1: Test New User Experience

```bash
# Start in test mode (logged out)
npm run test:dev

# You'll see:
# - Auth banner visible
# - No terminals/data
# - Fresh state

# Click "Get Started" on banner
# Or click "🔐 Login" in TitleBar

# Now test authenticated flows
```

### Scenario 2: Test Banner Behavior

```bash
# Start test mode
npm run test:dev

# Toggle authentication to see banner appear/disappear
# Click "🔐 Login" → Banner hides
# Click "🔓 Logout" → Banner shows

# Test banner priority, positioning, interactions
```

### Scenario 3: Test with Clean State

```bash
# Reset everything and start fresh
npm run test:reset

# Clean slate:
# - No data
# - Logged out
# - Like first time user
```

### Scenario 4: Debug Storage Issues

```bash
# Start test mode
npm run test:dev

# Make changes, test persistence
# Check files at:
# ~/Library/Application Support/com.quack.terminal/*-TEST.json

# Reset when done
npm run test:clean
```

## 🚨 Important Notes

### What Test Mode Does:

✅ Isolates storage to `-TEST.json` files
✅ Simulates Claude CLI authentication
✅ Provides visual indicators (badge, styling)
✅ Allows quick login/logout switching
✅ Persists auth state across reloads

### What Test Mode Does NOT Do:

❌ Does NOT affect your real data
❌ Does NOT require Claude CLI installed
❌ Does NOT connect to real Claude API
❌ Does NOT affect normal mode in any way

### Switching Between Modes

**Normal Mode:**
```bash
npm run tauri:dev
```

**Test Mode:**
```bash
npm run test:dev
```

They are completely independent!

## 🐛 Troubleshooting

### "Test mode controls not showing"

Make sure you started with `npm run test:dev` or set `VITE_TEST_MODE=true`.

Check browser console for:
```
🧪 TEST MODE ENABLED
🧪 Authentication: NOT AUTHENTICATED
🧪 Storage isolation: Active (using *-TEST.json files)
```

### "Auth state not persisting"

Test mode auth state is stored in `localStorage` as `test-mode-auth`.

Clear it manually:
```javascript
// In browser console
localStorage.removeItem('test-mode-auth');
```

### "Want to clear test data"

```bash
# Remove all test storage files
npm run test:clean

# Or manually
rm ~/Library/Application\ Support/com.quack.terminal/*-TEST.json
```

### "Test mode affecting normal mode"

This should NEVER happen. Test mode uses completely separate:
- Storage files (`*-TEST.json`)
- localStorage keys (`test-mode-*`)
- No shared state

If you see issues, please report as a bug!

## 📚 API Reference

### Hooks

#### `useTestMode()`

```typescript
const {
  isTestMode,           // boolean - true if VITE_TEST_MODE=true
  isAuthenticated,      // boolean - simulated auth state
  toggleAuthentication, // () => void - toggle auth
  simulateLogin,        // () => void - set authenticated=true
  simulateLogout,       // () => void - set authenticated=false
  resetTestData         // () => void - clear test state
} = useTestMode();
```

#### `useClaudeCliAvailability()`

```typescript
const claudeCliAvailable = useClaudeCliAvailability();
// boolean | null
// In test mode: returns isAuthenticated from TestModeContext
// In normal mode: returns real check_claude_cli_available result
```

### Utilities

#### `getTestModeStoreName(baseName: string): string`

Transform storage filename for test mode isolation.

```typescript
import { getTestModeStoreName } from '../utils/testModeStorage';

getTestModeStoreName('quack-terminals.json');
// Test mode: 'quack-terminals-TEST.json'
// Normal mode: 'quack-terminals.json'
```

#### `isTestMode(): boolean`

Check if currently in test mode.

```typescript
import { isTestMode } from '../utils/testModeStorage';

if (isTestMode()) {
  console.log('Running in test mode');
}
```

#### `logTestModeStorage(operation: string, storeName: string): void`

Debug logging for storage operations (only logs in test mode).

```typescript
import { logTestModeStorage } from '../utils/testModeStorage';

logTestModeStorage('load', 'quack-terminals-TEST.json');
// Console: 🧪 TEST MODE Storage: load - quack-terminals-TEST.json
```

## 🎓 Best Practices

1. **Always use test mode for testing**
   - Don't test on your real data
   - Use `npm run test:dev` by default

2. **Reset between test sessions**
   - Use `npm run test:reset` for clean slate
   - Prevents test pollution

3. **Document test scenarios**
   - Write down reproduction steps
   - Include test mode in bug reports

4. **Use utilities for storage**
   - Always use `getTestModeStoreName()`
   - Never hardcode storage paths

5. **Check test mode in conditional logic**
   - Use `isTestMode()` or `useTestMode()`
   - Handle test mode explicitly when needed

## 🚀 Contributing

When adding features that use storage or authentication:

1. Import test mode utilities
2. Use `getTestModeStoreName()` for all storage
3. Use `useClaudeCliAvailability()` instead of direct CLI checks
4. Test in both modes (normal + test)
5. Document test mode behavior

## 📝 Examples

See `src/components/TitleBar.tsx` for a complete example of:
- Using `useTestMode()` hook
- Displaying test mode UI
- Handling authentication simulation
- Styling test mode differently

See `src/contexts/TestModeContext.tsx` for implementation details.

---

**Happy Testing! 🦆🧪**
