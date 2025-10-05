# Demo Commands - AI Assistant Testing

**Purpose**: Esempi di comandi da testare con l'AI Assistant durante lo sviluppo

## 🎯 Command Suggestions Test Cases

### NPM/Package Management

```bash
# Test 1: Install dev dependency
Intent: "install prettier"
Expected: npm install -D prettier

# Test 2: Install production dependency
Intent: "install react"
Expected: npm install react

# Test 3: Install specific version
Intent: "install lodash version 4.17.21"
Expected: npm install lodash@4.17.21

# Test 4: Global install
Intent: "install typescript globally"
Expected: npm install -g typescript

# Test 5: Uninstall package
Intent: "remove lodash"
Expected: npm uninstall lodash
```

### File Operations

```bash
# Test 6: List files
Intent: "list all files including hidden"
Expected: ls -la

# Test 7: Find files
Intent: "find all typescript files in src"
Expected: find src -name "*.ts"

# Test 8: Create directory
Intent: "create folder components"
Expected: mkdir -p components

# Test 9: Copy files
Intent: "copy all js files to backup"
Expected: cp *.js backup/

# Test 10: Delete files
Intent: "remove all node_modules"
Expected: rm -rf node_modules
```

### Git Commands

```bash
# Test 11: Git status
Intent: "show git status"
Expected: git status

# Test 12: Git commit
Intent: "commit all changes with message fix bug"
Expected: git add . && git commit -m "fix bug"

# Test 13: Git push
Intent: "push to origin main"
Expected: git push origin main

# Test 14: Git branch
Intent: "create new branch feature-ai"
Expected: git checkout -b feature-ai

# Test 15: Git log
Intent: "show last 5 commits"
Expected: git log -5 --oneline
```

### Process Management

```bash
# Test 16: Kill process by port
Intent: "kill process on port 3000"
Expected: lsof -ti:3000 | xargs kill -9

# Test 17: Show processes
Intent: "show all node processes"
Expected: ps aux | grep node

# Test 18: Background process
Intent: "run dev server in background"
Expected: npm run dev &

# Test 19: Find process
Intent: "find process using port 8080"
Expected: lsof -i :8080
```

### Development Servers

```bash
# Test 20: Run dev server
Intent: "run development server"
Expected: npm run dev or npm run tauri:dev

# Test 21: Build project
Intent: "build for production"
Expected: npm run build

# Test 22: Run tests
Intent: "run all tests"
Expected: npm test

# Test 23: Run linter
Intent: "lint the code"
Expected: npm run lint
```

### System Commands

```bash
# Test 24: Disk usage
Intent: "show disk usage"
Expected: df -h

# Test 25: System info
Intent: "show system information"
Expected: uname -a

# Test 26: Network info
Intent: "show network connections"
Expected: netstat -an

# Test 27: Compress folder
Intent: "compress src folder to archive"
Expected: tar -czf archive.tar.gz src/
```

### Complex Commands

```bash
# Test 28: Piping
Intent: "find js files and count them"
Expected: find . -name "*.js" | wc -l

# Test 29: Multiple commands
Intent: "install dependencies and run dev"
Expected: npm install && npm run dev

# Test 30: Watch files
Intent: "watch for file changes and rebuild"
Expected: fswatch . | xargs -n1 npm run build
```

---

## 🚨 Error Analysis Test Cases

### NPM Errors

```bash
# Error 1: Missing module
Error: "Error: Cannot find module 'vite'"
Expected Solution: npm install vite

# Error 2: Missing script
Error: "npm ERR! missing script: dev"
Expected Solution: Verifica package.json - aggiungi script "dev"

# Error 3: Permission error
Error: "npm ERR! EACCES: permission denied"
Expected Solution: sudo npm install o npm install --unsafe-perm
```

### System Errors

```bash
# Error 4: Command not found
Error: "bash: npm: command not found"
Expected Solution: brew install node (macOS) o apt-get install nodejs (Linux)

# Error 5: Permission denied (file)
Error: "Permission denied: ./script.sh"
Expected Solution: chmod +x script.sh

# Error 6: Port in use
Error: "Error: listen EADDRINUSE: address already in use :::3000"
Expected Solution: lsof -ti:3000 | xargs kill
```

### Git Errors

```bash
# Error 7: Not a git repo
Error: "fatal: not a git repository"
Expected Solution: git init

# Error 8: Remote exists
Error: "fatal: remote origin already exists"
Expected Solution: git remote remove origin && git remote add origin <url>

# Error 9: Merge conflict
Error: "CONFLICT (content): Merge conflict in file.js"
Expected Solution: Risolvi manualmente i conflitti, poi git add . && git commit
```

### Build Errors

```bash
# Error 10: TypeScript error
Error: "TS2307: Cannot find module 'react'"
Expected Solution: npm install @types/react

# Error 11: Syntax error
Error: "SyntaxError: Unexpected token )"
Expected Solution: Controlla sintassi - parentesi non chiusa

# Error 12: Out of memory
Error: "JavaScript heap out of memory"
Expected Solution: export NODE_OPTIONS="--max-old-space-size=4096"
```

---

## 🎨 Context-Aware Test Cases

### Based on Recent Commands

```bash
# Scenario 1: User just installed React
Recent: ["npm install react", "npm install react-dom"]
Intent: "install router"
Expected: npm install react-router-dom (context-aware!)

# Scenario 2: User is in specific directory
Recent: ["cd src/components", "ls"]
Intent: "create new file Button"
Expected: touch Button.tsx (sa già la directory!)

# Scenario 3: User working on git
Recent: ["git status", "git add ."]
Intent: "commit with message"
Expected: git commit -m "..." (next logical step)
```

### Based on Project Type

```bash
# React Project (has package.json with react)
Intent: "create component"
Expected: Suggerisce React component template

# Tauri Project
Intent: "run app"
Expected: npm run tauri:dev (not just npm run dev)

# Rust Project
Intent: "build"
Expected: cargo build (not npm build)
```

---

## 🧪 Edge Cases

### Ambiguous Intents

```bash
# Test 31: Ambiguous
Intent: "run"
Expected: Confidence < 0.7 - chiede chiarimento (npm run dev? npm start? cargo run?)

# Test 32: Typo
Intent: "instal react"
Expected: Corregge typo → npm install react

# Test 33: Very generic
Intent: "help"
Expected: Bassa confidence - suggerisce man page o --help
```

### Special Characters

```bash
# Test 34: Special chars in string
Intent: "commit with message 'fix: resolve #123'"
Expected: Escape correttamente gli apici

# Test 35: Paths with spaces
Intent: "go to My Projects folder"
Expected: cd "My Projects" (con quotes!)

# Test 36: Regex patterns
Intent: "find files matching pattern *.{js,ts}"
Expected: find . -name "*.js" -o -name "*.ts"
```

### Performance

```bash
# Test 37: Very long intent
Intent: [500+ characters]
Expected: Truncate o error message

# Test 38: Empty intent
Intent: ""
Expected: Non triggerare AI - mostra help

# Test 39: Only special chars
Intent: "###!!!"
Expected: Error o ignore
```

---

## 📊 Success Criteria

### Command Suggestions
- ✅ Accuracy > 90% sui comandi comuni (1-25)
- ✅ Confidence scoring corretto (> 0.8 per comandi chiari)
- ✅ Alternative suggestions quando pertinenti
- ✅ Context-aware suggestions funzionanti

### Error Analysis
- ✅ Rileva > 80% errori comuni
- ✅ Suggerisce soluzioni corrette
- ✅ Spiega il problema chiaramente
- ✅ Confidence > 0.7 per errori standard

### Performance
- ✅ Latency < 2s per suggestions
- ✅ Latency < 3s per error analysis
- ✅ Cache hit rate > 30%
- ✅ Rate limiting funzionante

---

**Usage**: Usa questi comandi durante lo sviluppo per testare l'AI Assistant
**Status**: Ready for testing
**Last Updated**: 2025-10-05
