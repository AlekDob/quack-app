---
type: component
project: quack-app
created: 2026-01-08
migrated: true
---

# Voice Recording System

## Sistema di Registrazione Vocale

Quack include un sistema di **voice recording** per input vocale nell'AI chat. E' un'alternativa alla digitazione per interagire con Claude.

## Componente Principale

`VoiceRecordingModal.tsx` (265 righe) offre:
- Visualizzazione audio level in tempo reale con onde animate
- Palette colori duck-themed (giallo/arancione)
- Speech recognition con transcript interim e finale
- Amplitude reattiva basata sui livelli audio
- Indicatore pulsante del microfono
- Gestione errori per fallimenti di registrazione

## Visualizzazione Wave

L'animazione usa Canvas HTML5:
- 3 onde a frequenze diverse
- Amplitude dinamica (scala 0-100)
- Effetti gradient con RGBA
- requestAnimationFrame per 60fps fluidi
- Supporto device pixel ratio per display HiDPI

## Flusso Utilizzo

1. User clicca icona microfono nel ChatInput
2. Si apre VoiceRecordingModal
3. Audio viene catturato e visualizzato
4. Speech-to-text converte in testo
5. Transcript viene inserito nel chat input

## File Principali

| File | Ruolo |
|------|-------|
| `VoiceRecordingModal.tsx` | UI registrazione vocale |
| `ChatInput.tsx` | Integrazione con input chat |
