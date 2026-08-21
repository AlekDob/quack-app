---
type: feature-doc
project: quack
stack: React / TypeScript
created: 2026-08-21
startDate: 2026-08-21
endDate:
last_verified: 2026-08-21
status: active
tags: [provider, health, banner, composer, auth, notifications, dark-mode]
---

## Provider health banner

**Purpose:** Show install/auth/availability problems for the active chat provider next to the composer, with readable error/warning contrast in dark mode.
**Stack:** React / TypeScript (`apps/web`)
**Linear:** QUACK-5 — "Login notifica"

### Files

| Type      | Path                                                         | Exports/Purpose                                                                                        |
| --------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Component | `apps/web/src/components/chat/ProviderHealthBanner.tsx`      | `ProviderHealthBanner` — Alert error/warning above composer                                            |
| Test      | `apps/web/src/components/chat/ProviderHealthBanner.test.tsx` | Renders message / hides when ready / dismiss control                                                   |
| Component | `apps/web/src/components/ChatView.tsx`                       | Mounts banner in `ComposerColumnFrame`; undismisses on blocked send; skips top toast when banner shows |
| Logic     | `apps/web/src/components/ChatView.logic.ts`                  | `shouldRenderProviderHealthBanner`, `shouldToastProviderSendBlock`, dismissal key helpers              |
| Test      | `apps/web/src/components/ChatView.logic.test.ts`             | Banner surface gates + toast-vs-banner rule                                                            |
| Component | `apps/web/src/components/ui/alert.tsx`                       | Stronger dark `error` / `warning` surface tokens                                                       |
| Component | `apps/web/src/components/chat/ChatColumnBannerFrame.tsx`     | Top-of-pane frame for thread-error / rate-limit only (provider health no longer uses it)               |
| Util      | `apps/web/src/lib/providerAvailability.ts`                   | `resolveProviderSendAvailabilityWithRefresh`, `providerUnavailableReason`                              |

### Data Flow

`serverConfig.providers` / status push → `activeProviderStatus` in `ChatView` → if not ready and not dismissed → `ProviderHealthBanner` above composer → user hits send while blocked → undismiss banner key → skip top-center toast when `shouldToastProviderSendBlock` is false → keep toast only when banner cannot show (e.g. terminal workspace tab).

### Key Functions

- `shouldRenderProviderHealthBanner({ threadEntryPoint, terminalWorkspaceTerminalTabActive }) → boolean` — chat surface only
- `shouldToastProviderSendBlock({ shouldShowProviderHealthBanner }) → boolean` — toast only if banner cannot show
- `getProviderHealthBannerDismissalKey(status) → string | null` — localStorage dismissal identity
- `ProviderHealthBanner({ status, onDismiss }) → ReactNode` — null when ready/missing

### State

- `dismissedProviderHealthBannerKeys: string[]` — localStorage, per-machine dismiss list (component/session)
- `visibleActiveProviderStatus: ServerProviderStatus | null` — null when dismissed for current key (component)

### Behavior

- Banner sits inside `ComposerColumnFrame` (empty landing and normal chat), not at the top of the pane.
- Uses shared `Alert` variants (not the low-contrast expanded notification wash).
- Dismissible; a later blocked send clears that dismissal so the message returns next to the input.
- Related: Claude post-failure transcript card stays in [019-claude-auth-recovery.md](019-claude-auth-recovery.md); this banner is the pre-send / status path for any provider.

### Verification

- `cd apps/web && bun run test src/components/ChatView.logic.test.ts src/components/chat/ProviderHealthBanner.test.tsx` — 138 passed.

### Related

- Diary: [2026-08-21](../diary/2026-08-21.md)
- Send busy flag (separate): [013-immediate-send-feedback.md](013-immediate-send-feedback.md)
