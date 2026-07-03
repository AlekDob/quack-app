import { useEffect } from "react";
import {
  applyEditorColorTheme,
  normalizeColorTheme,
} from "./editorColorThemes";
import { useEditorSettings } from "./editorSettings";
import { useResolvedTheme } from "./theme";

export function useResolvedEditorColorTheme(): string {
  const mode = useResolvedTheme();
  const settings = useEditorSettings();
  const stored =
    mode === "dark" ? settings.darkColorTheme : settings.lightColorTheme;
  const themeId = normalizeColorTheme(stored, mode);

  // @monaco-editor/react does not always re-apply `theme` on prop change;
  // call setTheme directly so token colors update live from Settings.
  useEffect(() => {
    applyEditorColorTheme(themeId);
  }, [themeId]);

  return themeId;
}
