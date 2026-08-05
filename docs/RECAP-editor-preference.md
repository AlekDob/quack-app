# External editor preference

## Problem

Quack used the first installed editor when no editor preference existed. The
choice came from the catalog order, not from a user action. If Antigravity was
the first available entry, opening a file could launch Antigravity without the
user selecting it.

## Behaviour now

- A new profile has no preferred editor.
- File and workspace actions do not guess an editor.
- An editor is remembered only after the user selects or opens one explicitly.
- Existing saved preferences continue to work when that editor is installed.

This follows the same boundary as t3code: local external applications are not
chosen by default. The app should keep the work in its own viewer or wait for an
explicit editor choice.

## Implementation

`apps/web/src/editorPreferences.ts` now returns `null` when the saved value is
missing or no longer available. It no longer persists the first catalog entry.
The caller then reports that no editor is selected instead of launching an
unrequested application.

The regression test in `apps/web/src/editorPreferences.test.ts` covers a new
profile with Antigravity and Cursor installed.
