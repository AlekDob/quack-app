---
type: gotcha
project: quack-app
created: 2026-05-13
last_verified: 2026-05-13
tags: [javascript, security, logging, secrets, daemon]
---

# JS `a && b && c` in a template literal leaks the secret

## Trigger

You write a diag/log line that interpolates the result of a short-circuit
`&&` chain whose last operand is sensitive. Example from
`stream-daemon.js`:

```js
const usingProviderConfig =
  providerConfig && providerConfig.baseUrl && providerConfig.authToken;

diag(`PROVIDER_CONFIG: ... usingProviderConfig=${usingProviderConfig}`);
```

You expect `usingProviderConfig=true` in the log file. What you actually
get:

```
PROVIDER_CONFIG: ... usingProviderConfig=sk-cp-dvvMHMFOMLMd8ckWwQOZxcUtPKXoHkQTt9xN82P96arIyp_N8TFuWSR8TQI1N1wbVp5NnKNPtSwDaOq9JjDbVJoXJ4E0P9XpZ0znVCT0UjKRSXI0MaozhPk
```

The full API key, written to `~/.quack/daemon-diag.log` in plaintext.

## Root cause

JS `&&` is NOT a boolean operator. `a && b && c` returns:

- the first falsy operand, if any
- otherwise the **last operand** (untransformed)

So `truthy_a && truthy_b && truthy_c === truthy_c`. When `truthy_c` is an
API key, that's what gets interpolated.

Template literals call `String(value)` on every `${expr}`, which for a
plain string is the string itself. There is no implicit cast to bool.

## Fix

Always `!!`-cast the expression before logging:

```js
diag(`... usingProviderConfig=${!!usingProviderConfig}`);
```

Better: don't reuse the same variable for "did the override apply" AND
"the third truthy thing in the chain". Compute the boolean separately:

```js
const hasProviderConfig = !!(providerConfig?.baseUrl && providerConfig?.authToken);
```

## Sanitizing already-leaked logs

If the leak hit production logs, strip the offending lines and rotate
the secret:

```bash
# 1. backup
cp ~/.quack/daemon-diag.log ~/.quack/daemon-diag.log.bak

# 2. strip
grep -v "usingProviderConfig=sk-" ~/.quack/daemon-diag.log > /tmp/clean.log
mv /tmp/clean.log ~/.quack/daemon-diag.log

# 3. rotate the leaked key in the provider's dashboard
# 4. delete the .bak once the new key is in place
```

A leaked log is forever — if any backup, sync tool, or crash dump touched
the file before sanitation, treat the key as compromised.

## Where else this can bite

Anywhere `a && b && c.token` (or `.secret`, `.cookie`, `.password`)
is used as a "truthiness guard". Search for:

- `apiKey`, `authToken`, `secret`, `password`, `cookie` in template
  literals
- `Bearer ${...}` strings
- `console.log`, `console.error`, `diag()`, custom log helpers

`String.prototype.includes('sk-')` is a quick smoke-test in CI.

## Related

- Feature: `documentation/features/065-anthropic-compatible-providers.md`
- Pattern: `documentation/patterns/pattern-anthropic-compatible-providers.md`
