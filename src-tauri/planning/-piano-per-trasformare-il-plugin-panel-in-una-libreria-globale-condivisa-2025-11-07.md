## 🦆 Piano per Trasformare il Plugin Panel in una Libreria Globale Condivisa

### **Fase 1: Struttura Dati e Storage Globale**

#### 1.1 Creare nuovo tipo `UserLibraryItem` in `types.ts`
```typescript
export interface UserLibraryItem {
  id: string;
  name: string;
  description: string;
  category: PluginCategory;
  repository: string;           // GitHub/GitLab URL
  installCommand?: string;       // Optional custom install command
  documentation?: string;        // Optional docs URL
  author: string;
  tags: string[];
  addedBy: 'user' | 'system';  // Track who added it
  addedAt: number;              // Timestamp
  lastModified: number;
  notes?: string;               // User notes
  installInstructions?: string; // Custom install instructions
  isPrivate?: boolean;          // If from private repo
  authentication?: {            // For private repos
    type: 'token' | 'ssh';
    hint?: string;
  };
}
```

#### 1.2 Backend Rust - Nuovi comandi Tauri
- `add_user_library_item` - Aggiunge item alla libreria
- `update_user_library_item` - Modifica item esistente
- `remove_user_library_item` - Rimuove item
- `list_user_library` - Lista tutti gli items utente
- `import_library_from_json` - Import bulk da JSON
- `export_library_to_json` - Export della libreria

### **Fase 2: UI Migliorata del Plugins Panel**

#### 2.1 Nuovo Tab System
```tsx
// Tre tabs principali:
- "Marketplace" - Plugin ufficiali dai marketplace
- "My Library" - Plugin aggiunti dall'utente
- "Installed" - Plugin installati nel progetto corrente
```

#### 2.2 Modal per Aggiungere Plugin Personalizzati
```tsx
<AddPluginModal>
  - URL Repository (con validazione)
  - Nome e Descrizione
  - Categoria (agent/command/hook/mcp/skill)
  - Tags personalizzati
  - Comando installazione personalizzato
  - Note/istruzioni private
  - Test connessione al repo
</AddPluginModal>
```

#### 2.3 Card Plugin Migliorata
```tsx
<PluginCard>
  - Badge "User Added" vs "Marketplace"
  - Quick actions: Edit, Delete, Copy Install Command
  - Status indicators per progetto
  - Note private visibili solo all'utente
</PluginCard>
```

### **Fase 3: Sistema di Installazione Intelligente**

#### 3.1 Auto-detection del tipo di repository
- GitHub standard (.claude-plugin/)
- NPM package (package.json)
- Python package (setup.py, pyproject.toml)
- Custom structure (user-defined)

#### 3.2 Installazione flessibile
```rust
// Supporta vari metodi:
- ZIP download (attuale)
- Git clone
- NPM install
- Pip install
- Custom command execution
```

### **Fase 4: Gestione per Progetto**

#### 4.1 Project Plugin Registry
```json
// .claude/plugins/registry.json
{
  "installed": [...],
  "userLibraryLinks": [
    // Links to user library items used in this project
  ]
}
```

#### 4.2 Quick Install from Library
- Bottone "Install in Project" che appare quando apri un progetto
- Batch install di multipli plugin
- Dependency resolution

### **Fase 5: Sync e Backup**

#### 5.1 Export/Import Library
- Export to JSON file
- Import from JSON
- Merge con existing library

#### 5.2 Cloud Sync (opzionale futuro)
- Sync tramite GitHub Gist privato
- Encrypted backup

### **Modifiche Principali ai File**

1. **`src/components/PluginsPanel.tsx`**
   - Aggiungere tab navigation
   - Nuovo stato per user library
   - Modal per add/edit plugin

2. **`src/components/AddPluginModal.tsx`** (nuovo)
   - Form completo per aggiungere plugin
   - Validazione URL repository
   - Test connessione

3. **`src/components/UserPluginCard.tsx`** (nuovo)
   - Card specializzata per user plugins
   - Edit/Delete actions
   - Copy install command

4. **`src-tauri/src/user_library.rs`** (nuovo)
   - CRUD operations per user library
   - Storage in `~/.claude/user-library.json`
   - Import/export funzionalità

5. **`src-tauri/src/plugins.rs`**
   - Estendere per supportare custom install commands
   - Auto-detection repository type
   - Support per private repos

### **Vantaggi di questo approccio:**
✅ **Libreria personale persistente** - Non perdi mai i tuoi plugin preferiti
✅ **Condivisione facile** - Export/import JSON per condividere con team
✅ **Flessibilità massima** - Supporta qualsiasi tipo di plugin/tool
✅ **Privacy** - Le tue note e configurazioni rimangono private
✅ **Multi-progetto** - Usa la stessa libreria in tutti i progetti

Quack quack! 🦆 Questo piano trasformerà il plugin panel in un vero **knowledge base personale** per tutti i tuoi strumenti preferiti!