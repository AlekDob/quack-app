# Live provider usage in the Environment panel

> Scope: Codex, Claude Code, and Cursor

## What changed

The chat Environment panel now loads the provider usage snapshot when the panel is open.
The existing row and popover are reused, so the UI stays the same as the Codex usage row.

The header usage control keeps its old behavior. It only uses usage already present in client
state and does not start a live fetch.

## Providers

The panel uses the existing read-only server fetchers:

| Provider | Source |
| --- | --- |
| Codex | Codex account usage snapshot |
| Claude Code | Anthropic OAuth usage endpoint |
| Cursor | Cursor DashboardService |

Providers without a registered usage fetcher stay hidden. The same applies when the provider has
no readable limits, is not authenticated, or the usage request fails.

## Data flow

1. `EnvironmentPanel` passes its `open` state to `EnvironmentUsageSection`.
2. The section enables live provider data only while the panel is open.
3. `useProviderUsageMenuModel` forwards that choice to `useProviderUsageSummary`.
4. Existing React Query caching and the 60-second refresh interval provide the snapshot.
5. The shared usage row renders the primary remaining percentage and opens the existing details
   popover.

The panel component remains mounted while closed, so gating the query on `open` avoids provider
requests and polling when the user cannot see the panel.

## Files

- `apps/web/src/components/chat/environment/EnvironmentPanel.tsx` wires the open state.
- `apps/web/src/components/chat/environment/EnvironmentUsageSection.tsx` enables live loading.
- `apps/web/src/components/ProviderUsageMenuControl.tsx` adds the optional fetch flag while
  keeping the default passive.
- `apps/web/src/components/ProviderUsageMenuControl.test.tsx` covers the passive and live paths.

## Verification

The focused web test passes with three tests covering the default passive path and live loading for
Claude Code and Cursor.
