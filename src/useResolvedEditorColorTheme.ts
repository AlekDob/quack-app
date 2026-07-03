import { normalizeColorTheme } from "./editorColorThemes";
import { useEditorSettings } from "./editorSettings";
import { useResolvedTheme } from "./theme";

export function useResolvedEditorColorTheme(): string {
  const mode = useResolvedTheme();
  const settings = useEditorSettings();
  const stored =
    mode === "dark" ? settings.darkColorTheme : settings.lightColorTheme;
  return normalizeColorTheme(stored, mode);
}
