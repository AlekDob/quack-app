import React from "react";
import ReactDOM from "react-dom/client";
import JackApp from "./components/jack/JackApp";
import { applyAccentColor, DEFAULT_ACCENT } from "./utils/accentColor";
import "./index.css";

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

ReactDOM.createRoot(document.getElementById("jack-root")!).render(
  <React.StrictMode>
    <JackApp />
  </React.StrictMode>
);
