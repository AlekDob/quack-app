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

document.title = APP_DISPLAY_NAME;

if (isElectron) {
  document.documentElement.dataset.runtime = "electron";
}

const isUsageNotchSurface =
  new URLSearchParams(window.location.search).get("surface") === "usage-notch";
const router = isUsageNotchSurface ? null : getRouter(appHistory);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {isUsageNotchSurface ? <UsageNotchSurface /> : <RouterProvider router={router!} />}
  </React.StrictMode>,
);
