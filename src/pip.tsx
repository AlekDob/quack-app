import React from "react";
import ReactDOM from "react-dom/client";
import PipWindow from "./components/PipWindow";
import { applyAccentColor, DEFAULT_ACCENT } from "./utils/accentColor";
import "./index.css";

// Apply accent color from persisted settings so PiP matches main window theme
try {
  const raw = localStorage.getItem('settings-storage');
  if (raw) {
    const parsed = JSON.parse(raw);
    const hex = parsed?.state?.appearance?.accentColor;
    if (hex) applyAccentColor(hex);
  }
} catch {
  applyAccentColor(DEFAULT_ACCENT);
}

ReactDOM.createRoot(document.getElementById("pip-root")!).render(
  <React.StrictMode>
    <PipWindow />
  </React.StrictMode>
);
