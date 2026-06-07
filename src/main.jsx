import React from "react";
import { createRoot } from "react-dom/client";
import "./tailwind.css";
import App from "./App.jsx";
import { ConfigProvider } from "./lib/configContext.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ConfigProvider>
      <App />
    </ConfigProvider>
  </React.StrictMode>
);
