---
type: guide
project: quack-app
created: 2026-03-12
tags: [testing, frontend, react, e2e]
---

# Frontend Testing Strategy

Strategia di test per il frontend React di Quack, organizzata su tre livelli: component test, integration test, E2E test.

## 1. Component Tests

**Obiettivo**: verificare che ogni componente React renderizzi correttamente in isolamento e risponda agli eventi utente.

**Cosa testare**:
- Rendering condizionale (stati vuoti, loading, errore, dati presenti)
- Callback su eventi utente (click, input, submit)
- Props e varianti visive
- Accessibilita base (ruoli ARIA, label)

**Cosa NON testare**:
- Dettagli implementativi interni (state privato, ref)
- Stili CSS pixel-perfect
- Componenti wrapper senza logica propria

**Esempio**:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { SessionCard } from '@/components/SessionCard';

test('mostra il titolo della sessione', () => {
  render(<SessionCard title="Debug auth" status="running" />);
  expect(screen.getByText('Debug auth')).toBeInTheDocument();
});

test('chiama onStop al click del bottone stop', () => {
  const onStop = vi.fn();
  render(<SessionCard title="Test" status="running" onStop={onStop} />);
  fireEvent.click(screen.getByRole('button', { name: /stop/i }));
  expect(onStop).toHaveBeenCalledOnce();
});
```

## 2. Integration Tests (Stores e Hooks)

**Obiettivo**: verificare che stores Zustand, custom hooks e service layer funzionino correttamente insieme.

**Cosa testare**:
- Stato iniziale e transizioni degli store Zustand
- Custom hooks con `renderHook` (useSession, useQuickLoop, ecc.)
- Interazione store + hook (es. hook che legge/scrive sullo store)
- Service layer con mock delle API Tauri (`@tauri-apps/api`)

**Pattern consigliato per store test**:
```tsx
import { renderHook, act } from '@testing-library/react';
import { useSessionStore } from '@/stores/sessionStore';

test('addSession aggiunge una sessione allo store', () => {
  const { result } = renderHook(() => useSessionStore());

  act(() => {
    result.current.addSession({ id: '1', title: 'Test' });
  });

  expect(result.current.sessions).toHaveLength(1);
  expect(result.current.sessions[0].title).toBe('Test');
});
```

**Mock Tauri commands**:
```tsx
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue({ success: true }),
}));
```

## 3. E2E Tests (User Flows)

**Obiettivo**: validare i flussi utente completi end-to-end, simulando l'interazione reale con l'app.

**Flussi prioritari da coprire**:

| Flusso | Descrizione | Priorita |
|--------|-------------|----------|
| Creazione sessione | Nuovo chat, invio messaggio, ricezione risposta | Alta |
| Cambio provider | Switch tra Anthropic/Bedrock/Vertex, verifica connessione | Alta |
| Gestione tab | Apertura, chiusura, switch, rinomina tab | Media |
| Settings | Modifica configurazione, salvataggio, persistenza al reload | Media |
| Automazioni | Creazione job, esecuzione, verifica risultato | Media |
| Kanban board | Creazione task, drag & drop, cambio stato | Bassa |
| Quick Loop | Attivazione loop, esecuzione, stop | Alta |

**Esempio Playwright**:
```ts
import { test, expect } from '@playwright/test';

test('crea una nuova sessione e invia un messaggio', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-testid="new-session"]');
  await page.fill('[data-testid="chat-input"]', 'Hello Quack');
  await page.press('[data-testid="chat-input"]', 'Enter');
  await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible();
});
```

## 4. Tool e Framework

| Livello | Tool | Motivazione |
|---------|------|-------------|
| Component | **Vitest** + **React Testing Library** | Veloce, compatibile Vite, API user-centric |
| Integration | **Vitest** + **@testing-library/react** | Stesso runner, `renderHook` integrato |
| E2E | **Playwright** | Multi-browser, auto-wait, supporto Tauri via WebDriver |
| Coverage | **v8** (via Vitest) | Coverage nativa, zero config aggiuntiva |
| Visual regression | **Playwright screenshots** | Confronto pixel, integrato nel runner E2E |
| Mock API | **MSW** (Mock Service Worker) | Intercetta fetch/XHR a livello network |
| CI | **GitHub Actions** | Gia in uso nel progetto |

### Configurazione Vitest consigliata

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/components/**', 'src/stores/**', 'src/hooks/**'],
      thresholds: { statements: 70, branches: 60, functions: 70, lines: 70 },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
});
```

### Setup file

```ts
// src/test/setup.ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => cleanup());

// Mock globale Tauri
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockReturnValue(Promise.resolve(() => {})),
  emit: vi.fn(),
}));
```

## 5. Convenzioni

- **Naming**: `ComponentName.test.tsx` colocato accanto al componente
- **Data-testid**: usare `data-testid` per selettori E2E, mai classi CSS
- **Priorita selettori** (Testing Library): `getByRole` > `getByLabelText` > `getByText` > `getByTestId`
- **No implementation details**: testare comportamento utente, non stato interno
- **Mock minimali**: mockare solo i confini del sistema (Tauri API, network), mai logica interna

## 6. Metriche Target

| Metrica | Target | Note |
|---------|--------|------|
| Coverage statements | >= 70% | Su components, stores, hooks |
| Coverage branches | >= 60% | Focus su logica condizionale |
| E2E pass rate | 100% | Flussi critici sempre verdi |
| Test execution time | < 30s | Unit + integration (no E2E) |
| Flaky test tolerance | 0 | Nessun test intermittente accettato |
