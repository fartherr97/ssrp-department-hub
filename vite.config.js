import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Dev proxy to the backend (server/): the front-end talks to /api and /auth,
    // everything else is served statically by Vite. Run `npm run server` alongside
    // `npm run dev` so these resolve.
    proxy: {
      "/api": "http://localhost:3003",
      "/auth": "http://localhost:3003",
    },
  },
});
