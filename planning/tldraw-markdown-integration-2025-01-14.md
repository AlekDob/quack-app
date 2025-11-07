# Piano: Integrazione tldraw + Markdown Notes System

**Data:** 2025-01-14
**Progetto:** Quack App
**Obiettivo:** Integrare tldraw e Markdown editor nel sistema di tab per note-taking stile Obsidian

---

## 🎯 Obiettivo

Integrare tldraw e un editor Markdown nel sistema di tab esistente, permettendo di:
- ✅ Aprire file `.md` in un editor Markdown (con preview)
- ✅ Creare e modificare diagrammi tldraw (file `.tldr`)
- ✅ Salvare automaticamente i contenuti nel filesystem del progetto
- ✅ Workflow simile a Obsidian per note-taking durante il coding

---

## 🏗️ Architettura

### 1. Nuovi Tab Types

Estendere il sistema di tab per supportare:
- `'markdown'` - Editor Markdown con live preview
- `'tldraw'` - Canvas tldraw per diagrammi/whiteboarding

### 2. File Type Detection

Modificare `FileExplorer.tsx` per riconoscere:
- File `.md` → apre tab markdown
- File `.tldr` → apre tab tldraw
- Altri file → comportamento esistente (Monaco Editor)

### 3. Nuovi Componenti

#### MarkdownTab.tsx
- Editor Markdown con syntax highlighting
- Split view: editor + preview live
- Supporto per frontmatter YAML
- Auto-save ogni 2 secondi (debounced)
- Integrazione con File Explorer per link interni

#### TldrawTab.tsx
- Canvas tldraw v2 completo
- Toolbar nativa di tldraw
- Auto-save dello stato JSON in `.tldr` file
- Export PNG/SVG on-demand
- Supporto per annotations e shapes

### 4. Storage & Persistence

- File `.md` salvati come plain text nel filesystem
- File `.tldr` salvati come JSON (tldraw store format)
- Auto-save debounced per evitare troppi write
- Preview dei file `.md` e `.tldr` nel File Explorer

---

## 📋 Fasi di Implementazione

### Fase 1: Setup Dipendenze ⏱️ 5 min

**Tasks:**
```bash
npm install tldraw@latest
npm install react-markdown remark-gfm rehype-highlight
npm install @types/react-markdown --save-dev
```

**Deliverables:**
- ✅ Dipendenze installate
- ✅ Types configurati

---

### Fase 2: Estendere Sistema Tab ⏱️ 10 min

**File da modificare:**
- `src/types.ts` → Aggiungere `'markdown' | 'tldraw'` ai tab types
- `src/components/TabBar.tsx` → Icone specifiche (📝 markdown, 🎨 tldraw)
- `src/App.tsx` → Routing verso i nuovi tab components

**Deliverables:**
- ✅ Tab interface estesa
- ✅ Icone personalizzate per tab type
- ✅ Routing preparato

**Dettagli tecnici:**
```typescript
// types.ts
export interface Tab {
  id: string;
  label: string;
  type: 'chat' | 'file' | 'agent-terminal' | 'agent' | 'browser' | 'markdown' | 'tldraw';
  closable: boolean;
  filePath?: string;
  // ... existing fields
}
```

---

### Fase 3: File Type Detection ⏱️ 10 min

**File da modificare:**
- `src/components/FileExplorer.tsx` → Detectare `.md` e `.tldr` in `onOpenFile`
- `src/components/FileIcon.tsx` → Icone specifiche per markdown/tldraw files

**Deliverables:**
- ✅ Click su `.md` → apre `MarkdownTab`
- ✅ Click su `.tldr` → apre `TldrawTab`
- ✅ Icone nel File Explorer

**Logica detection:**
```typescript
const handleOpenFile = (entry: DirectoryEntry) => {
  const extension = entry.name.split('.').pop()?.toLowerCase();

  if (extension === 'md') {
    // Open MarkdownTab
  } else if (extension === 'tldr') {
    // Open TldrawTab
  } else {
    // Existing logic (Monaco Editor)
  }
};
```

---

### Fase 4: Markdown Tab Component ⏱️ 30 min

**Nuovo file:** `src/components/MarkdownTab.tsx`

**Features:**
- Split view: Editor (left) + Preview (right)
- Syntax highlighting con Monaco Editor (già disponibile!)
- Preview con `react-markdown` + `remark-gfm` (GitHub Flavored Markdown)
- Auto-save debounced (2 secondi)
- Toolbar: Bold, Italic, Code, Link, Image, Headers
- Integrazione Tauri FS (`read_file_content`, `write_file`)

**Deliverables:**
- ✅ Editor Markdown funzionante
- ✅ Live preview
- ✅ Auto-save
- ✅ Toolbar con shortcuts

**Component structure:**
```typescript
interface MarkdownTabProps {
  filePath: string;
  initialContent?: string;
  onClose: () => void;
}

export function MarkdownTab({ filePath, initialContent, onClose }: MarkdownTabProps) {
  const [content, setContent] = useState(initialContent || '');
  const [isSaving, setIsSaving] = useState(false);

  // Auto-save debounced
  const debouncedSave = useMemo(
    () => debounce(async (text: string) => {
      setIsSaving(true);
      await invoke('write_file', { path: filePath, content: text });
      setIsSaving(false);
    }, 2000),
    [filePath]
  );

  // Editor + Preview split view
  return (
    <div className="markdown-tab">
      <MarkdownToolbar onAction={handleToolbarAction} />
      <div className="markdown-split">
        <MonacoEditor
          value={content}
          onChange={(value) => {
            setContent(value);
            debouncedSave(value);
          }}
          language="markdown"
        />
        <MarkdownPreview content={content} />
      </div>
    </div>
  );
}
```

---

### Fase 5: Tldraw Tab Component ⏱️ 30 min

**Nuovo file:** `src/components/TldrawTab.tsx`

**Features:**
- Canvas tldraw v2 completo con toolbar nativa
- Persistenza dello store in formato JSON (`.tldr` file)
- Auto-save debounced (2 secondi)
- Export controls: PNG, SVG, JSON
- Zoom controls e minimap
- Dark mode support (allineato con tema Quack)

**Deliverables:**
- ✅ Canvas tldraw funzionante
- ✅ Salvataggio/caricamento `.tldr` files
- ✅ Export PNG/SVG
- ✅ Auto-save

**Component structure:**
```typescript
import { Tldraw, createTLStore, defaultShapeUtils } from 'tldraw';
import 'tldraw/tldraw.css';

interface TldrawTabProps {
  filePath: string;
  initialData?: string;
  onClose: () => void;
}

export function TldrawTab({ filePath, initialData, onClose }: TldrawTabProps) {
  const [store] = useState(() => {
    const newStore = createTLStore({ shapeUtils: defaultShapeUtils });
    if (initialData) {
      newStore.loadSnapshot(JSON.parse(initialData));
    }
    return newStore;
  });

  // Auto-save debounced
  const debouncedSave = useMemo(
    () => debounce(async () => {
      const snapshot = store.getSnapshot();
      const json = JSON.stringify(snapshot);
      await invoke('write_file', { path: filePath, content: json });
    }, 2000),
    [filePath, store]
  );

  useEffect(() => {
    const unsubscribe = store.listen(() => {
      debouncedSave();
    });
    return unsubscribe;
  }, [store, debouncedSave]);

  return (
    <div className="tldraw-tab">
      <TldrawToolbar onExport={handleExport} />
      <Tldraw store={store} />
    </div>
  );
}
```

---

### Fase 6: File Actions ⏱️ 15 min

**File da modificare:**
- `src/components/FileExplorer.tsx` → Context menu actions
- `src/App.tsx` → Handlers per creare nuovi file

**Nuove Actions:**
- **"New Markdown Note"** → Crea `untitled-note.md` nel CWD
- **"New Tldraw Diagram"** → Crea `untitled-diagram.tldr` nel CWD
- Context menu: "Open as Markdown", "Open as Tldraw" (per file senza estensione)

**Deliverables:**
- ✅ Action buttons nel toolbar
- ✅ Context menu nel File Explorer
- ✅ Template files per nuove note

**Implementation:**
```typescript
const handleNewMarkdownNote = async () => {
  const fileName = `untitled-note-${Date.now()}.md`;
  const filePath = `${currentCwd}/${fileName}`;
  await invoke('write_file', {
    path: filePath,
    content: '# New Note\n\nStart typing...'
  });
  openTab({ type: 'markdown', filePath, label: fileName });
};

const handleNewTldrawDiagram = async () => {
  const fileName = `untitled-diagram-${Date.now()}.tldr`;
  const filePath = `${currentCwd}/${fileName}`;
  const emptyStore = createTLStore({ shapeUtils: defaultShapeUtils });
  const snapshot = emptyStore.getSnapshot();
  await invoke('write_file', {
    path: filePath,
    content: JSON.stringify(snapshot)
  });
  openTab({ type: 'tldraw', filePath, label: fileName });
};
```

---

### Fase 7: Testing & Polish ⏱️ 20 min

**Testing checklist:**
- ✅ Apertura file `.md` dal File Explorer
- ✅ Apertura file `.tldr` dal File Explorer
- ✅ Auto-save funzionante (debounced)
- ✅ Switching tra tab senza perdere contenuto
- ✅ Export PNG/SVG da tldraw
- ✅ Preview Markdown con sintassi GFM
- ✅ Styling coerente con Quack theme

**Deliverables:**
- ✅ Sistema testato end-to-end
- ✅ Bug fix eventuali
- ✅ Styling polish

**Test scenarios:**
1. Create new markdown note → write content → close tab → reopen → verify content persisted
2. Create new tldraw diagram → draw shapes → close tab → reopen → verify diagram persisted
3. Open existing `.md` file → edit → verify auto-save working
4. Open existing `.tldr` file → modify → verify auto-save working
5. Export diagram as PNG/SVG → verify file created
6. Markdown preview → verify GFM syntax (tables, code blocks, etc.)
7. Dark mode → verify both components styled correctly

---

## 🛠️ Tecnologie

| Tool | Versione | Uso |
|------|----------|-----|
| **tldraw** | `^2.x` (latest) | Canvas per diagrammi/whiteboarding |
| **react-markdown** | `^9.x` | Markdown preview |
| **remark-gfm** | `^4.x` | GitHub Flavored Markdown (tables, strikethrough, etc.) |
| **rehype-highlight** | `^7.x` | Code syntax highlighting nel preview |
| **Tauri FS** | Built-in | Read/write file operations |

---

## 📦 Deliverables Finali

1. ✅ Sistema di tab esteso con supporto `markdown` e `tldraw`
2. ✅ Editor Markdown con live preview e toolbar
3. ✅ Canvas tldraw per diagrammi con export PNG/SVG
4. ✅ Auto-save per entrambi i tipi (debounced 2s)
5. ✅ Integrazione completa con File Explorer
6. ✅ Actions per creare nuove note/diagrammi
7. ✅ Context menu per file operations
8. ✅ Icone specifiche per markdown/tldraw files

---

## 💡 Note Implementative

### Salvataggio Files
- I file saranno salvati nella **directory corrente del terminal attivo** (CWD)
- Auto-save debounced ogni **2 secondi** per evitare troppi write operations
- Formato `.tldr`: JSON serializzato dello store tldraw

### Future Enhancements (Opzionali)
- 📁 Organizzare note in `.quack/notes/` per progetto
- 🖼️ Preview thumbnails per `.tldr` files nel File Explorer
- 🔗 Link interni tra note Markdown (stile Obsidian `[[note]]`)
- 🏷️ Tagging system per note
- 🔍 Full-text search nelle note
- 📊 Graph view delle note collegate

---

## 🦆 Workflow Utente

### Scenario 1: Creare una nota Markdown
1. Click "New Markdown Note" nel toolbar
2. Si apre un nuovo tab `untitled-note.md` con editor vuoto
3. Scrivi la nota → auto-save ogni 2s
4. Chiudi tab → file salvato in CWD

### Scenario 2: Creare un diagramma tldraw
1. Click "New Tldraw Diagram" nel toolbar
2. Si apre un nuovo tab `untitled-diagram.tldr` con canvas vuoto
3. Disegna diagramma → auto-save ogni 2s
4. Export PNG/SVG se necessario
5. Chiudi tab → file salvato in CWD

### Scenario 3: Aprire file esistente
1. File Explorer → Click su `architecture.md` o `flow.tldr`
2. Si apre nel tab appropriato (Markdown o Tldraw)
3. Modifica → auto-save
4. Switch tra tab mantiene lo stato

---

## 📊 Timeline Estimato

| Fase | Tempo | Dipendenze |
|------|-------|------------|
| Fase 1: Setup Dipendenze | 5 min | - |
| Fase 2: Estendere Sistema Tab | 10 min | Fase 1 |
| Fase 3: File Type Detection | 10 min | Fase 2 |
| Fase 4: Markdown Tab Component | 30 min | Fase 3 |
| Fase 5: Tldraw Tab Component | 30 min | Fase 3 |
| Fase 6: File Actions | 15 min | Fase 4, 5 |
| Fase 7: Testing & Polish | 20 min | Fase 6 |
| **TOTALE** | **~2 ore** | - |

---

## 🚀 Next Steps

1. ✅ Chiamare **Roberta** per verificare le versioni più recenti e compatibili di:
   - `tldraw` (latest stable v2.x)
   - `react-markdown` (latest v9.x)
   - `remark-gfm` (latest v4.x)
   - `rehype-highlight` (latest v7.x)

2. ✅ Iniziare con **Fase 1: Setup Dipendenze**

3. ✅ Procedere in ordine sequenziale attraverso le fasi

---

**Creato da:** Agent Alexei 🦆
**Data creazione:** 2025-01-14
**Ultima modifica:** 2025-01-14
