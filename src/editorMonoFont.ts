/** Monaco `fontFamily` — mirrors `--mono` in App.css (JetBrains Mono stack). */
export const EDITOR_MONO_FONT =
  '"JetBrains Mono", "Cascadia Mono", Consolas, "SF Mono", Menlo, monospace';

export function readEditorMonoFont(): string {
  if (typeof document === "undefined") return EDITOR_MONO_FONT;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--mono")
    .trim();
  return raw || EDITOR_MONO_FONT;
}
