import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";

import "@fontsource-variable/jetbrains-mono";
import "./index.css";

import { appHistory } from "./appNavigation";
import { getRouter } from "./router";
import { APP_DISPLAY_NAME } from "./branding";
import { isElectron } from "./env";
import { UsageNotchSurface } from "./components/usage-notch/UsageNotchSurface";
import { UsageNotchLogoSurface } from "./components/usage-notch/UsageNotchLogoSurface";

document.title = APP_DISPLAY_NAME;

if (isElectron) {
  document.documentElement.dataset.runtime = "electron";
}

const surface = new URLSearchParams(window.location.search).get("surface");
const isUsageNotchSurface = surface === "usage-notch";
const isUsageNotchLogoSurface = surface === "usage-notch-logo";
const router = isUsageNotchSurface || isUsageNotchLogoSurface ? null : getRouter(appHistory);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {isUsageNotchSurface ? (
      <UsageNotchSurface />
    ) : isUsageNotchLogoSurface ? (
      <UsageNotchLogoSurface />
    ) : (
      <RouterProvider router={router!} />
    )}
  </React.StrictMode>,
);
