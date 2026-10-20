import React from "react";
import ReactDOM from "react-dom/client";
import "./heroui.css";
import { AppProviders } from "./app/AppProviders.jsx";
import { App } from "./app/App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </React.StrictMode>,
);
