import { getJson, setJson } from "./localStore";

export type EditorMdView = "edit" | "split" | "preview";

const STORAGE_KEY = "lcp.editorMdView";

export function isMarkdownPath(path: string): boolean {
  return /\.mdx?$/i.test(path);
}

export function readEditorMdView(): EditorMdView {
  const raw = getJson<string>(STORAGE_KEY, "edit", (v): v is string => typeof v === "string");
  if (raw === "split" || raw === "preview") return raw;
  return "edit";
}

export function writeEditorMdView(view: EditorMdView): void {
  setJson(STORAGE_KEY, view);
}
