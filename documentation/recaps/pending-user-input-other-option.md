---
type: recap
project: synara
created: 2026-08-03
last_verified: 2026-08-03
tags: [recap, pending-user-input, composer, other-option]
---

# Recap: Pending user input Other option

## Shipped
- Synthetic **Other** choice on `ComposerPendingUserInputPanel` when the provider sent preset options
- `preferCustomAnswer` draft flag so Other can be selected before any text is typed
- Selecting Other focuses the composer and blocks submit until a custom answer exists
- Digit shortcut for Other = last option index + 1
- Skips synthetic Other if the provider already included Other / Altro / Something else
- Placeholder switches to “Type your answer to continue” while on the custom path

## Decisions / patterns created
- Feature map: `documentation/features/001-pending-user-input.md`
- Do not submit the label `"Other"` — only the typed custom answer
- Prefer a draft flag over a sentinel selected-option label

## Residual risks
- ChatView still owns a large amount of pending-input wiring; keep Other helpers in `pendingUserInput.ts`
- Multi-select + Other still switches to free-text-only mode (same as typing custom before)

## Follow-ups
- Optional: localized Other label if the UI gains i18n for composer strings
- Optional: browser test for Other select → focus → submit
