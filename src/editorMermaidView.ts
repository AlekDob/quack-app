import { getJson, setJson } from "./localStore";
import type { EditorMdView } from "./editorMdView";

const STORAGE_KEY = "lcp.editorMermaidView";

export function isMermaidPath(path: string): boolean {
  return /\.mmd$/i.test(path);
}

/** Mermaid tabs default to preview — diagrams are the primary surface. */
export function readEditorMermaidView(): EditorMdView {
  const raw = getJson<string>(STORAGE_KEY, "preview", (v): v is string => typeof v === "string");
  if (raw === "edit" || raw === "split" || raw === "preview") return raw;
  return "preview";
}

export function writeEditorMermaidView(view: EditorMdView): void {
  setJson(STORAGE_KEY, view);
}
