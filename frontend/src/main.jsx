import React from "react";
import ReactDOM from "react-dom/client";
import "./heroui.css";
import { AppProviders } from "./app/AppProviders.jsx";
import { App } from "./app/App.jsx";
import { loadExpandedDemoData } from "./features/demo/load.js";
import { LiveApp } from "./features/live/LiveApp.jsx";

const demo = import.meta.env.VITE_PANTRY_MODE === "demo";
if (demo) loadExpandedDemoData();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppProviders>{demo ? <App /> : <LiveApp />}</AppProviders>
  </React.StrictMode>,
);
