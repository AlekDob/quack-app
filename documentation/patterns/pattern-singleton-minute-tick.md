---
type: pattern
project: quack-app
created: 2026-05-26
last_verified: 2026-05-26
tags: [react, perf, timer, hook]
---

# Pattern: Singleton Minute Tick (`useMinuteTick`)

**File**: `src/hooks/useMinuteTick.ts`

## Problem
Componenti che renderizzano timestamp relativi (es. "5m ago", "2h fa") devono forzare un re-render periodico. Il pattern naïve è `useState(0) + useEffect(setInterval(setTick, 60_000))` **dentro ogni componente**. Quando un componente è renderizzato N volte (es. agent card in una lista), spawni **N setInterval indipendenti**.

Conseguenze:
- Con 50 agent card: 50 timer attivi, 50 setState ogni minuto, 50 re-render simultanei.
- Drift fra timer: i tick non sono allineati → ogni 60s la UI è in costante refresh disturbato.
- Memory leak se un timer non viene pulito al unmount (race condition rara ma possibile).

## Solution
Un solo `setInterval` app-wide condiviso da tutti i subscriber. Il primo `useMinuteTick()` che monta avvia il ticker; l'ultimo che smonta lo ferma.

```ts
// src/hooks/useMinuteTick.ts
let globalTick = 0;
const subscribers = new Set<(t: number) => void>();
let intervalId: ReturnType<typeof setInterval> | null = null;

function startTicker() {
  if (intervalId !== null) return;
  intervalId = setInterval(() => {
    globalTick += 1;
    subscribers.forEach((cb) => cb(globalTick));
  }, 60_000);
}

function maybeStopTicker() {
  if (subscribers.size === 0 && intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

export function useMinuteTick(): number {
  const [tick, setTick] = useState(globalTick);
  useEffect(() => {
    subscribers.add(setTick);
    startTicker();
    return () => {
      subscribers.delete(setTick);
      maybeStopTicker();
    };
  }, []);
  return tick;
}
```

## Usage

```tsx
function AgentCard({ agent }) {
  const tick = useMinuteTick();
  const relativeTime = useMemo(
    () => getRelativeTimeString(agent.lastSeen),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agent.lastSeen, tick], // tick forces re-eval every minute
  );
  return <span>{relativeTime}</span>;
}
```

## When to use
- Liste di item con timestamp relativi.
- Header/badge che mostrano "online da", "scaduto fra X".

## When NOT to use
- Granularità sotto il minuto (usa requestAnimationFrame o setInterval più frequente, ma allora valuta sempre il singleton).
- Aggiornamenti event-driven (es. notifica WebSocket): usa un evento, non un timer.

## Trade-offs
- Tutti i subscriber si svegliano insieme (allineamento → ok per UX coerente).
- Stato globale (modulo-scoped) — testabilità ridotta. Per i test, basta `vi.useFakeTimers()`.
- `globalTick` non viene resettato fra HMR (irrilevante in prod).

## Related
- `src/components/RepositoryGroup.tsx:208` — primo consumer (agent card relative time)
- Anti-pattern del "timer per card" è il caso documentato che ha motivato l'estrazione (perf audit 2026-05-26).
