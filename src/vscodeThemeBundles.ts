import type { editor } from "monaco-editor";
import {
  ABYSS_RULES,
  DARK_PLUS_RULES,
  KIMBIE_RULES,
  LIGHT_PLUS_RULES,
  MONOKAI_DIMMED_RULES,
  RED_RULES,
  VS_DARK_RULES,
  VS_LIGHT_RULES,
} from "./monacoThemeRules";
import monokaiJson from "./vscodeThemes/Monokai.json";
import solarizedDarkJson from "./vscodeThemes/Solarized-dark.json";
import solarizedLightJson from "./vscodeThemes/Solarized-light.json";
import tomorrowNightBlueJson from "./vscodeThemes/Tomorrow-Night-Blue.json";

type Bundle = editor.IStandaloneThemeData;

function darkBundle(
  colors: Record<string, string>,
  rules: editor.ITokenThemeRule[],
): Bundle {
  return { base: "vs-dark", inherit: false, colors, rules };
}

function lightBundle(
  colors: Record<string, string>,
  rules: editor.ITokenThemeRule[],
): Bundle {
  return { base: "vs", inherit: false, colors, rules };
}

/** Monaco `defineTheme` payloads for Quack custom / VS Code bundled themes. */
export const VS_CODE_THEME_BUNDLES: Record<string, Bundle> = {
  "quack-light-modern": lightBundle(
    {
      "editor.background": "#FFFFFF",
      "editor.foreground": "#3B3B3B",
      "editorLineNumber.foreground": "#6E7681",
      "editorLineNumber.activeForeground": "#3B3B3B",
      "editor.selectionBackground": "#ADD6FF80",
      "editorIndentGuide.background": "#D4D4D4",
    },
    VS_LIGHT_RULES.map((r) =>
      r.token === "" ? { ...r, foreground: "3B3B3B" } : r,
    ),
  ),
  "quack-light-plus": lightBundle(
    {
      "editor.background": "#FFFFFF",
      "editor.foreground": "#000000",
      "editorLineNumber.foreground": "#237893",
      "editorLineNumber.activeForeground": "#0B216F",
      "editor.selectionBackground": "#ADD6FF",
      "editorIndentGuide.background": "#D3D3D3",
    },
    LIGHT_PLUS_RULES,
  ),
  "quack-quiet-light": lightBundle(
    {
      "editor.background": "#F5F5F5",
      "editor.foreground": "#333333",
      "editorLineNumber.foreground": "#AAAAAA",
      "editorLineNumber.activeForeground": "#333333",
      "editor.selectionBackground": "#C9D0D9",
      "editorIndentGuide.background": "#E0E0E0",
    },
    VS_LIGHT_RULES.map((r) =>
      r.token === "" ? { ...r, foreground: "333333" } : r,
    ),
  ),
  "quack-solarized-light": solarizedLightJson as Bundle,
  "quack-dark-modern": darkBundle(
    {
      "editor.background": "#1F1F1F",
      "editor.foreground": "#CCCCCC",
      "editorLineNumber.foreground": "#6E7681",
      "editorLineNumber.activeForeground": "#CCCCCC",
      "editor.selectionBackground": "#264F7844",
      "editorIndentGuide.background": "#404040",
    },
    VS_DARK_RULES.map((r) =>
      r.token === "" ? { ...r, foreground: "CCCCCC" } : r,
    ),
  ),
  "quack-dark-plus": darkBundle(
    {
      "editor.background": "#1E1E1E",
      "editor.foreground": "#D4D4D4",
      "editorLineNumber.foreground": "#858585",
      "editorLineNumber.activeForeground": "#C6C6C6",
      "editor.selectionBackground": "#264F78",
      "editorIndentGuide.background": "#404040",
    },
    DARK_PLUS_RULES,
  ),
  "quack-abyss": darkBundle(
    {
      "editor.background": "#000C18",
      "editor.foreground": "#6688CC",
      "editorLineNumber.foreground": "#406385",
      "editorLineNumber.activeForeground": "#80A2C2",
      "editor.selectionBackground": "#770811",
      "editorIndentGuide.background": "#002952",
    },
    ABYSS_RULES,
  ),
  "quack-kimbie-dark": darkBundle(
    {
      "editor.background": "#221A0F",
      "editor.foreground": "#D3AF86",
      "editorLineNumber.foreground": "#ADADAD",
      "editorLineNumber.activeForeground": "#ADADAD",
      "editor.selectionBackground": "#84613DAA",
      "editorIndentGuide.background": "#5E452B",
    },
    KIMBIE_RULES,
  ),
  "quack-monokai": monokaiJson as Bundle,
  "quack-monokai-dimmed": darkBundle(
    {
      "editor.background": "#1E1E1E",
      "editor.foreground": "#C5C8C6",
      "editorLineNumber.foreground": "#777777",
      "editorLineNumber.activeForeground": "#C5C8C6",
      "editor.selectionBackground": "#676B7180",
      "editorIndentGuide.background": "#464646",
    },
    MONOKAI_DIMMED_RULES,
  ),
  "quack-red": darkBundle(
    {
      "editor.background": "#390000",
      "editor.foreground": "#F8F8F8",
      "editorLineNumber.foreground": "#FF7777",
      "editorLineNumber.activeForeground": "#F8F8F8",
      "editor.selectionBackground": "#750000",
      "editorIndentGuide.background": "#5A0000",
    },
    RED_RULES,
  ),
  "quack-solarized-dark": solarizedDarkJson as Bundle,
  "quack-tomorrow-night-blue": tomorrowNightBlueJson as Bundle,
};
