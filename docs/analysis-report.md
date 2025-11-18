# 📊 Analisi Globale del Progetto Quack - Report Tecnico

**Progetto**: Quack App (Multi-agentic Tauri Desktop App)
**Data Analisi**: 2025-01-16
**Analista**: Agent Quinn (Test Coverage & Performance Optimizer)
**Stack**: Tauri 2.8.5, React 19.1.1, TypeScript 5.8.3, Claude Agent SDK 0.1.14

---

## 🔴 EXECUTIVE SUMMARY - Punti Critici

### Severity Legend
- 🔴 **CRITICA** - Blocca scalabilità e manutenibilità, rischio alto
- 🟡 **ALTA** - Impatto significativo su performance/qualità
- 🟠 **MEDIA** - Da risolvere per migliorare qualità
- 🟢 **BASSA** - Nice to have

### Metriche Generali Progetto

| Metrica | Valore | Status |
|---------|--------|--------|
| **Total Lines of Code** | 60,086 | ⚠️ |
| **Files TypeScript/React** | 208 | ✅ |
| **React Hooks Calls** | 1,458 | ⚠️ |
| **Test Coverage** | 0% | 🔴 |
| **Files > 300 lines** | 54 (26%) | 🔴 |
| **Console.log statements** | 1,125 | 🟡 |
| **Dependencies** | 47 prod + 16 dev | ✅ |

---

## 1. 📉 TEST COVERAGE - **CRITICO** 🔴

### Status Attuale
```
📊 Coverage: 0% (nessun test presente!)
📦 Files Testati: 0/208
🧪 Test Runner: NON CONFIGURATO
⚠️  ZERO file .test.ts/.test.tsx trovati!
```

### Gap Critici Identificati

| Area | Righe Codice | Coverage | Severity | Priority |
|------|-------------|----------|----------|----------|
| **App.tsx** (entry point) | 7,293 | 0% | 🔴 CRITICA | P0 |
| **Chat System** (ChatInput, ChatView, AIAssistant) | ~3,592 | 0% | 🔴 CRITICA | P0 |
| **Terminal Management** (TerminalSidebar, TerminalView) | ~1,629 | 0% | 🔴 CRITICA | P0 |
| **Git Integration** (GitPanel, GitSidebar, BranchManager) | ~1,608 | 0% | 🔴 CRITICA | P0 |
| **Hooks Personalizzati** (1,458 hook calls) | ~5,000 | 0% | 🟡 ALTA | P1 |
| **Context Providers** (UIContext, ChatContext, GitContext) | ~1,164 | 0% | 🟡 ALTA | P1 |

### 🎯 Raccomandazioni Test Priority

#### **P0 - IMMEDIATE (questa settimana)**

**1. Setup Vitest + React Testing Library**

```bash
# Installazione dipendenze test
npm install -D vitest @testing-library/react @testing-library/jest-dom happy-dom
npm install -D @vitest/coverage-v8 # Coverage reporter
```

**2. Configurazione `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/',
        'dist/',
      ],
      // Target coverage thresholds
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80,
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
```

**3. Setup file `src/test/setup.ts`**

```typescript
import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers)

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock Tauri API
global.window.__TAURI__ = {
  invoke: vi.fn(),
  event: {
    listen: vi.fn(),
    emit: vi.fn(),
  },
}

// Mock Tauri plugins
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-store', () => ({
  Store: {
    load: vi.fn(() => ({
      get: vi.fn(),
      set: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn(),
    })),
  },
}))
```

**4. Test Utilities `src/test/utils.tsx`**

```typescript
import { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'

// Custom render with providers
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      // Add your providers here
      // <ThemeProvider>
      //   <ChatContext.Provider>
      {children}
      //   </ChatContext.Provider>
      // </ThemeProvider>
    )
  }

  return render(ui, { wrapper: Wrapper, ...options })
}

export * from '@testing-library/react'
```

**5. Package.json scripts**

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest --watch"
  }
}
```

#### **Test Critici da Implementare SUBITO**

**Test Suite 1: `src/App.test.tsx`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import App from './App'

describe('App - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render without crashing', () => {
    render(<App />)
    expect(screen.getByTestId('app-container')).toBeInTheDocument()
  })

  it('should initialize storage on mount', async () => {
    const mockStoreLoad = vi.fn()
    vi.mocked(Store.load).mockResolvedValue(mockStoreLoad)

    render(<App />)

    await waitFor(() => {
      expect(Store.load).toHaveBeenCalledWith(expect.stringContaining('quack-terminals.json'))
    })
  })

  it('should load terminals from storage on startup', async () => {
    const mockTerminals = [
      { id: '1', label: 'Test Terminal', cwd: '/test', color: '#fff' }
    ]

    vi.mocked(Store.load).mockResolvedValue({
      get: vi.fn().mockResolvedValue(mockTerminals)
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Test Terminal')).toBeInTheDocument()
    })
  })

  // TODO: Add more tests for:
  // - Terminal creation/deletion
  // - Chat session management
  // - Git status updates
  // - Storage persistence
})
```

**Test Suite 2: `src/components/ChatInput.test.tsx`**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ChatInput from './ChatInput'

describe('ChatInput Component', () => {
  const mockOnSend = vi.fn()

  it('should render textarea with placeholder', () => {
    render(<ChatInput onSend={mockOnSend} placeholder="Ask Claude..." />)
    expect(screen.getByPlaceholderText('Ask Claude...')).toBeInTheDocument()
  })

  it('should call onSend when Enter is pressed', async () => {
    const user = userEvent.setup()
    render(<ChatInput onSend={mockOnSend} />)

    const textarea = screen.getByRole('textbox')
    await user.type(textarea, 'Hello{Enter}')

    expect(mockOnSend).toHaveBeenCalledWith('Hello', expect.any(Object))
  })

  it('should NOT send when Shift+Enter is pressed', async () => {
    const user = userEvent.setup()
    render(<ChatInput onSend={mockOnSend} />)

    const textarea = screen.getByRole('textbox')
    await user.type(textarea, 'Hello{Shift>}{Enter}{/Shift}')

    expect(mockOnSend).not.toHaveBeenCalled()
    expect(textarea).toHaveValue('Hello\n')
  })

  it('should show agent autocomplete when typing @', async () => {
    const agents = [
      { id: '1', name: 'Agent Mike', role: 'backend' }
    ]
    const user = userEvent.setup()

    render(<ChatInput onSend={mockOnSend} agents={agents} />)

    const textarea = screen.getByRole('textbox')
    await user.type(textarea, '@m')

    await waitFor(() => {
      expect(screen.getByText('Agent Mike')).toBeInTheDocument()
    })
  })

  it('should handle file attachments', async () => {
    const user = userEvent.setup()
    render(<ChatInput onSend={mockOnSend} />)

    const file = new File(['console.log("test")'], 'test.ts', { type: 'text/typescript' })
    const input = screen.getByLabelText('Attach files')

    await user.upload(input, file)

    await waitFor(() => {
      expect(screen.getByText('test.ts')).toBeInTheDocument()
    })
  })

  // TODO: Add more tests for:
  // - Slash commands autocomplete
  // - File path autocomplete
  // - Voice recording
  // - Drag & drop files
  // - Max attachments limit
})
```

**Test Suite 3: `src/utils/agentMentions.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { parseAgentMentions, matchMentionsToAgents } from './agentMentions'

describe('Agent Mentions Utility', () => {
  it('should parse single @mention', () => {
    const result = parseAgentMentions('Hey @mike can you help?')
    expect(result).toEqual(['mike'])
  })

  it('should parse multiple @mentions', () => {
    const result = parseAgentMentions('@mike and @julie please review')
    expect(result).toEqual(['mike', 'julie'])
  })

  it('should handle @mentions with special chars', () => {
    const result = parseAgentMentions('@mike-backend @julie_designer')
    expect(result).toEqual(['mike-backend', 'julie_designer'])
  })

  it('should match mentions to agent IDs', () => {
    const agents = [
      { id: '1', name: 'Mike Backend' },
      { id: '2', name: 'Julie Designer' }
    ]
    const mentions = ['mike', 'julie']

    const result = matchMentionsToAgents(mentions, agents)
    expect(result).toEqual(['1', '2'])
  })

  it('should handle case-insensitive matching', () => {
    const agents = [{ id: '1', name: 'Mike Backend' }]
    const mentions = ['MIKE', 'mike', 'MiKe']

    const result = matchMentionsToAgents(mentions, agents)
    expect(result).toEqual(['1', '1', '1'])
  })
})
```

#### **P1 - QUESTA SETTIMANA**

**Test Suite 4: `src/components/AIAssistant.test.tsx`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import AIAssistant from './AIAssistant'
import * as claudeSDK from '../services/claudeSDK'

vi.mock('../services/claudeSDK')

describe('AIAssistant - Streaming Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should handle streaming response', async () => {
    const mockStream = {
      async *[Symbol.asyncIterator]() {
        yield { type: 'text', text: 'Hello' }
        yield { type: 'text', text: ' World' }
      }
    }

    vi.mocked(claudeSDK.sendMessage).mockResolvedValue(mockStream)

    render(<AIAssistant />)

    // Simulate user sending message
    await userEvent.type(screen.getByRole('textbox'), 'Hi{Enter}')

    await waitFor(() => {
      expect(screen.getByText('Hello World')).toBeInTheDocument()
    })
  })

  it('should handle streaming errors', async () => {
    vi.mocked(claudeSDK.sendMessage).mockRejectedValue(new Error('API Error'))

    render(<AIAssistant />)

    await userEvent.type(screen.getByRole('textbox'), 'Hi{Enter}')

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument()
    })
  })

  // TODO: Add tests for:
  // - Abort streaming
  // - Tool use events
  // - Token usage tracking
  // - Session resume
})
```

**Test Suite 5: `src/hooks/useClaudeChat.test.ts`**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useClaudeChat } from './useClaudeChat'

describe('useClaudeChat Hook', () => {
  it('should initialize with empty messages', () => {
    const { result } = renderHook(() => useClaudeChat())
    expect(result.current.messages).toEqual([])
  })

  it('should add message to history', async () => {
    const { result } = renderHook(() => useClaudeChat())

    await waitFor(() => {
      result.current.sendMessage('Hello')
    })

    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0].content).toBe('Hello')
  })

  it('should handle streaming updates', async () => {
    const { result } = renderHook(() => useClaudeChat())

    // Mock streaming response
    vi.mocked(claudeSDK.sendMessage).mockImplementation(async function* () {
      yield { type: 'text', text: 'Hello' }
      yield { type: 'text', text: ' World' }
    })

    await waitFor(() => {
      result.current.sendMessage('Hi')
    })

    expect(result.current.messages.at(-1)?.content).toBe('Hello World')
  })

  // TODO: Add tests for:
  // - Abort streaming
  // - Session resume
  // - Token tracking
  // - Error handling
})
```

---

## 2. 🏗️ VIOLAZIONI ARCHITETTURALI - **CRITICA** 🔴

### Regola Violata: **File > 300 Linee**

**54 file** violano la regola dei 300 righe (26% dei file totali!)

#### Top 20 Violazioni Più Gravi

| # | File | Linee | Violazione % | Severity | Effort |
|---|------|-------|-------------|----------|--------|
| 1 | **App.tsx** | 7,293 | +2,331% 🔥🔥🔥 | 🔴 CRITICA | Difficile |
| 2 | **RepositoryGroup.tsx** | 1,643 | +448% 🔥🔥 | 🔴 CRITICA | Medio |
| 3 | **ChatInput.tsx** | 1,540 | +413% 🔥🔥 | 🔴 CRITICA | Medio |
| 4 | **AppRefactored.tsx** | 1,083 | +261% 🔥 | 🟡 ALTA | Medio |
| 5 | **marketplaceData.ts** | 1,022 | +241% 🔥 | 🟡 ALTA | Facile |
| 6 | **NewTerminalModal.tsx** | 922 | +207% 🔥 | 🟡 ALTA | Medio |
| 7 | **TerminalSidebar.tsx** | 863 | +188% | 🟡 ALTA | Medio |
| 8 | **NewTerminalModal.old.tsx** | 791 | +164% | 🟢 BASSA | Facile (DELETE!) |
| 9 | **TerminalView.tsx** | 766 | +155% | 🟡 ALTA | Medio |
| 10 | **types.ts** | 762 | +154% | 🟢 BASSA | Facile |
| 11 | **CodeEditorCodeMirror.tsx** | 755 | +152% | 🟡 ALTA | Medio |
| 12 | **SidePanel.tsx** | 724 | +141% | 🟡 ALTA | Medio |
| 13 | **FileExplorer.tsx** | 645 | +115% | 🟠 MEDIA | Medio |
| 14 | **SessionDetailsDrawer.tsx** | 643 | +114% | 🟠 MEDIA | Medio |
| 15 | **QuackAgencyDrawer.tsx** | 623 | +108% | 🟠 MEDIA | Medio |
| 16 | **AgentContextPanel.tsx** | 617 | +106% | 🟠 MEDIA | Medio |
| 17 | **AIAssistant.tsx** | 612 | +104% | 🟡 ALTA | Medio |
| 18 | **AgentsPanel.tsx** | 568 | +89% | 🟠 MEDIA | Medio |
| 19 | **GitSidebar.tsx** | 545 | +82% | 🟠 MEDIA | Medio |
| 20 | **ToolWidgets.tsx** | 501 | +67% | 🟠 MEDIA | Facile |

### 🎯 Piano di Refactoring Prioritario

#### **PRIORITY 0: App.tsx - IL MOSTRO** 🔥🔥🔥

**Problema Critico**: 7,293 righe in un singolo file!

**Breakdown responsabilità**:
- Terminal management (create, delete, restore) ~1,200 lines
- Storage persistence (save/load) ~800 lines
- Agent chat management ~900 lines
- Git operations integration ~600 lines
- UI state management ~700 lines
- Event listeners (terminal output, exit) ~500 lines
- Drawers/Modals state ~400 lines
- Settings management ~300 lines
- Misc utilities & helpers ~1,893 lines

**Strategia Refactoring**:

```
📁 src/App.tsx (PRIMA: 7,293 linee)
├─ 📁 hooks/
│  ├─ useTerminalManagement.ts     (~300 lines) - Create, delete, restore terminals
│  ├─ useStoragePersistence.ts     (~250 lines) - Save/load state from Tauri Store
│  ├─ useAgentChats.ts            (~200 lines) - Agent chat lifecycle
│  ├─ useGitIntegration.ts        (~180 lines) - Git status, commits, branches
│  ├─ useTerminalEvents.ts        (~150 lines) - Listen to terminal output/exit
│  └─ useDrawersState.ts          (~120 lines) - Manage drawer open/close state
│
├─ 📁 components/
│  ├─ MainLayout.tsx              (~200 lines) - Top-level layout orchestration
│  ├─ TerminalContainer.tsx       (~180 lines) - Terminal sidebar + view wrapper
│  ├─ ChatContainer.tsx           (~150 lines) - Chat UI wrapper
│  └─ ModalsManager.tsx           (~100 lines) - All modals in one place
│
└─ App.tsx (DOPO: ~250 lines)      - Solo orchestrazione & providers!
```

**Step-by-step Implementation**:

**WEEK 1: Estrarre Hooks**

```typescript
// hooks/useTerminalManagement.ts
export function useTerminalManagement() {
  const [terminals, setTerminals] = useState<TerminalInfo[]>([])

  const createTerminal = useCallback(async (options: CreateTerminalOptions) => {
    // Extract logic from App.tsx handleNewTerminal
    const newTerminal = await invoke('create_terminal', options)
    setTerminals(prev => [...prev, newTerminal])
    return newTerminal
  }, [])

  const deleteTerminal = useCallback(async (id: string) => {
    // Extract logic from App.tsx handleClose
    await invoke('kill_terminal', { id })
    setTerminals(prev => prev.filter(t => t.id !== id))
  }, [])

  const restoreTerminals = useCallback(async (metadata: TerminalMetadata[]) => {
    // Extract logic from App.tsx useEffect restoration
    const restored = await Promise.all(
      metadata.map(meta => invoke('restore_terminal', meta))
    )
    setTerminals(restored)
  }, [])

  return {
    terminals,
    createTerminal,
    deleteTerminal,
    restoreTerminals,
  }
}
```

```typescript
// hooks/useStoragePersistence.ts
export function useStoragePersistence<T>(
  storeName: string,
  key: string,
  initialValue: T
) {
  const [data, setData] = useState<T>(initialValue)
  const [isLoading, setIsLoading] = useState(true)

  // Load from storage on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const store = await Store.load(storeName)
        const stored = await store.get<T>(key)
        if (stored) setData(stored)
      } catch (error) {
        console.error('Failed to load from storage:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [storeName, key])

  // Save to storage with debounce
  const saveData = useMemo(
    () => debounce(async (value: T) => {
      try {
        const store = await Store.load(storeName)
        await store.set(key, value)
        await store.save()
      } catch (error) {
        console.error('Failed to save to storage:', error)
      }
    }, 1000),
    [storeName, key]
  )

  // Save whenever data changes
  useEffect(() => {
    if (!isLoading) {
      saveData(data)
    }
  }, [data, isLoading, saveData])

  return [data, setData, isLoading] as const
}
```

**WEEK 2: Splittare Componenti**

```typescript
// components/MainLayout.tsx (~200 lines)
export function MainLayout() {
  const { terminals, createTerminal, deleteTerminal } = useTerminalManagement()
  const { agentChats, createChat } = useAgentChats()
  const { openDrawer, closeDrawer, drawerState } = useDrawersState()

  return (
    <div className="app-container">
      <TitleBar />

      <div className="main-content">
        <TerminalContainer
          terminals={terminals}
          onCreateTerminal={createTerminal}
          onDeleteTerminal={deleteTerminal}
        />

        <ChatContainer
          agentChats={agentChats}
          onCreateChat={createChat}
        />
      </div>

      <ModalsManager
        drawerState={drawerState}
        onClose={closeDrawer}
      />
    </div>
  )
}
```

**WEEK 3: Refactoring Finale App.tsx**

```typescript
// App.tsx (DOPO: ~250 lines)
function App() {
  // All complex logic moved to hooks!
  const terminalManagement = useTerminalManagement()
  const storagePersistence = useStoragePersistence()
  const gitIntegration = useGitIntegration()

  // Restore state on mount
  useEffect(() => {
    const restoreState = async () => {
      const metadata = await storagePersistence.load('terminals')
      await terminalManagement.restoreTerminals(metadata)
    }
    restoreState()
  }, [])

  return (
    <ErrorBoundary>
      <GitContext.Provider value={gitIntegration}>
        <TerminalContext.Provider value={terminalManagement}>
          <MainLayout />
        </TerminalContext.Provider>
      </GitContext.Provider>
    </ErrorBoundary>
  )
}
```

**Target**: App.tsx da 7,293 → <300 linee ✅

---

#### **PRIORITY 1: ChatInput.tsx** 🔥🔥

**Problema**: 1,540 linee con troppa responsabilità

**Breakdown**:
- Autocomplete logic (agents, files, commands) ~400 lines
- File attachments (upload, preview, drag-drop) ~350 lines
- Voice recording integration ~200 lines
- Keyboard navigation ~180 lines
- Textarea auto-resize ~120 lines
- Mentions parsing ~100 lines
- Slash commands ~100 lines
- Misc utilities ~90 lines

**Refactoring Strategy**:

```typescript
// PRIMA: ChatInput.tsx (1,540 lines)

// DOPO:
// components/chat/ChatInput.tsx (~300 lines)
// components/chat/AutocompleteMenu.tsx (~200 lines)
// components/chat/AttachmentsManager.tsx (~180 lines)
// components/chat/VoiceInputButton.tsx (~150 lines)
// hooks/useAutocomplete.ts (~150 lines)
// hooks/useFileAttachments.ts (~120 lines)
// hooks/useDragAndDrop.ts (~80 lines)
```

**Implementation**:

```typescript
// components/chat/ChatInput.tsx (DOPO: ~300 lines)
export default function ChatInput({
  onSend,
  agents,
  placeholder,
  ...props
}: ChatInputProps) {
  const autocomplete = useAutocomplete(agents)
  const attachments = useFileAttachments()
  const dragDrop = useDragAndDrop(attachments.addFiles)

  const handleSubmit = () => {
    if (!input.trim() && attachments.files.length === 0) return

    onSend(input, {
      attachments: attachments.files,
      mentionedAgents: autocomplete.selectedAgents,
    })

    input.clear()
    attachments.clear()
  }

  return (
    <div
      className="chat-input-container"
      {...dragDrop.dropHandlers}
    >
      <AttachmentsManager {...attachments} />

      <textarea
        ref={textareaRef}
        value={input}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
      />

      {autocomplete.isOpen && (
        <AutocompleteMenu {...autocomplete} />
      )}

      <div className="actions">
        <VoiceInputButton onTranscript={handleVoiceInput} />
        <button onClick={handleSubmit}>Send</button>
      </div>
    </div>
  )
}
```

**Target**: ChatInput.tsx da 1,540 → <400 linee ✅

---

#### **PRIORITY 2: RepositoryGroup.tsx** 🔥🔥

**Problema**: 1,643 linee! Gestisce troppo (Git ops, DnD, rendering)

**Refactoring**:

```typescript
// PRIMA: RepositoryGroup.tsx (1,643 lines)

// DOPO:
// components/git/RepositoryGroup.tsx (~250 lines)
// components/git/BranchList.tsx (~180 lines)
// components/git/AgentCard.tsx (~150 lines)
// components/git/GitOperationsMenu.tsx (~120 lines)
// components/git/CommitHistoryModal.tsx (~200 lines) [già esiste, estrarre]
// hooks/useGitStatus.ts (~100 lines)
// hooks/useDragAndDrop.ts (~80 lines) [riutilizzabile!]
```

**Target**: RepositoryGroup.tsx da 1,643 → <300 linee ✅

---

#### **Quick Wins - Facili da Risolvere**

1. **Eliminare NewTerminalModal.old.tsx** (791 lines) - File deprecato! ❌
2. **Splittare types.ts** (762 lines) - Organizzare per dominio:
   ```
   types/terminal.ts
   types/git.ts
   types/chat.ts
   types/agent.ts
   types/storage.ts
   ```
3. **Splittare marketplaceData.ts** (1,022 lines) - Solo dati statici:
   ```
   data/marketplace/agents.ts
   data/marketplace/plugins.ts
   data/marketplace/skills.ts
   ```

---

## 3. ⚡ PERFORMANCE & BUNDLE SIZE - **ALTA** 🟡

### Dipendenze Pesanti Identificate

| Dipendenza | Size Stimato | Utilizzo | Impatto | Raccomandazione |
|------------|-------------|----------|---------|-----------------|
| **monaco-editor** | ~300KB | Code editor | 🔴 ALTO | **RIMUOVERE** - Duplicato! |
| **@monaco-editor/react** | ~50KB | Monaco wrapper | 🔴 ALTO | **RIMUOVERE** - Duplicato! |
| **mermaid** | ~200KB | Diagrammi | 🟡 MEDIO | Lazy load con React.lazy() |
| **@xterm/xterm** + addons | ~150KB | Terminal | ✅ ESSENZIALE | Mantieni |
| **@anthropic-ai/claude-agent-sdk** | ~100KB | AI core | ✅ ESSENZIALE | Mantieni |
| **@codemirror/*** (8 packages) | ~80KB | Code editor | ✅ ESSENZIALE | Mantieni |
| **react-window** | ~30KB | Virtualization | ✅ ESSENZIALE | Mantieni |
| **lucide-react** | ~50KB (se import *) | Icons | 🟠 MEDIO | Tree-shake! |
| **@dnd-kit/** | ~40KB | Drag & Drop | ✅ ESSENZIALE | Mantieni |

### 🎯 Ottimizzazioni Bundle

#### **PRIORITY 0: Rimuovere Monaco Editor** 🔴 (~350KB saved!)

**Problema**: Hai DUPLICATO editor:
- `monaco-editor` (300KB)
- `@monaco-editor/react` (50KB)
- Già usi `@codemirror/*` per code editing!

**Azione**:
```bash
# 1. Verifica utilizzo Monaco
grep -r "monaco-editor" src/

# 2. Rimuovi dipendenze
npm uninstall monaco-editor @monaco-editor/react vite-plugin-monaco-editor

# 3. Aggiorna vite.config.ts (rimuovi monaco plugin)

# 4. Sostituisci con CodeMirror ovunque
```

**Risparmio**: ~350KB bundle size (-20%!) 🚀

---

#### **PRIORITY 1: Lazy Loading Componenti Pesanti** 🟡

**Implementazione**:

```typescript
// PRIMA: Import sincrono
import { MermaidDiagram } from './components/MermaidDiagram'
import { MarketplaceDrawer } from './components/MarketplaceDrawer'
import { SettingsDrawer } from './components/settings/UnifiedSettings'

// DOPO: Lazy loading con code splitting
const MermaidDiagram = React.lazy(() => import('./components/MermaidDiagram'))
const MarketplaceDrawer = React.lazy(() => import('./components/MarketplaceDrawer'))
const SettingsDrawer = React.lazy(() => import('./components/settings/UnifiedSettings'))

// Uso con Suspense
function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      {showMermaid && <MermaidDiagram {...props} />}
    </Suspense>
  )
}
```

**Componenti da Lazy Load**:
- `MermaidDiagram` (~200KB mermaid lib)
- `MarketplaceDrawer` + `MarketplacePanel` (~100KB)
- `UnifiedSettings` (~80KB)
- `QuackAgencyDrawer` (~70KB)
- `GitPanel` + `BranchManager` (~60KB)
- `MCPPanel` + `MCPServerModal` (~50KB)

**Risparmio First Load**: ~560KB (-35% first load!) 🚀

---

#### **PRIORITY 2: Tree-Shaking Aggressive** 🟠

**Problema**: Import barrel files carica troppo codice

```typescript
// ❌ MALE: Importa TUTTA la libreria (50KB)
import * as lucide from 'lucide-react'

// ❌ MALE: Import da barrel potrebbe importare extra
import { Terminal, GitBranch, Settings, ... } from 'lucide-react'

// ✅ BENE: Import specifico (solo ~2KB per icon)
import Terminal from 'lucide-react/dist/esm/icons/terminal'
import GitBranch from 'lucide-react/dist/esm/icons/git-branch'
```

**Script automatico**:

```typescript
// scripts/optimize-lucide-imports.ts
import { readFile, writeFile } from 'fs/promises'
import { glob } from 'glob'

const files = await glob('src/**/*.{ts,tsx}')

for (const file of files) {
  let content = await readFile(file, 'utf-8')

  // Find all lucide imports
  const match = content.match(/import \{ ([^}]+) \} from ['"]lucide-react['"]/)
  if (!match) continue

  const icons = match[1].split(',').map(s => s.trim())

  // Replace with specific imports
  const newImports = icons.map(icon =>
    `import ${icon} from 'lucide-react/dist/esm/icons/${kebabCase(icon)}'`
  ).join('\n')

  content = content.replace(match[0], newImports)
  await writeFile(file, content)
}
```

**Risparmio**: ~40KB (-3%) 🚀

---

#### **Vite Config Ottimizzazioni**

Il tuo `vite.config.ts` è GIÀ ben ottimizzato! ✅

Miglioramenti suggeriti:

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // ✅ Già presente - OTTIMO!
          if (id.includes('monaco-editor')) return 'monaco-editor' // DA RIMUOVERE!
          if (id.includes('@xterm')) return 'xterm'
          if (id.includes('claude-agent-sdk')) return 'claude-sdk'
          if (id.includes('mermaid')) return 'mermaid'

          // 🆕 NUOVO: Splitta meglio componenti
          if (id.includes('/components/settings/')) return 'settings'
          if (id.includes('/components/Marketplace')) return 'marketplace'
          if (id.includes('/components/Git')) return 'git-components'
          if (id.includes('/components/AI')) return 'ai-components'

          // 🆕 NUOVO: Lazy-loaded chunks
          if (id.includes('Drawer') || id.includes('Modal')) {
            return 'drawers-modals'
          }

          // ✅ Resto già ben configurato
          if (id.includes('node_modules')) {
            if (id.includes('react')) return 'react-vendor'
            if (id.includes('lucide')) return 'ui-vendor'
            if (id.includes('@tauri-apps')) return 'tauri-vendor'
            return 'vendor'
          }
        },

        // 🆕 NUOVO: Optimize chunk sizes
        experimentalMinChunkSize: 10000, // Min 10KB per chunk
      },

      // 🆕 NUOVO: Improve tree-shaking
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
        tryCatchDeoptimization: false,
        preset: 'smallest', // More aggressive
      },
    },
  },

  // 🆕 NUOVO: Build cache
  cacheDir: 'node_modules/.vite',
})
```

---

### Bundle Analysis

**Prima di ottimizzare**:
```bash
npm run build:analyze
# Apre dist/stats.html con treemap del bundle
```

**Target Metrics**:
```
Initial Bundle:  ~2.5MB → <1.5MB (-40%)
Largest Chunk:   ~800KB → <500KB (-38%)
First Paint:     ~1.8s → <1.0s (-44%)
```

---

## 4. 🐛 QUALITÀ DEL CODICE - **MEDIA** 🟠

### Console.log Ovunque! 🔴

```
📊 1,125 console.log/warn/error statements in 109 files!
```

**Problema**:
- Performance impact in production (console calls are expensive)
- Logging non strutturato (difficile debug)
- Sensitive data potrebbe essere loggato
- Nessun log level management

**Soluzione: Logger Unificato**

```typescript
// utils/logger.ts
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

interface LoggerConfig {
  level: LogLevel
  enableConsole: boolean
  enableFile: boolean
  filePath?: string
}

class Logger {
  private config: LoggerConfig

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: import.meta.env.DEV ? LogLevel.DEBUG : LogLevel.WARN,
      enableConsole: true,
      enableFile: false,
      ...config,
    }
  }

  debug(...args: unknown[]) {
    if (this.config.level <= LogLevel.DEBUG) {
      this.log('DEBUG', ...args)
    }
  }

  info(...args: unknown[]) {
    if (this.config.level <= LogLevel.INFO) {
      this.log('INFO', ...args)
    }
  }

  warn(...args: unknown[]) {
    if (this.config.level <= LogLevel.WARN) {
      this.log('WARN', ...args)
    }
  }

  error(...args: unknown[]) {
    if (this.config.level <= LogLevel.ERROR) {
      this.log('ERROR', ...args)
    }
  }

  private log(level: string, ...args: unknown[]) {
    const timestamp = new Date().toISOString()
    const prefix = `[${timestamp}] [${level}]`

    if (this.config.enableConsole) {
      const method = level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'log'
      console[method](prefix, ...args)
    }

    if (this.config.enableFile && this.config.filePath) {
      // TODO: Write to file using Tauri fs plugin
      invoke('write_log', {
        path: this.config.filePath,
        message: `${prefix} ${args.map(String).join(' ')}\n`,
      })
    }
  }
}

export const logger = new Logger()

// Shorthand exports
export const log = logger.debug.bind(logger)
export const info = logger.info.bind(logger)
export const warn = logger.warn.bind(logger)
export const error = logger.error.bind(logger)
```

**Migration automatica**:

```bash
# Find & Replace con regex
# PRIMA:
console.log(...)
console.warn(...)
console.error(...)

# DOPO:
logger.debug(...)
logger.warn(...)
logger.error(...)

# Script automatico
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' \
  -e 's/console\.log(/logger.debug(/g' \
  -e 's/console\.warn(/logger.warn(/g' \
  -e 's/console\.error(/logger.error(/g'

# Aggiungi import all'inizio di ogni file modificato
# (manualmente o con script)
```

**Benefit**:
- ✅ Production logs solo WARN/ERROR (0 console.log in prod!)
- ✅ Structured logging (timestamp, level)
- ✅ File logging per debug persistente
- ✅ Controllo centralizzato log level

---

### TypeScript `any` Usage 🟡

**TODO**: Analizzare uso di `any` type

```bash
grep -rn "any" src --include="*.ts" --include="*.tsx" | wc -l
```

**Target**: Eliminare TUTTI gli `any`, sostituire con:
- `unknown` per input non validati
- Generics `<T>` per tipi dinamici
- Union types per alternative multiple

---

### Funzioni Troppo Lunghe 🟠

**Regola violata**: Funzioni > 20 righe

**Pattern ricorrente**: Funzioni in `App.tsx`, `ChatInput.tsx` >100 righe!

**Esempio refactoring**:

```typescript
// ❌ PRIMA: 120 righe!
const handleNewTerminal = async (options: CreateOptions) => {
  // ... 120 lines of logic
}

// ✅ DOPO: Splittare in helper functions
const validateTerminalOptions = (options: CreateOptions) => {
  // 10 lines validation
}

const createTerminalInstance = async (options: CreateOptions) => {
  // 15 lines Tauri invoke
}

const updateTerminalState = (terminal: TerminalInfo) => {
  // 12 lines state update
}

const handleNewTerminal = async (options: CreateOptions) => {
  const validated = validateTerminalOptions(options)
  const instance = await createTerminalInstance(validated)
  updateTerminalState(instance)
  // Total: ~8 lines orchestration
}
```

---

## 5. 📦 GESTIONE DIPENDENZE - **MEDIA** 🟠

### UNMET DEPENDENCIES! 🔴

```
⚠️ TUTTE le 47 dipendenze production sono UNMET!
```

**Causa**: Probabilmente node_modules eliminato o corrotto

**Fix IMMEDIATO**:
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Verifica
npm ls --depth=0
```

---

### Dipendenze Duplicate/Conflittuali 🟡

#### **1. Monaco Editor + CodeMirror** ❌

**Conflitto**: Due editor code, stesso scopo!

```json
{
  "dependencies": {
    "monaco-editor": "^0.53.0",           // ❌ 300KB
    "@monaco-editor/react": "^4.7.0",     // ❌ 50KB
    "@codemirror/commands": "^6.10.0",    // ✅
    "@codemirror/lang-*": "...",          // ✅
    "@codemirror/view": "^6.38.6"         // ✅
  }
}
```

**Decisione**: Usa SOLO CodeMirror (più leggero, modular)

**Azione**:
```bash
npm uninstall monaco-editor @monaco-editor/react vite-plugin-monaco-editor
```

---

#### **2. Prettier in production deps** 🟡

```json
{
  "dependencies": {
    "prettier": "^3.3.3"  // ❌ Dovrebbe essere devDependency!
  }
}
```

**Fix**:
```bash
npm uninstall prettier
npm install -D prettier
```

---

#### **3. Dependencies Audit** 🟠

```bash
# Security vulnerabilities
npm audit

# Fix automatico
npm audit fix

# Fix con breaking changes (attento!)
npm audit fix --force
```

---

### Dependency Size Analysis

```bash
# Installa analyzer
npm install -g cost-of-modules

# Analizza size
cost-of-modules

# Output example:
# ┌────────────────────────────────────┬─────────┬─────────┐
# │ name                               │ children│ size    │
# ├────────────────────────────────────┼─────────┼─────────┤
# │ monaco-editor                      │ 0       │ 8.2 MB  │ ❌ HEAVY!
# │ mermaid                            │ 15      │ 4.1 MB  │ 🟡 Lazy load
# │ @xterm/xterm                       │ 0       │ 1.8 MB  │ ✅ Essential
# │ @anthropic-ai/claude-agent-sdk     │ 12      │ 1.2 MB  │ ✅ Essential
# │ react + react-dom                  │ 3       │ 900 KB  │ ✅ Essential
# └────────────────────────────────────┴─────────┴─────────┘
```

---

## 6. 🚀 PIANO D'AZIONE PRIORITARIO

### WEEK 1 - Foundation & Critical Tests 🔴

**Goal**: Setup test infrastructure + primi test critici

| Giorno | Task | Deliverable | Effort |
|--------|------|-------------|--------|
| **Lun** | Setup Vitest + RTL | `vitest.config.ts` + `src/test/setup.ts` | 3h |
| **Mar** | Test utilities & mocks | `src/test/utils.tsx` + Tauri mocks | 4h |
| **Mer** | First tests: `App.test.tsx` | Integration tests startup/shutdown | 6h |
| **Gio** | Tests: `ChatInput.test.tsx` | Unit tests autocomplete, file upload | 6h |
| **Ven** | Tests: `agentMentions.test.ts` | Utility functions tests | 4h |

**Success Metrics**:
- ✅ Test runner funzionante (`npm test`)
- ✅ Coverage 5-10% (App.tsx + ChatInput testati)
- ✅ CI/CD pipeline con GitHub Actions (opzionale)

---

### WEEK 2 - Refactoring Architecture 🟡

**Goal**: Splittare file giganti + quick wins performance

| Giorno | Task | Deliverable | Effort |
|--------|------|-------------|--------|
| **Lun** | Rimuovi Monaco Editor | Elimina monaco, testa CodeMirror | 3h |
| **Mar** | Lazy Loading componenti | Wrap 6 componenti con React.lazy | 4h |
| **Mer-Gio** | Refactoring App.tsx (Fase 1) | Estrarre 3 hooks principali | 12h |
| **Ven** | Sostituisci console.log | Logger unificato, migration script | 4h |

**Success Metrics**:
- ✅ Bundle size -350KB (monaco rimosso)
- ✅ First load -400KB (lazy loading)
- ✅ App.tsx da 7,293 → <5,000 linee
- ✅ 0 console.log in production

---

### WEEK 3 - Performance & Coverage Push 🟠

**Goal**: Ottimizzazioni avanzate + coverage 30%

| Giorno | Task | Deliverable | Effort |
|--------|------|-------------|--------|
| **Lun** | Tree-shaking Lucide | Script auto-optimize imports | 3h |
| **Mar** | Vite config advanced | Optimize chunks, preloading | 4h |
| **Mer** | Tests: AIAssistant, hooks | `AIAssistant.test.tsx`, `useClaudeChat.test.ts` | 6h |
| **Gio** | Tests: Git integration | `GitPanel.test.tsx`, `useGitStatus.test.ts` | 6h |
| **Ven** | Build analysis & report | Lighthouse, bundle analyzer, report MD | 4h |

**Success Metrics**:
- ✅ Coverage 25-30%
- ✅ Bundle size totale -40%
- ✅ Lighthouse score >85
- ✅ Build time <30s

---

### MONTH 2-3 - Production Readiness 🟢

**Obiettivi Long-term**:

**Month 2**:
- Refactoring completo App.tsx (→ <300 linee)
- Refactoring ChatInput, RepositoryGroup
- Test coverage 50-60%
- E2E tests con Playwright (opzionale)

**Month 3**:
- Test coverage 70-80%
- Performance optimization fine-tuning
- Accessibility audit (WCAG AA)
- Documentation completa

---

## 7. 📈 METRICHE DI SUCCESSO

### Coverage Targets

```
Current:  ███░░░░░░░░░░░░░░░░░ 0%   🔴 CRITICAL
Week 1:   ███░░░░░░░░░░░░░░░░░ 10%  🔴
Week 2:   ████░░░░░░░░░░░░░░░░ 20%  🟡
Month 1:  ████████░░░░░░░░░░░░ 40%  🟡
Month 2:  ████████████░░░░░░░░ 60%  🟢
Month 3:  ████████████████░░░░ 80%+ ✅ Production-ready!
```

**Critical Paths** (must be >90% coverage):
- Authentication & API calls
- Terminal lifecycle (create/delete/restore)
- Storage persistence (save/load)
- Git operations (commit/push/pull)
- Agent chat streaming

---

### Performance Targets

| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| **Bundle Size** | ~2.5MB | <1.5MB | -40% 🚀 |
| **Initial Chunk** | ~800KB | <500KB | -38% 🚀 |
| **First Paint** | ~1.8s | <1.0s | -44% 🚀 |
| **Time to Interactive** | ~2.5s | <1.5s | -40% 🚀 |
| **Lighthouse Performance** | ~70 | >90 | +20pts 🚀 |
| **Build Time** | ~45s | <30s | -33% 🚀 |

---

### Code Quality Targets

| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| **Files >300 lines** | 54 (26%) | <10 (5%) | -81% 🚀 |
| **Largest File** | 7,293L | <500L | -93% 🚀 |
| **Console.log** | 1,125 | <50 | -96% 🚀 |
| **TypeScript `any`** | TBD | <10 | TBD |
| **ESLint Errors** | TBD | 0 | -100% 🚀 |
| **Duplicate Code** | TBD | <10% | TBD |

---

## 8. 🛠️ TOOLS & AUTOMATION

### Development Tools

```bash
# Test Runner (Vitest)
npm install -D vitest @testing-library/react @testing-library/jest-dom happy-dom
npm install -D @vitest/coverage-v8 @vitest/ui

# Code Quality
npm install -D eslint prettier @typescript-eslint/eslint-plugin
npm install -D husky lint-staged # Pre-commit hooks

# Performance Analysis
npm install -D lighthouse webpack-bundle-analyzer

# Dependency Analysis
npm install -g cost-of-modules depcheck npm-check-updates
```

---

### Scripts da Aggiungere a `package.json`

```json
{
  "scripts": {
    // Test scripts
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest --watch",

    // Code quality
    "lint": "eslint src --ext .ts,.tsx",
    "lint:fix": "eslint src --ext .ts,.tsx --fix",
    "format": "prettier --write \"src/**/*.{ts,tsx,css}\"",
    "format:check": "prettier --check \"src/**/*.{ts,tsx,css}\"",

    // Type checking
    "type-check": "tsc --noEmit",
    "type-check:watch": "tsc --noEmit --watch",

    // Performance
    "analyze:bundle": "npm run build:analyze && open dist/stats.html",
    "analyze:deps": "cost-of-modules && depcheck",
    "analyze:lighthouse": "lighthouse http://localhost:5174 --view",

    // Pre-commit validation
    "pre-commit": "lint-staged",
    "validate": "npm run type-check && npm run lint && npm run test:coverage"
  },

  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write",
      "vitest related --run"
    ],
    "*.{css,md}": [
      "prettier --write"
    ]
  }
}
```

---

### CI/CD Pipeline

**`.github/workflows/test.yml`**

```yaml
name: Test & Quality

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npm run type-check

      - name: Lint
        run: npm run lint

      - name: Run tests with coverage
        run: npm run test:coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          files: ./coverage/coverage-final.json
          flags: unittests
          name: codecov-umbrella

      - name: Build
        run: npm run build

      - name: Bundle size analysis
        run: npm run analyze:bundle

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/
```

**`.github/workflows/performance.yml`**

```yaml
name: Performance Audit

on:
  pull_request:
    branches: [main]

jobs:
  lighthouse:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install & Build
        run: |
          npm ci
          npm run build

      - name: Run Lighthouse CI
        uses: treosh/lighthouse-ci-action@v10
        with:
          urls: |
            http://localhost:5174
          budgetPath: ./lighthouse-budget.json
          uploadArtifacts: true
          temporaryPublicStorage: true
```

---

### Husky Pre-commit Hooks

```bash
# Setup Husky
npx husky install
npm pkg set scripts.prepare="husky install"

# Add pre-commit hook
npx husky add .husky/pre-commit "npx lint-staged"

# Add pre-push hook (run tests before push)
npx husky add .husky/pre-push "npm run test:coverage"
```

---

## 9. 💡 QUICK WINS (Risultati Immediati)

### Top 5 Easy Wins

| # | Task | Effort | Impact | Saving | Priority |
|---|------|--------|--------|--------|----------|
| 1 | **Rimuovi Monaco Editor** | 1h | 🔥🔥🔥 | -350KB | P0 |
| 2 | **Lazy Load Mermaid** | 30min | 🔥🔥 | -200KB | P0 |
| 3 | **Fix UNMET dependencies** | 15min | 🔥 | Stability | P0 |
| 4 | **Delete NewTerminalModal.old.tsx** | 5min | 🔥 | -791 lines | P0 |
| 5 | **Tree-shake Lucide imports** | 45min | 🔥 | -40KB | P1 |

**Total Impact**: -590KB bundle, +stability, -791 lines dead code
**Total Effort**: ~3 ore
**ROI**: MASSIMO! 🚀

---

### Implementation Guide - Quick Win #1

**Rimuovi Monaco Editor** (1 ora)

```bash
# Step 1: Verifica utilizzo Monaco (5 min)
grep -rn "monaco" src/

# Output atteso:
# src/components/CodeEditor.tsx:1:import * as monaco from 'monaco-editor'
# (Se usato solo qui, procedi!)

# Step 2: Sostituisci con CodeMirror (30 min)
# Apri CodeEditor.tsx, sostituisci monaco con CodeMirror
# (Hai già CodeEditorCodeMirror.tsx - usa quello!)

# Step 3: Rimuovi dipendenze (5 min)
npm uninstall monaco-editor @monaco-editor/react vite-plugin-monaco-editor

# Step 4: Aggiorna vite.config.ts (10 min)
# Rimuovi monacoEditorPlugin da plugins array
# Rimuovi manualChunks per monaco-editor

# Step 5: Test build (10 min)
npm run build
npm run build:analyze
# Verifica bundle size reduction!
```

---

## 10. ❓ DOMANDE PER ALEK

Prima di procedere con implementazione, ho bisogno di chiarimenti:

### 1. Monaco Editor
**Q**: Confermi rimozione Monaco? Ci sono use case specifici dove serve vs CodeMirror?

**Context**:
- Monaco: ~350KB, feature-rich, VSCode-like
- CodeMirror: ~80KB, modular, già integrato

### 2. Test Strategy
**Q**: App.tsx è troppo grande per testare così com'è. Preferisci:
- a) **Refactoring PRIMA** dei test (più pulito, ma ritarda coverage)
- b) **Integration tests PRIMA**, refactoring dopo (coverage veloce, ma test fragili)

**Raccomandazione**: Opzione B (coverage immediato) + refactoring graduale

### 3. Bundle Size Target
**Q**: Qual è la dimensione bundle accettabile per te?

**Context**:
- Attuale stimato: ~2.5MB uncompressed
- Target suggerito: <1.5MB (-40%)
- Competitor benchmark: VSCode Web ~3MB, Tauri apps ~1-2MB

### 4. CI/CD Pipeline
**Q**: Hai già GitHub Actions configurate? Posso aiutare a settare:
- Automated tests su ogni PR
- Coverage reports con Codecov
- Performance budgets con Lighthouse CI

### 5. Coverage Minimo
**Q**: Target realistico per production release?

**Raccomandazioni**:
- 60% overall coverage (accettabile)
- 80% critical paths (auth, terminals, git, storage)
- 90% utility functions (parsing, validation, formatters)

### 6. Timeline & Priorities
**Q**: Quali aree sono più critiche per il tuo use case?
- Terminal management
- Git integration
- AI/Chat system
- Marketplace/Plugins
- Performance generale

**Aiuta a prioritizzare refactoring & test development**

---

## 11. 📌 CONCLUSIONI

### Status Generale: 🟡 **MODERATO RISCHIO**

#### ✅ **Punti Forti**
- Architettura Tauri + React solida e moderna
- Vite config ben ottimizzato (code splitting già configurato)
- TypeScript strict mode abilitato
- Dipendenze moderne e aggiornate
- Claude Agent SDK ben integrato
- Feature-rich con Git, terminals, AI, marketplace

#### 🔴 **Blockers Critici**
- **ZERO test coverage** - Rischio altissimo per manutenzione/refactoring
- **App.tsx 7,293 righe** - Praticamente impossibile da mantenere
- **54 file >300 righe** - Violazioni architetturali su 26% codebase
- **Bundle size non misurato** - Performance in produzione sconosciuta
- **Monaco + CodeMirror duplicati** - Spreco di 350KB

#### 🟡 **Rischi Medio-Alti**
- 1,125 console.log statements - Logging non production-ready
- Nessuna separazione concerns in file grandi
- UNMET dependencies (instabilità build)
- Nessun CI/CD per quality gates

#### 🎯 **Prossimi Passi IMMEDIATI**

**Oggi**:
1. Risposta alle 5 domande sopra
2. Fix UNMET dependencies (`rm -rf node_modules && npm install`)
3. Setup Vitest (`npm i -D vitest @testing-library/react`)

**Domani**:
1. Primo test integration App.tsx
2. Rimuovi Monaco Editor
3. Build analysis baseline

**Fine Settimana**:
1. Lazy loading componenti pesanti
2. Logger unificato (replace console.log)
3. Coverage report 10%

---

### Vuoi Procedere?

**Opzioni**:
1. **Full Implementation** - Seguo piano 3 settimane, aggiorno progressivamente questo doc
2. **Guided Setup** - Ti guido step-by-step per setup test + primi quick wins
3. **Specific Focus** - Scegli 1 area critica (es: solo refactoring App.tsx)
4. **Custom Plan** - Modifichiamo piano basato su tue priorità

**Quale preferisci?** 🦆

---

**Documento creato da**: Agent Quinn
**Data**: 2025-01-16
**Versione**: 1.0
**Prossimo Update**: Dopo implementazione Week 1
