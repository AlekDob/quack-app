# 🧪 Quack Test Mode - Quick Reference

> Test Mode provides an **isolated testing environment** for Quack without touching your real data.

## 🚀 Quick Start

```bash
# Start Quack in Test Mode
npm run test:dev

# Reset test data and restart
npm run test:reset

# Clean test data only
npm run test:clean
```

## 🎯 What You Get

### Visual Indicators
- **🧪 TEST** badge in TitleBar
- **Orange background** (like DEV MODE)
- Title: "🦆🧪 Quack [TEST MODE]"

### Controls in TitleBar
- **🔐 Login / 🔓 Logout** - Simulate authentication
- **🗑️ Reset** - Clear test auth state

### Isolated Storage
All data stored in separate `-TEST.json` files:
- `quack-terminals-TEST.json`
- `quack-chats-TEST.json`
- `quack-commands-TEST.json`
- `quack-agent-chats-TEST.json`

**Your real data is NEVER touched!**

## 📖 Use Cases

### Test New User Experience
```bash
npm run test:dev
# → Starts logged out
# → No data, fresh state
# → Click "🔐 Login" to simulate auth
```

### Test Auth Banners
```bash
npm run test:dev
# → Toggle "🔐 Login / 🔓 Logout"
# → See banners appear/disappear
# → Test banner priority system
```

### Debug with Clean State
```bash
npm run test:reset
# → Wipes all test data
# → Like first-time user
# → Perfect for reproducible testing
```

## 🔧 How It Works

1. **Environment Variable**: `VITE_TEST_MODE=true`
2. **Separate Storage**: All storage uses `-TEST.json` suffix
3. **Simulated Auth**: No real Claude CLI required
4. **Full Isolation**: Zero impact on normal mode

## ⚠️ Important

- **Normal mode** and **Test mode** are completely independent
- Switch between them anytime:
  - Normal: `npm run dev:mac` (or `dev:win`, `dev:linux`)
  - Test: `npm run test:dev`
- Test data location: `~/Library/Application Support/com.quack.terminal/*-TEST.json`

## 📚 Full Documentation

See [`docs/TEST_MODE.md`](./docs/TEST_MODE.md) for:
- Complete API reference
- Implementation details
- Best practices
- Troubleshooting guide
- Code examples

## 🎓 Quick Tips

1. **Always test in Test Mode** - Protect your real data
2. **Reset between sessions** - `npm run test:reset` for clean slate
3. **Use the controls** - Login/Logout button in TitleBar for quick switching
4. **Check console** - Look for `🧪 TEST MODE` logs

---

**Happy Testing! 🦆🧪**
