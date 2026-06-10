import React from "react";
import { createRoot } from "react-dom/client";
import "./tailwind.css";
import App from "./App.jsx";
import { ConfigProvider } from "./lib/configContext.jsx";

/*
 * Stale-deploy recovery. Pages are lazy-loaded chunks with hashed filenames;
 * after a redeploy, a tab opened on the old build 404s when it loads a page
 * it hasn't visited yet ("Failed to fetch dynamically imported module").
 * Reload once to pick up the new build, with a cooldown so a genuinely
 * broken deploy can't cause a reload loop.
 */
window.addEventListener("vite:preloadError", (event) => {
  const last = Number(sessionStorage.getItem("chunk-reload-at") || 0);
  if (Date.now() - last > 10_000) {
    event.preventDefault();
    sessionStorage.setItem("chunk-reload-at", String(Date.now()));
    window.location.reload();
  }
});

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ConfigProvider>
      <App />
    </ConfigProvider>
  </React.StrictMode>
);
