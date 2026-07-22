// Lazy boundaries for the heavy editor/terminal surfaces so Monaco (~4.3 MB)
// and xterm (~250 KB) leave the eager boot chunk. Rollup only drops the
// `modulepreload` when NO static import chain from the entry reaches them, so
// every EXTERNAL consumer imports the wrappers below instead of the real
// components — the real modules are pulled via dynamic import() only when a
// surface actually renders (e.g. Agent Mode, the default layout, never opens
// an editor/terminal at boot).
//
// Leaf->leaf imports (EditorPane->DiffView, FileEditorPane->SimpleMonacoEditor)
// stay static: those leaves are themselves reached only through these dynamic
// boundaries, so their monaco deps live inside the async chunk.
//
// Each wrapper keeps the leaf's props identical (ComponentProps) so call-sites
// are unchanged — they just import from here. Suspense fallback is null, same
// as the existing MermaidPreview lazy in EditorPane; the chunk is cached after
// first load, so later mounts are instant. Lazy loading does not move DOM
// nodes, so it is orthogonal to the Monaco DOM-move gotcha (feature 012).
import { lazy, Suspense, type ComponentProps } from "react";

const EditorPaneLazy = lazy(() =>
  import("./EditorPane").then((m) => ({ default: m.EditorPane })),
);
const DiffViewLazy = lazy(() =>
  import("./DiffView").then((m) => ({ default: m.DiffView })),
);
const SimpleMonacoEditorLazy = lazy(() =>
  import("./SimpleMonacoEditor").then((m) => ({ default: m.SimpleMonacoEditor })),
);
const FileEditorPaneLazy = lazy(() =>
  import("./FileEditorPane").then((m) => ({ default: m.FileEditorPane })),
);
const TerminalCoreLazy = lazy(() =>
  import("./TerminalCore").then((m) => ({ default: m.TerminalCore })),
);

export function EditorPane(props: ComponentProps<typeof EditorPaneLazy>) {
  return (
    <Suspense fallback={null}>
      <EditorPaneLazy {...props} />
    </Suspense>
  );
}

export function DiffView(props: ComponentProps<typeof DiffViewLazy>) {
  return (
    <Suspense fallback={null}>
      <DiffViewLazy {...props} />
    </Suspense>
  );
}

export function SimpleMonacoEditor(
  props: ComponentProps<typeof SimpleMonacoEditorLazy>,
) {
  return (
    <Suspense fallback={null}>
      <SimpleMonacoEditorLazy {...props} />
    </Suspense>
  );
}

export function FileEditorPane(props: ComponentProps<typeof FileEditorPaneLazy>) {
  return (
    <Suspense fallback={null}>
      <FileEditorPaneLazy {...props} />
    </Suspense>
  );
}

export function TerminalCore(props: ComponentProps<typeof TerminalCoreLazy>) {
  return (
    <Suspense fallback={null}>
      <TerminalCoreLazy {...props} />
    </Suspense>
  );
}
