import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // When Steve wires up the backend, point this at the API/auth server.
    // The front-end talks to /api and /auth; everything else is static.
    proxy: {
      "/api": "http://localhost:3003",
      "/auth": "http://localhost:3003",
    },
  },
});
