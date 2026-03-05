# Droid Factory - Integration Guide

## 🚀 Quick Integration in App.tsx

Aggiungi queste **3 righe di codice** in `App.tsx`:

### 1. Import (top of file)
```tsx
import { DroidFactoryDrawer } from './components/droid-factory';
import { useDroidFactory } from './hooks/useDroidFactory';
```

### 2. Hook (inside App component, before return)
```tsx
const {
  droidFactoryOpen,
  setDroidFactoryOpen,
  userStats,
  handleCreateDroid,
} = useDroidFactory();
```

### 3. Render (inside return, accanto agli altri Drawer)
```tsx
<DroidFactoryDrawer
  open={droidFactoryOpen}
  onClose={() => setDroidFactoryOpen(false)}
  onCreateDroid={handleCreateDroid}
  userStats={userStats}
/>
```

### 4. Open Droid Factory (aggiungi bottone dove vuoi)

Esempio nel TabBar:
```tsx
<IconButton onClick={() => setDroidFactoryOpen(true)}>
  🏭
</IconButton>
```

Oppure nella navbar, action icons, ecc.

---

## ✅ Fatto!

Con solo queste 3 modifiche minime, la Droid Factory è completamente integrata e funzionante! 🎉

---

## 📋 Optional: Slash Command

Il comando `/droid-factory` è già configurato in `.claude/commands/droid-factory.md` e sarà automaticamente disponibile nell'autocomplete quando l'utente digita `/` in chat.

**Nessuna integrazione richiesta** - il sistema di slash commands esistente lo gestisce automaticamente!

---

## 🎨 Customization

Se vuoi personalizzare l'entry point, puoi:

1. **Aggiungere tab nella navbar** - Crea un nuovo tab "🏭 Droids"
2. **Aggiungere nel sidebar** - Bottone dedicato nel left sidebar
3. **Action button** - FAB (Floating Action Button) in basso a destra

Tutti aprono semplicemente: `setDroidFactoryOpen(true)`

---

## 🧪 Testing

Per testare manualmente:

1. Apri l'app
2. Clicca sul bottone che hai aggiunto (o usa `/droid-factory` in chat)
3. Seleziona un template o crea custom droid
4. Clicca "Create Droid"
5. Verifica che il file sia stato creato in `.claude/agents/[name].md`
6. Controlla che achievements vengano sbloccati

---

## 🐛 Troubleshooting

**File non viene creato:**
- Verifica che `get_project_directory` comando Tauri esista
- Controlla i permessi della cartella `.claude/agents/`
- Vedi console per errori

**Stats non si salvano:**
- Controlla localStorage nel browser dev tools
- Key: `quack_droid_factory_stats`

**Achievement non si unlocked:**
- Vedi console, dovrebbe mostrare toast
- Verifica logica in `src/services/droidStatsStorage.ts`

---

**That's it!** 🦆🏭🤖
