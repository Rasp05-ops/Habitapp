import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev: the browser talks to Vite, Vite forwards /api to the backend. No CORS pain.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:8000" } },
});
