import React from "react";
import ReactDOM from "react-dom/client";
import PipWindow from "./components/PipWindow";
import "./index.css";

ReactDOM.createRoot(document.getElementById("pip-root")!).render(
  <React.StrictMode>
    <PipWindow />
  </React.StrictMode>
);
