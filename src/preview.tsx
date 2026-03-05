import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import PreviewPanel from "./components/PreviewPanel";
import { PreviewManagerProvider } from "./composables/usePreviewManager";

const rootElement = document.getElementById("preview-root");

if (!rootElement) {
  throw new Error("Elemento root per la preview non trovato");
}

createRoot(rootElement).render(
  <StrictMode>
    <PreviewManagerProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-[#0d1017] text-slate-100">
        <PreviewPanel />
      </div>
    </PreviewManagerProvider>
  </StrictMode>,
);
