import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development the React dev server runs on :5173 and forwards /api to
// FastAPI on :8000, so the browser still sees a single origin.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: { "/api": process.env.API_URL || "http://localhost:8000" },
  },
});
