import { getJson, setJson } from "./localStore";
import type { EditorMdView } from "./editorMdView";
export { isHtmlPath } from "./htmlPreview";

const STORAGE_KEY = "lcp.editorHtmlView";

/** HTML tabs default to preview — the rendered page is the primary surface. */
export function readEditorHtmlView(): EditorMdView {
  const raw = getJson<string>(STORAGE_KEY, "preview", (v): v is string => typeof v === "string");
  if (raw === "edit" || raw === "split" || raw === "preview") return raw;
  return "preview";
}

export function writeEditorHtmlView(view: EditorMdView): void {
  setJson(STORAGE_KEY, view);
}
