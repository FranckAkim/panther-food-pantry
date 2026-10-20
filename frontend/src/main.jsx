import { LoadingProvider } from "./components/Loading.jsx";
import React from "react";
import ReactDOM from "react-dom/client";
import { HeroUIProvider } from "@heroui/system";
import "./heroui.css";
import { NotificationProvider } from "./components/Notifications.jsx";
import App from "./App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HeroUIProvider><NotificationProvider><LoadingProvider><App /></LoadingProvider></NotificationProvider></HeroUIProvider>
  </React.StrictMode>
);
