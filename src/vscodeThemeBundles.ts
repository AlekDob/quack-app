import type { editor } from "monaco-editor";
import monokaiJson from "./vscodeThemes/Monokai.json";
import solarizedDarkJson from "./vscodeThemes/Solarized-dark.json";
import solarizedLightJson from "./vscodeThemes/Solarized-light.json";
import tomorrowNightBlueJson from "./vscodeThemes/Tomorrow-Night-Blue.json";

type Bundle = editor.IStandaloneThemeData;

function dark(
  colors: Record<string, string>,
  rules: editor.ITokenThemeRule[] = [],
): Bundle {
  return { base: "vs-dark", inherit: true, colors, rules };
}

function light(
  colors: Record<string, string>,
  rules: editor.ITokenThemeRule[] = [],
): Bundle {
  return { base: "vs", inherit: true, colors, rules };
}

const darkPlusRules: editor.ITokenThemeRule[] = [
  { token: "entity.name.function", foreground: "DCDCAA" },
  { token: "support.function", foreground: "DCDCAA" },
  { token: "support.type", foreground: "4EC9B0" },
  { token: "entity.name.type", foreground: "4EC9B0" },
  { token: "keyword.control", foreground: "C586C0" },
  { token: "variable", foreground: "9CDCFE" },
  { token: "entity.name.tag", foreground: "569CD6" },
  { token: "constant.numeric", foreground: "B5CEA8" },
  {
    token: "constant.other.color.rgb-value",
    foreground: "CE9178",
  },
  { token: "string", foreground: "CE9178" },
  { token: "comment", foreground: "6A9955" },
];

const lightPlusRules: editor.ITokenThemeRule[] = [
  { token: "entity.name.function", foreground: "795E26" },
  { token: "support.type", foreground: "267F99" },
  { token: "keyword.control", foreground: "AF00DB" },
  { token: "variable", foreground: "001080" },
  { token: "constant.numeric", foreground: "098658" },
  { token: "string", foreground: "A31515" },
  { token: "comment", foreground: "008000" },
];

const abyssRules: editor.ITokenThemeRule[] = [
  { token: "", foreground: "6688CC" },
  { token: "comment", foreground: "384887" },
  { token: "string", foreground: "22AA44" },
  { token: "constant.numeric", foreground: "F280D0" },
  { token: "keyword", foreground: "225588" },
  { token: "storage.type", foreground: "9966B8", fontStyle: "italic" },
  { token: "entity.name.function", foreground: "DDBB88" },
  { token: "entity.name.tag", foreground: "225588" },
  { token: "entity.other.attribute-name", foreground: "DDBB88" },
];

const kimbieRules: editor.ITokenThemeRule[] = [
  { token: "", foreground: "D3AF86" },
  { token: "comment", foreground: "A57A4C" },
  { token: "keyword", foreground: "98676A" },
  { token: "variable", foreground: "DC3958" },
  { token: "entity.name.function", foreground: "8AB1B0" },
  { token: "entity.name.class", foreground: "F06431" },
  { token: "string", foreground: "889B4A" },
  { token: "constant.numeric", foreground: "F79A32" },
  { token: "entity.name.tag", foreground: "DC3958" },
];

/** Monaco `defineTheme` payloads for Quack custom / VS Code bundled themes. */
export const VS_CODE_THEME_BUNDLES: Record<string, Bundle> = {
  "quack-light-modern": light({
    "editor.background": "#FFFFFF",
    "editor.foreground": "#3B3B3B",
    "editorLineNumber.foreground": "#6E7681",
    "editorLineNumber.activeForeground": "#3B3B3B",
    "editor.selectionBackground": "#ADD6FF80",
    "editorIndentGuide.background": "#D4D4D4",
  }),
  "quack-light-plus": light(
    {
      "editor.background": "#FFFFFF",
      "editor.foreground": "#000000",
      "editorLineNumber.foreground": "#237893",
      "editorLineNumber.activeForeground": "#0B216F",
      "editor.selectionBackground": "#ADD6FF",
      "editorIndentGuide.background": "#D3D3D3",
    },
    lightPlusRules,
  ),
  "quack-quiet-light": light({
    "editor.background": "#F5F5F5",
    "editor.foreground": "#333333",
    "editorLineNumber.foreground": "#AAAAAA",
    "editorLineNumber.activeForeground": "#333333",
    "editor.selectionBackground": "#C9D0D9",
    "editorIndentGuide.background": "#E0E0E0",
  }),
  "quack-solarized-light": solarizedLightJson as Bundle,
  "quack-dark-modern": dark({
    "editor.background": "#1F1F1F",
    "editor.foreground": "#CCCCCC",
    "editorLineNumber.foreground": "#6E7681",
    "editorLineNumber.activeForeground": "#CCCCCC",
    "editor.selectionBackground": "#264F7844",
    "editorIndentGuide.background": "#404040",
  }),
  "quack-dark-plus": dark(
    {
      "editor.background": "#1E1E1E",
      "editor.foreground": "#D4D4D4",
      "editorLineNumber.foreground": "#858585",
      "editorLineNumber.activeForeground": "#C6C6C6",
      "editor.selectionBackground": "#264F78",
      "editorIndentGuide.background": "#404040",
    },
    darkPlusRules,
  ),
  "quack-abyss": dark(
    {
      "editor.background": "#000C18",
      "editor.foreground": "#6688CC",
      "editorLineNumber.foreground": "#406385",
      "editorLineNumber.activeForeground": "#80A2C2",
      "editor.selectionBackground": "#770811",
      "editorIndentGuide.background": "#002952",
    },
    abyssRules,
  ),
  "quack-kimbie-dark": dark(
    {
      "editor.background": "#221A0F",
      "editor.foreground": "#D3AF86",
      "editorLineNumber.foreground": "#ADADAD",
      "editorLineNumber.activeForeground": "#ADADAD",
      "editor.selectionBackground": "#84613DAA",
      "editorIndentGuide.background": "#5E452B",
    },
    kimbieRules,
  ),
  "quack-monokai": monokaiJson as Bundle,
  "quack-monokai-dimmed": dark({
    "editor.background": "#1E1E1E",
    "editor.foreground": "#C5C8C6",
    "editorLineNumber.foreground": "#777777",
    "editorLineNumber.activeForeground": "#C5C8C6",
    "editor.selectionBackground": "#676B7180",
    "editorIndentGuide.background": "#464646",
  }),
  "quack-red": dark({
    "editor.background": "#390000",
    "editor.foreground": "#F8F8F8",
    "editorLineNumber.foreground": "#FF7777",
    "editorLineNumber.activeForeground": "#F8F8F8",
    "editor.selectionBackground": "#750000",
    "editorIndentGuide.background": "#5A0000",
  }),
  "quack-solarized-dark": solarizedDarkJson as Bundle,
  "quack-tomorrow-night-blue": tomorrowNightBlueJson as Bundle,
};
