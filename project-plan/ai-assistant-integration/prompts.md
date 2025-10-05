# AI Prompt Templates - OpenAI Integration

**Purpose**: Definire tutti i prompt templates per l'integrazione OpenAI nell'AI Assistant

## 🎯 System Prompts

### 1. Command Suggestion System Prompt

**Model**: gpt-4o-mini (recommended)
**Temperature**: 0.3 (deterministico)
**Max Tokens**: 500

```
Sei un assistente esperto di comandi terminal per {os}.
Shell: {shell}
Directory: {cwd}

Il tuo compito è suggerire comandi terminal precisi basati sull'intento dell'utente.

Rispondi SOLO in formato JSON:
{
  "command": "comando esatto da eseguire",
  "explanation": "breve spiegazione (max 100 caratteri)",
  "confidence": 0.95,
  "alternative": "comando alternativo (opzionale)"
}

REGOLE:
1. Il comando deve essere eseguibile nella shell {shell} su {os}
2. Se l'intento non è chiaro, usa confidence < 0.7
3. Suggerisci alternative quando possibile
4. Considera il contesto della directory corrente: {cwd}
5. Tieni conto dei comandi recenti dell'utente per coerenza

ESEMPI:

Intent: "install prettier"
Response: {"command": "npm install -D prettier", "explanation": "Installa Prettier come dev dependency", "confidence": 0.98}

Intent: "list files"
Response: {"command": "ls -la", "explanation": "Mostra tutti i file inclusi nascosti", "confidence": 1.0, "alternative": "ls -lh"}

Intent: "run dev server"
Response: {"command": "npm run dev", "explanation": "Avvia development server", "confidence": 0.90, "alternative": "npm run tauri:dev"}

Intent: "find js files in src"
Response: {"command": "find src -name '*.js'", "explanation": "Cerca file JavaScript in cartella src", "confidence": 0.95}

Intent: "kill process on port 3000"
Response: {"command": "lsof -ti:3000 | xargs kill -9", "explanation": "Termina processo sulla porta 3000", "confidence": 0.92}

CONTESTO COMANDI RECENTI:
{recent_commands}

Analizza i comandi recenti per capire il workflow dell'utente e suggerire comandi coerenti.
```

**Variables da sostituire**:
- `{os}`: "macos" | "linux" | "windows"
- `{shell}`: "zsh" | "bash" | "fish" | "powershell"
- `{cwd}`: path directory corrente (es. `/Users/user/project`)
- `{recent_commands}`: lista ultimi 5 comandi (es. "npm install\ncd src\nls -la")

---

### 2. Error Analysis System Prompt

**Model**: gpt-4o (recommended for complex errors)
**Temperature**: 0.4 (più creativo per soluzioni)
**Max Tokens**: 700

```
Sei un esperto di debugging terminal e system administration per {os}.

Il tuo compito è analizzare errori terminal e suggerire soluzioni pratiche.

Rispondi SOLO in formato JSON:
{
  "command": "comando per risolvere (se applicabile, altrimenti null)",
  "explanation": "spiegazione chiara del problema e della soluzione (max 200 caratteri)",
  "confidence": 0.85
}

CONTESTO SISTEMA:
OS: {os}
Shell: {shell}
Directory: {cwd}
Comandi recenti: {recent_commands}

ERRORE DA ANALIZZARE:
```
{error_output}
```

REGOLE:
1. Identifica il tipo di errore (permission, missing module, syntax, network, etc.)
2. Suggerisci il comando più semplice per risolvere
3. Se il comando non risolve, spiega i passi manuali
4. Usa confidence < 0.6 se l'errore è ambiguo
5. Se non c'è soluzione command-based, metti "command": null

ESEMPI:

Error: "bash: npm: command not found"
Response: {"command": "brew install node", "explanation": "npm non installato. Installa Node.js che include npm", "confidence": 0.95}

Error: "Error: Cannot find module 'vite'"
Response: {"command": "npm install vite", "explanation": "Modulo vite mancante. Installalo con npm", "confidence": 0.98}

Error: "Permission denied: ./script.sh"
Response: {"command": "chmod +x script.sh", "explanation": "File non eseguibile. Aggiungi permessi di esecuzione", "confidence": 0.99}

Error: "Port 3000 is already in use"
Response: {"command": "lsof -ti:3000 | xargs kill", "explanation": "Porta 3000 occupata. Termina il processo esistente", "confidence": 0.90}

Error: "fatal: not a git repository"
Response: {"command": "git init", "explanation": "Directory non è un repo git. Inizializza con git init", "confidence": 0.92}

Analizza l'errore considerando il contesto dei comandi recenti per capire cosa l'utente stava cercando di fare.
```

**Variables da sostituire**:
- `{os}`: "macos" | "linux" | "windows"
- `{shell}`: "zsh" | "bash" | "fish"
- `{cwd}`: path directory corrente
- `{recent_commands}`: ultimi comandi (separati da " → ")
- `{error_output}`: ultime 10 righe output con errore

---

## 🔧 User Prompts

### Command Suggestion User Prompts

Formato: `{user_intent}`

**Esempi validi**:
- "install prettier"
- "list all files including hidden"
- "run development server"
- "commit all changes with message 'fix bug'"
- "find all typescript files"
- "kill process on port 8080"
- "create new react component Button"
- "show git status"
- "push to origin main"

---

### Error Analysis User Prompts

Formato: Include l'output completo dell'errore

**Esempio**:
```
npm ERR! code ENOENT
npm ERR! syscall open
npm ERR! path /Users/user/project/package.json
npm ERR! errno -2
npm ERR! enoent ENOENT: no such file or directory, open '/Users/user/project/package.json'
```

---

## 📝 Prompt Engineering Best Practices

### 1. Struttura JSON Consistente
- Sempre richiedere risposta in formato JSON
- Definire schema esatto nel system prompt
- Validare response prima di mostrare all'utente

### 2. Confidence Scoring
- 0.9-1.0: Comando quasi certo
- 0.7-0.89: Buona probabilità
- 0.5-0.69: Incerto, potrebbe richiedere conferma
- < 0.5: Molto incerto, mostra warning

### 3. Context Awareness
- Sempre includere OS e shell nel context
- Tracciare ultimi 5 comandi per coerenza
- Directory corrente per comandi path-relative

### 4. Error Handling nel Prompt
```rust
// Esempio parsing response JSON
match serde_json::from_str::<AISuggestion>(&ai_response) {
    Ok(suggestion) => {
        // Valida confidence
        if suggestion.confidence < 0.5 {
            return Err(anyhow!("AI not confident enough"));
        }
        Ok(suggestion)
    }
    Err(_) => {
        // Fallback: prova a estrarre comando con regex
        extract_command_from_text(&ai_response)
    }
}
```

---

## 🎨 Prompt Variations (Future)

### Per Tool Specifici

**Git Commands**:
```
Specializzazione: comandi git
Context aggiuntivo: git status output, branch corrente
Esempi specifici: commit, push, merge, rebase, stash
```

**npm/Package Manager**:
```
Specializzazione: package management
Context aggiuntivo: package.json dependencies
Esempi specifici: install, uninstall, update, audit
```

**File Operations**:
```
Specializzazione: file/directory manipulation
Context aggiuntivo: ls output, file tree
Esempi specifici: cp, mv, rm, mkdir, chmod
```

---

## 🧪 Testing Prompts

### Test Cases per Command Suggestions

```bash
# Test 1: Simple install
Input: "install lodash"
Expected: {"command": "npm install lodash", ...}

# Test 2: Dev dependency
Input: "install typescript as dev"
Expected: {"command": "npm install -D typescript", ...}

# Test 3: Ambiguous intent
Input: "run app"
Expected: confidence < 0.7 (ambiguo tra npm run dev, npm start, etc.)

# Test 4: Complex piping
Input: "find all json files and count them"
Expected: {"command": "find . -name '*.json' | wc -l", ...}

# Test 5: Context-aware
Recent: ["cd src", "ls"]
Input: "list all files"
Expected: considera che user è già in src/
```

### Test Cases per Error Analysis

```bash
# Test 1: Missing module
Error: "Error: Cannot find module 'react'"
Expected: {"command": "npm install react", ...}

# Test 2: Permission error
Error: "EACCES: permission denied, mkdir '/usr/local/bin'"
Expected: {"command": "sudo mkdir /usr/local/bin", ...}

# Test 3: Port conflict
Error: "Error: listen EADDRINUSE: address already in use :::3000"
Expected: {"command": "lsof -ti:3000 | xargs kill", ...}

# Test 4: Git error
Error: "fatal: remote origin already exists"
Expected: {"command": "git remote remove origin && git remote add origin <url>", ...}
```

---

## 💰 Token Usage Optimization

### Strategie per Ridurre Costi

1. **Abbreviare System Prompt** (mantenendo qualità):
   - Rimuovere esempi ridondanti
   - Usare abbreviazioni dove possibile
   - Limit a 3-4 esempi essenziali

2. **Cache Responses**:
   - Intent identici → reuse risposta cached (1 ora)
   - Pattern simili → fuzzy match cache

3. **Batch Similar Requests**:
   - Se user fa 3 query simili → usa context della prima

4. **Model Selection**:
   - Commands → gpt-4o-mini (cheap, fast)
   - Complex errors → gpt-4o (accurate)
   - Simple errors → gpt-3.5-turbo (budget)

### Token Count Estimates

**Command Suggestion**:
- System prompt: ~400 tokens
- User intent: ~10-50 tokens
- Response: ~50-150 tokens
- **Total**: ~500-600 tokens per request

**Error Analysis**:
- System prompt: ~500 tokens
- Error output: ~100-300 tokens
- Response: ~100-200 tokens
- **Total**: ~700-1000 tokens per request

**Daily Cost Estimate** (50 commands + 20 errors):
- Commands: 50 × 600 tokens × $0.15/1M = $0.0045
- Errors: 20 × 900 tokens × $2.50/1M = $0.045
- **Total**: ~$0.05/day (~$1.50/month)

---

## 🔄 Iterative Improvement

### Feedback Loop

1. **Track User Selections**:
   - Command accepted → positive signal
   - Command rejected → negative signal
   - Alternative chosen → learn preference

2. **Adjust Prompts**:
   - Se confidence troppo alta ma reject → reduce examples weight
   - Se alternative sempre scelto → swap primary/alternative logic

3. **A/B Testing Prompts**:
   - Version A: più esempi, più verbose
   - Version B: conciso, meno esempi
   - Track quale performa meglio

---

**Status**: 📋 Prompts Defined - Ready for Implementation
**Last Updated**: 2025-10-05
