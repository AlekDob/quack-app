import { getJson, setJson } from "./localStore";

const STORAGE_KEY = "lcp.editorDiffSideBySide";

/** Default inline — better in narrow panes; user can switch to side-by-side. */
export function readDiffSideBySide(): boolean {
  return getJson<boolean>(
    STORAGE_KEY,
    false,
    (v): v is boolean => typeof v === "boolean",
  );
}

export function writeDiffSideBySide(sideBySide: boolean): void {
  setJson(STORAGE_KEY, sideBySide);
}
