# 🦆 Quack - Installazione

## Requisiti di Sistema
- macOS 11 (Big Sur) o successivo
- Apple Silicon (M1/M2/M3) o Intel (x86_64)

## Installazione

1. **Scarica** il file `Quack_0.1.0_aarch64.dmg`
2. **Apri** il file DMG (doppio clic)
3. **Trascina** l'icona di Quack nella cartella Applicazioni
4. **Apri** Quack dalla cartella Applicazioni

## ⚠️ Primo Avvio

Al primo avvio, macOS mostrerà un warning perché l'app non è firmata con un certificato Apple:

```
"Quack.app" cannot be opened because the developer cannot be verified.
```

**Soluzione:**
1. **Clic destro** (o Control+clic) sull'icona di Quack
2. Seleziona **"Apri"** dal menu contestuale
3. Clicca **"Apri"** nel dialogo che appare
4. L'app verrà ricordata come sicura per i prossimi avvii

## 🆘 Troubleshooting

### L'app non si apre
- Verifica di avere macOS 11 o successivo
- Prova a riavviare il Mac
- Controlla che l'app sia nella cartella Applicazioni

### Warning "App danneggiata"
```bash
# Apri il Terminale e esegui:
sudo xattr -rd com.apple.quarantine /Applications/Quack.app
```

### Problemi con i permessi
- Vai in Preferenze di Sistema → Sicurezza e Privacy
- Clicca "Apri comunque" per Quack

## 📝 Note
- Quack è un'app multi-terminale con AI integrata
- Richiede connessione internet per le funzionalità AI
- La prima apertura potrebbe richiedere qualche secondo in più

## 🐛 Segnalazione Bug
Per segnalare problemi o bug, contatta lo sviluppatore.

---
Buon Quack! 🦆
