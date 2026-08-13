---
type: gotcha
project: synara
created: 2026-08-13
last_verified: 2026-08-13
status: fixed
tags: [localServerMonitor, page-title, dev-server, cpu, react-query, polling, performance]
---

## The local-server page-title probe pins every slow dev server at ~75% CPU

### Symptom

Start a dev server on the machine (`next dev`, `make dev-full`, whatever) and the whole Mac melts:
`next-server` sits at 72-78% CPU forever, fans on, process count climbing, and eventually macOS
SIGKILLs the fattest process (usually Quack itself, ~3 GB across its processes, no crash report and
no shutdown log — see the 2026-08-13 diary entry for the no-swap kill mechanism).

Reproduces with **any** terminal, including Ghostty. The dev server does not have to be launched
from inside Quack — Quack finds listening ports itself with an `lsof` scan.

Signature in the dev server's own output: `GET / 200 in 866ms`, then `5.2s`, then `8.1s`, over and
over, for requests nobody made.

### Cause

A feedback loop between a fixed-timeout probe and an on-demand-compiling dev server:

1. The Environment panel refetches `listLocalServers()` every 10 s
   (`LOCAL_SERVERS_VISIBLE_REFETCH_INTERVAL_MS` in `apps/web/src/lib/serverReactQuery.ts`).
2. Each round, the server does `GET /` on every detected dev server to read its `<title>`
   (`enrichLocalServerProcessesWithPageTitles` in `apps/server/src/localServerMonitor.ts`).
3. The probe timeout was 650 ms (`PAGE_TITLE_FETCH_TIMEOUT_MS`). `next dev` compiles `/` on demand
   and needs seconds the first time — it never answers within 650 ms.
4. `AbortSignal.timeout` closes the client socket but **does not stop the server-side render**. Next
   keeps compiling and rendering a page that will be thrown away.
5. The failure was remembered for only 10 s (`PAGE_TITLE_FAILURE_TTL_MS`), less than the poll
   interval — so the cache was always expired and step 2 ran again. Forever.

Net effect: a full Next render, abandoned, six times a minute, per dev server.

### Fix

`apps/server/src/localServerMonitor.ts`:

- `PAGE_TITLE_FETCH_TIMEOUT_MS`: 650 → `1_500` (a warm server now answers and gets the existing
  30 s success cache).
- `PAGE_TITLE_FAILURE_TTL_MS`: `10_000` → `15 * 60_000` (a slow server is probed a couple of times
  per hour instead of six times a minute).

Left alone on purpose: the 10 s refetch interval. Once the title is cached the poll is just a cheap
`lsof` scan, and the probe timeout is awaited _inside_ `listLocalServers()`, so raising the timeout
is only safe because failures are now remembered.

Regression guard: `apps/server/src/localServerMonitor.test.ts` →
"does not re-probe a page title that already failed".

### Not a regression from the recent synara pulls

Checked with `git log -S`, all of this predates the 08-11/08-12 pulls the problem was blamed on:

- `PAGE_TITLE_FETCH_TIMEOUT_MS` + the probe itself: `260a15628` (2026-06-08)
- `LOCAL_SERVERS_VISIBLE_REFETCH_INTERVAL_MS`: `7f278a6f0` (2026-06-09), tuned by `1c99ecc13`
  "Reduce idle local server polling (#259)" (2026-06-27)
- Environment panel files: June 2026
- `useSidebarProjectRunController.ts`: 2026-07-20

The _sidebar_ poll was already gated behind an active project run; the unconditional 10 s poll came
from the Environment panel. What changed on 08-12/08-13 was the workload (a `make dev-full` with two
`next dev` instances), not this code.

### If it comes back

Any new caller that probes a discovered local URL must go through
`resolvePageTitleFromUrl` so it inherits the failure cache. A raw `fetch` on a discovered port
inside a polling loop recreates this bug exactly.
