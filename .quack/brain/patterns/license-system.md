---
type: component
project: quack-app
created: 2026-01-08
migrated: true
---

# License System

## Sistema di Licenze

Quack include un sistema di **licensing** per gestire l'attivazione dell'app e il tracciamento dispositivi.

## Tipi di Licenza

- **Lifetime**: Licenza perpetua, non scade
- **Subscription**: Licenza con scadenza, richiede rinnovo

## Device Tracking

Ogni installazione genera un **device_id** univoco (UUID v4) che viene:
- Salvato in localStorage
- Inviato al backend durante validazione
- Usato per binding licenza-dispositivo

## Struttura Dati Licenza

```typescript
LicenseData {
  key: string
  email?: string
  deviceId: string
  activatedAt: number  // milliseconds
  expiresAt?: number   // optional
  type: 'lifetime' | 'subscription'
  valid: boolean
  lastValidatedAt: number
}
```

## Integrazione Backend

- Comando Tauri: `validate_license(licenseKey, deviceId)`
- Ritorna ValidationResponse con license_data o errore
- Validazione contro backend (probabilmente Gumroad)

## File Principali

| File | Ruolo |
|------|-------|
| `LicenseModal.tsx` | UI attivazione licenza (224 righe) |
| `LicenseSettings.tsx` | Settings panel licenza |
| `features.ts` | Persistenza dati licenza |
| `license.rs` | Backend Rust (21K LOC) |
