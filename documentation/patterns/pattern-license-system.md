---
type: pattern
created: 2026-01-08
---

# License System

## Sistema di Licenze

Quack include un sistema di **licensing** per gestire l'attivazione dell'app e il tracciamento dispositivi.

## Tipi di Licenza

- **Lifetime**: Licenza perpetua, non scade
- **Subscription**: Licenza con scadenza, richiede rinnovo

## Device Tracking

Ogni installazione genera un **device_id** univoco (UUID v4) che viene salvato in localStorage, inviato al backend durante validazione, e usato per binding licenza-dispositivo.

## Struttura Dati Licenza

```typescript
LicenseData {
  key: string
  email?: string
  deviceId: string
  activatedAt: number
  expiresAt?: number
  type: 'lifetime' | 'subscription'
  valid: boolean
  lastValidatedAt: number
}
```

## Integrazione Backend

- Comando Tauri: `validate_license(licenseKey, deviceId)`
- Ritorna ValidationResponse con license_data o errore

## File Principali

| File | Ruolo |
|------|-------|
| `LicenseModal.tsx` | UI attivazione licenza |
| `LicenseSettings.tsx` | Settings panel licenza |
| `features.ts` | Persistenza dati licenza |
| `license.rs` | Backend Rust |
