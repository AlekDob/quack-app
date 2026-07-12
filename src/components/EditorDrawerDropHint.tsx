import { useDrag } from "../dragState";

interface Props {
  wsId: string;
}

/** Right-edge glow while dragging a tab into the drawer drop zone. */
export function EditorDrawerDropHint({ wsId }: Props) {
  const drag = useDrag();
  if (!drag || drag.wsId !== wsId || !drag.drawerDrop) return null;
  return <div className="editor-drawer-drop-hint" aria-hidden="true" />;
}
