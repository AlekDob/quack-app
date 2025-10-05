# AI Assistant Testing Plan

**Purpose**: Definire test completi per validare l'integrazione OpenAI AI Assistant

## 🧪 Test Strategy

### Testing Pyramid
1. **Unit Tests** (Rust backend) - 60%
2. **Integration Tests** (Frontend-Backend) - 30%
3. **Manual E2E Tests** (User flows) - 10%

---

## 🔧 Backend Tests (Rust)

### 1. API Key Management Tests

```rust
#[cfg(test)]
mod api_key_tests {
    use super::*;

    #[test]
    fn test_save_and_retrieve_api_key() {
        let app = create_test_app();
        let test_key = "sk-test123456789";

        // Save
        let result = save_api_key(app.clone(), test_key.to_string());
        assert!(result.is_ok());

        // Retrieve
        let retrieved = get_stored_api_key(&app).unwrap();
        assert_eq!(retrieved, test_key);
    }

    #[test]
    fn test_missing_api_key_error() {
        let app = create_test_app();
        let result = get_stored_api_key(&app);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("not configured"));
    }

    #[test]
    fn test_api_key_obfuscation() {
        let app = create_test_app();
        let key = "sk-secret123";

        save_api_key(app.clone(), key.to_string()).unwrap();

        // Check che non è salvato in plain text
        let store = app.store("ai-config.json").unwrap();
        let stored_value = store.get("openai_api_key").unwrap();
        assert_ne!(stored_value.as_str().unwrap(), key);
        assert!(stored_value.as_str().unwrap().len() > key.len()); // base64 è più lungo
    }
}
```

### 2. Rate Limiting Tests

```rust
#[cfg(test)]
mod rate_limit_tests {
    use super::*;

    #[test]
    fn test_rate_limit_allows_within_quota() {
        let mut limiter = RateLimiter {
            requests: Vec::new(),
            max_per_minute: 10,
        };

        for _ in 0..10 {
            assert!(limiter.can_proceed());
        }
    }

    #[test]
    fn test_rate_limit_blocks_over_quota() {
        let mut limiter = RateLimiter {
            requests: Vec::new(),
            max_per_minute: 10,
        };

        // Riempi quota
        for _ in 0..10 {
            limiter.can_proceed();
        }

        // 11th request dovrebbe essere bloccata
        assert!(!limiter.can_proceed());
    }

    #[test]
    fn test_rate_limit_resets_after_minute() {
        let mut limiter = RateLimiter {
            requests: Vec::new(),
            max_per_minute: 5,
        };

        // Simula richieste
        for _ in 0..5 {
            limiter.can_proceed();
        }

        // Simula passaggio tempo (mock time)
        // In test reale, usare mock time library
        limiter.requests.clear(); // simula reset

        // Dovrebbe permettere nuove richieste
        assert!(limiter.can_proceed());
    }
}
```

### 3. Caching Tests

```rust
#[cfg(test)]
mod cache_tests {
    use super::*;

    #[test]
    fn test_cache_stores_suggestion() {
        let intent = "install prettier";
        let suggestion = AISuggestion {
            command: "npm install -D prettier".to_string(),
            explanation: "Installa Prettier".to_string(),
            confidence: 0.95,
            alternative: None,
        };

        store_in_cache(intent, suggestion.clone());

        let cached = get_cached_suggestion(intent);
        assert!(cached.is_some());
        assert_eq!(cached.unwrap().command, suggestion.command);
    }

    #[test]
    fn test_cache_expires_after_hour() {
        let intent = "run dev";
        let suggestion = AISuggestion { /* ... */ };

        store_in_cache(intent, suggestion);

        // Mock time advance 2 ore
        // In test reale: advance_time_by(Duration::from_secs(7200));

        let cached = get_cached_suggestion(intent);
        assert!(cached.is_none()); // Dovrebbe essere scaduto
    }

    #[test]
    fn test_cache_different_intents() {
        store_in_cache("install react", AISuggestion { /* ... */ });
        store_in_cache("run dev", AISuggestion { /* ... */ });

        assert!(get_cached_suggestion("install react").is_some());
        assert!(get_cached_suggestion("run dev").is_some());
        assert!(get_cached_suggestion("unknown").is_none());
    }
}
```

### 4. Error Detection Tests

```rust
#[cfg(test)]
mod error_detection_tests {
    use super::*;

    #[test]
    fn test_detects_command_not_found() {
        let output = "bash: npm: command not found";
        let error = detect_error_patterns(output);
        assert!(error.is_some());
        assert!(error.unwrap().contains("command not found"));
    }

    #[test]
    fn test_detects_npm_error() {
        let output = r#"
npm ERR! code ENOENT
npm ERR! syscall open
npm ERR! errno -2
        "#;
        let error = detect_error_patterns(output);
        assert!(error.is_some());
    }

    #[test]
    fn test_detects_permission_denied() {
        let output = "Permission denied: ./script.sh";
        let error = detect_error_patterns(output);
        assert!(error.is_some());
    }

    #[test]
    fn test_no_error_in_normal_output() {
        let output = "Successfully installed packages";
        let error = detect_error_patterns(output);
        assert!(error.is_none());
    }

    #[test]
    fn test_extracts_error_context() {
        let output = r#"
line 1
line 2
line 3
ERROR: Something went wrong
line 5
line 6
        "#;
        let error = detect_error_patterns(output).unwrap();
        assert!(error.contains("ERROR: Something went wrong"));
        assert!(error.contains("line 3")); // context prima
        assert!(error.contains("line 5")); // context dopo
    }
}
```

---

## 🎨 Frontend Tests (React/TypeScript)

### 1. AIAssistant Component Tests

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AIAssistant from './AIAssistant'
import { invoke } from '@tauri-apps/api/core'

jest.mock('@tauri-apps/api/core')

describe('AIAssistant', () => {
  test('shows loading state initially', () => {
    render(
      <AIAssistant
        intent="install prettier"
        onClose={() => {}}
        onSelectCommand={() => {}}
        terminalContext={{ cwd: '/test', recentCommands: [] }}
      />
    )

    expect(screen.getByText('Thinking...')).toBeInTheDocument()
  })

  test('displays suggestion when AI responds', async () => {
    const mockSuggestion = {
      command: 'npm install -D prettier',
      explanation: 'Installa Prettier',
      confidence: 0.95,
    }

    ;(invoke as jest.Mock).mockResolvedValue(mockSuggestion)

    render(<AIAssistant intent="install prettier" {...props} />)

    await waitFor(() => {
      expect(screen.getByText('npm install -D prettier')).toBeInTheDocument()
      expect(screen.getByText('Installa Prettier')).toBeInTheDocument()
    })
  })

  test('executes command on button click', async () => {
    const onSelectCommand = jest.fn()
    const mockSuggestion = { command: 'ls -la', explanation: 'List files', confidence: 1.0 }

    ;(invoke as jest.Mock).mockResolvedValue(mockSuggestion)

    render(<AIAssistant intent="list files" onSelectCommand={onSelectCommand} {...props} />)

    await waitFor(() => screen.getByText('Execute ⏎'))
    fireEvent.click(screen.getByText('Execute ⏎'))

    expect(onSelectCommand).toHaveBeenCalledWith('ls -la')
  })

  test('shows error message on API failure', async () => {
    ;(invoke as jest.Mock).mockRejectedValue(new Error('API key not configured'))

    render(<AIAssistant intent="test" {...props} />)

    await waitFor(() => {
      expect(screen.getByText(/API key not configured/i)).toBeInTheDocument()
    })
  })

  test('closes on Esc key', () => {
    const onClose = jest.fn()
    render(<AIAssistant intent="test" onClose={onClose} {...props} />)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})
```

### 2. TerminalView Integration Tests

```typescript
describe('TerminalView AI Integration', () => {
  test('triggers AI assistant on # character', () => {
    const { container } = render(<TerminalView {...props} />)

    // Simula input "install prettier#"
    const terminal = container.querySelector('.terminal-surface')
    // Trigger onData with accumulated buffer + '#'

    // Assert AIAssistant modal è visibile
    expect(screen.getByText('🤖 AI Command Assistant')).toBeInTheDocument()
  })

  test('does not trigger AI when disabled', () => {
    render(<TerminalView aiEnabled={false} {...props} />)

    // Simula input con '#'
    // Assert AIAssistant modal NON è visibile
    expect(screen.queryByText('🤖 AI Command Assistant')).not.toBeInTheDocument()
  })

  test('detects errors and shows analyzer', async () => {
    const { rerender } = render(<TerminalView {...props} />)

    // Simula output con errore
    act(() => {
      // Trigger terminal-data event con error output
      emit('terminal-data', {
        id: 'terminal-1',
        data: 'npm ERR! code ENOENT',
      })
    })

    await waitFor(() => {
      expect(screen.getByText('🤖 AI Analysis')).toBeInTheDocument()
    })
  })
})
```

### 3. AISettings Tests

```typescript
describe('AISettings', () => {
  test('saves API key on button click', async () => {
    ;(invoke as jest.Mock).mockResolvedValue(undefined)

    render(<AISettingsPanel />)

    const input = screen.getByPlaceholderText('sk-...')
    fireEvent.change(input, { target: { value: 'sk-test123' } })

    fireEvent.click(screen.getByText('Save & Test'))

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('save_api_key', { key: 'sk-test123' })
    })
  })

  test('shows success on valid API key', async () => {
    ;(invoke as jest.Mock)
      .mockResolvedValueOnce(undefined) // save
      .mockResolvedValueOnce(true) // test connection

    render(<AISettingsPanel />)

    // Save key
    fireEvent.change(screen.getByPlaceholderText('sk-...'), {
      target: { value: 'sk-valid' },
    })
    fireEvent.click(screen.getByText('Save & Test'))

    await waitFor(() => {
      expect(screen.getByText('✓ Connected')).toBeInTheDocument()
    })
  })

  test('displays token usage stats', async () => {
    const mockStats = {
      totalTokensUsed: 50000,
      estimatedCost: 0.125,
      requestCount: 100,
    }

    ;(invoke as jest.Mock).mockResolvedValue(mockStats)

    render(<AISettingsPanel />)

    await waitFor(() => {
      expect(screen.getByText('50,000')).toBeInTheDocument() // tokens
      expect(screen.getByText('$0.1250')).toBeInTheDocument() // cost
      expect(screen.getByText('100')).toBeInTheDocument() // requests
    })
  })
})
```

---

## 🎯 Integration Tests

### Test Scenarios

#### 1. Full Command Suggestion Flow

**Steps**:
1. User digita "install lodash" nel terminale
2. User preme `#`
3. Backend riceve intent "install lodash"
4. OpenAI API ritorna suggestion
5. Frontend mostra modal con comando
6. User clicca "Execute"
7. Comando viene eseguito nel terminale

**Validation**:
- ✅ Modal appare < 2 secondi
- ✅ Comando suggerito è corretto
- ✅ Confidence > 0.8
- ✅ Comando viene eseguito senza errori

#### 2. Error Analysis Flow

**Steps**:
1. User esegue comando `npm run dev` (non esistente)
2. Terminale output: `npm ERR! missing script: dev`
3. Backend rileva errore pattern
4. AI analizza errore
5. Frontend mostra inline suggestion

**Validation**:
- ✅ Errore rilevato automaticamente
- ✅ AI suggestion appare < 3 secondi
- ✅ Suggestion è rilevante (es. "usa npm run tauri:dev")
- ✅ User può copiare comando suggerito

#### 3. Rate Limiting Flow

**Steps**:
1. User fa 10 richieste AI in 30 secondi
2. 11th richiesta dovrebbe essere bloccata
3. Error message mostrato all'utente

**Validation**:
- ✅ Prime 10 richieste: OK
- ✅ 11th richiesta: Error "Rate limit exceeded"
- ✅ Dopo 1 minuto: richieste riprendono

#### 4. Cache Hit Flow

**Steps**:
1. User chiede "install react"
2. AI risponde con suggestion (chiamata API)
3. User chiede di nuovo "install react" dopo 30 secondi
4. Risposta viene servita dalla cache (no API call)

**Validation**:
- ✅ Prima richiesta: ~2s latency
- ✅ Seconda richiesta: < 100ms latency (cache)
- ✅ Token usage non aumenta sulla seconda

---

## 🧪 Manual Test Cases

### Command Suggestions

| # | Intent | Expected Command | Confidence | Notes |
|---|--------|------------------|------------|-------|
| 1 | "install prettier" | `npm install -D prettier` | > 0.95 | Dev dependency |
| 2 | "install react" | `npm install react` | > 0.95 | Production dependency |
| 3 | "run dev server" | `npm run dev` or `npm run tauri:dev` | > 0.80 | Context-aware |
| 4 | "list all files" | `ls -la` | > 0.95 | Include hidden |
| 5 | "find js files in src" | `find src -name "*.js"` | > 0.90 | Path-specific |
| 6 | "kill port 3000" | `lsof -ti:3000 \| xargs kill -9` | > 0.85 | Complex piping |
| 7 | "git commit all" | `git add . && git commit -m "..."` | > 0.80 | Multi-command |
| 8 | "show disk usage" | `df -h` | > 0.95 | Simple command |
| 9 | "compress folder" | `tar -czf archive.tar.gz folder/` | > 0.85 | Archive command |
| 10 | "watch file changes" | `fswatch . \| xargs -n1 ...` | > 0.70 | Advanced |

### Error Analysis

| # | Error Type | Error Message | Expected Solution | Confidence |
|---|------------|---------------|-------------------|------------|
| 1 | Missing module | `Cannot find module 'vite'` | `npm install vite` | > 0.95 |
| 2 | Command not found | `bash: npm: command not found` | `brew install node` | > 0.90 |
| 3 | Permission denied | `EACCES: permission denied` | `sudo ...` or `chmod +x` | > 0.85 |
| 4 | Port in use | `EADDRINUSE: port 3000` | `lsof -ti:3000 \| xargs kill` | > 0.90 |
| 5 | Git error | `fatal: not a git repository` | `git init` | > 0.95 |
| 6 | Syntax error | `SyntaxError: Unexpected token` | Explain + suggest lint | > 0.70 |
| 7 | Network error | `ENOTFOUND` | Check connection / DNS | > 0.60 |
| 8 | Disk full | `ENOSPC: no space left` | `du -sh * \| sort -h` | > 0.75 |

### Edge Cases

| # | Scenario | Expected Behavior |
|---|----------|-------------------|
| 1 | API key non configurata | Error message chiaro + link a settings |
| 2 | OpenAI API down | Fallback graceful, no crash |
| 3 | Invalid JSON response da AI | Retry o error message |
| 4 | Rate limit exceeded | Error + tempo rimanente |
| 5 | Empty intent (solo "#") | Non triggerare AI |
| 6 | Intent molto lungo (>500 char) | Truncate o error |
| 7 | Caratteri speciali nell'intent | Escape correttamente |
| 8 | Network timeout | Error dopo 10s |

---

## 📊 Performance Tests

### Latency Benchmarks

**Command Suggestions** (gpt-4o-mini):
- Target: < 2 secondi
- Acceptable: < 3 secondi
- Unacceptable: > 5 secondi

**Error Analysis** (gpt-4o):
- Target: < 3 secondi
- Acceptable: < 5 secondi
- Unacceptable: > 8 secondi

### Load Testing

**Scenario**: 100 richieste in 10 minuti
- Rate limit dovrebbe bloccare dopo 10 req/min
- Cache hit rate > 30%
- No memory leaks
- No crashes

### Token Usage Tests

**Daily Usage Simulation** (50 commands + 20 errors):
- Commands: 50 × ~600 tokens = 30K tokens
- Errors: 20 × ~900 tokens = 18K tokens
- **Total**: ~48K tokens/day
- **Cost**: < $0.10/day con gpt-4o-mini

---

## ✅ Acceptance Criteria

### Must Have (MVP)
- ✅ Command suggestions funzionano con > 90% accuracy
- ✅ Error analysis rileva > 80% errori comuni
- ✅ Latency < 3s per suggestions
- ✅ Rate limiting previene abuse
- ✅ API key storage sicuro
- ✅ Cache riduce costi > 30%
- ✅ Graceful fallback se API down

### Should Have (Post-MVP)
- ✅ Alternative suggestions
- ✅ Learning from user feedback
- ✅ Multi-language support
- ✅ Context-aware suggestions basate su package.json

### Nice to Have (Future)
- ✅ Voice input per intents
- ✅ AI auto-fix con conferma
- ✅ Integration con GitHub Issues
- ✅ Custom prompt templates per progetto

---

## 🐛 Known Issues / Limitations

1. **OpenAI API Dependency**: Se API down, feature non funziona
   - Mitigation: Fallback to local patterns/rules

2. **Cost Control**: User potrebbe fare troppe richieste
   - Mitigation: Rate limiting + usage warnings

3. **Privacy**: Comandi/errori inviati a OpenAI
   - Mitigation: User opt-in + disclaimer

4. **Accuracy**: AI può suggerire comandi sbagliati
   - Mitigation: Confidence scoring + user review

---

**Status**: 📋 Testing Plan Complete
**Coverage Target**: > 80% code coverage
**Last Updated**: 2025-10-05
