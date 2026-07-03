import type { editor } from "monaco-editor";

/** Monaco tokenizer names — NOT VS Code TextMate scopes. */
export function darkRules(
  defaults: { fg: string; comment: string; keyword: string; string: string; number: string; type: string },
  extra: editor.ITokenThemeRule[] = [],
): editor.ITokenThemeRule[] {
  const { fg, comment, keyword, string, number, type } = defaults;
  return [
    { token: "", foreground: fg },
    { token: "comment", foreground: comment, fontStyle: "italic" },
    { token: "keyword", foreground: keyword },
    { token: "string", foreground: string },
    { token: "number", foreground: number },
    { token: "regexp", foreground: string },
    { token: "type", foreground: type },
    { token: "type.identifier", foreground: type },
    { token: "namespace", foreground: type },
    { token: "variable", foreground: fg },
    { token: "variable.predefined", foreground: keyword },
    { token: "identifier", foreground: fg },
    { token: "operator", foreground: fg },
    { token: "delimiter", foreground: fg },
    { token: "tag", foreground: keyword },
    { token: "attribute.name", foreground: type },
    { token: "attribute.value", foreground: string },
    { token: "metatag", foreground: keyword },
    ...extra,
  ];
}

export const VS_DARK_RULES = darkRules({
  fg: "D4D4D4",
  comment: "6A9955",
  keyword: "569CD6",
  string: "CE9178",
  number: "B5CEA8",
  type: "4EC9B0",
});

export const VS_LIGHT_RULES = darkRules({
  fg: "000000",
  comment: "008000",
  keyword: "0000FF",
  string: "A31515",
  number: "098658",
  type: "267F99",
});

export const DARK_PLUS_RULES = darkRules(
  {
    fg: "D4D4D4",
    comment: "6A9955",
    keyword: "569CD6",
    string: "CE9178",
    number: "B5CEA8",
    type: "4EC9B0",
  },
  [
    { token: "keyword.control", foreground: "C586C0" },
    { token: "variable", foreground: "9CDCFE" },
    { token: "identifier", foreground: "9CDCFE" },
  ],
);

export const LIGHT_PLUS_RULES = darkRules(
  {
    fg: "000000",
    comment: "008000",
    keyword: "0000FF",
    string: "A31515",
    number: "098658",
    type: "267F99",
  },
  [
    { token: "keyword.control", foreground: "AF00DB" },
    { token: "variable", foreground: "001080" },
    { token: "identifier", foreground: "001080" },
  ],
);

export const ABYSS_RULES = darkRules({
  fg: "6688CC",
  comment: "384887",
  keyword: "225588",
  string: "22AA44",
  number: "F280D0",
  type: "9966B8",
});

export const KIMBIE_RULES = darkRules({
  fg: "D3AF86",
  comment: "A57A4C",
  keyword: "98676A",
  string: "889B4A",
  number: "F79A32",
  type: "F06431",
});

export const MONOKAI_DIMMED_RULES = darkRules({
  fg: "C5C8C6",
  comment: "9A9B99",
  keyword: "676867",
  string: "9AA83A",
  number: "6089B4",
  type: "9872A2",
});

export const RED_RULES = darkRules({
  fg: "F8F8F8",
  comment: "9A9B99",
  keyword: "FF7777",
  string: "CE9178",
  number: "B5CEA8",
  type: "FF9999",
});
