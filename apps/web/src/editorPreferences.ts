import { EditorId, NativeApi } from "@synara/contracts";
import { getLocalStorageItem, useLocalStorage } from "./hooks/useLocalStorage";

const LAST_EDITOR_KEY = "synara:last-editor";

export function usePreferredEditor(availableEditors: ReadonlyArray<EditorId>) {
  const [lastEditor, setLastEditor] = useLocalStorage(LAST_EDITOR_KEY, null, EditorId);

  let effectiveEditor: EditorId | null;
  if (lastEditor && availableEditors.includes(lastEditor)) {
    effectiveEditor = lastEditor;
  } else {
    // Do not infer a preference from installation order. Opening an external
    // editor is an explicit user action, so the first run must stay unassigned.
    effectiveEditor = null;
  }

  return [effectiveEditor, setLastEditor] as const;
}

export function resolveAndPersistPreferredEditor(
  availableEditors: readonly EditorId[],
): EditorId | null {
  const availableEditorIds = new Set(availableEditors);
  const stored = getLocalStorageItem(LAST_EDITOR_KEY, EditorId);
  if (stored && availableEditorIds.has(stored)) return stored;
  return null;
}

export async function openInPreferredEditor(api: NativeApi, targetPath: string): Promise<EditorId> {
  const { availableEditors } = await api.server.getConfig();
  const editor = resolveAndPersistPreferredEditor(availableEditors);
  if (!editor) throw new Error("No available editors found.");
  await api.shell.openInEditor(targetPath, editor);
  return editor;
}
