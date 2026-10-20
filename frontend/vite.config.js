import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// In development the React dev server runs on :5173 and forwards /api to
// FastAPI on :8000, so the browser still sees a single origin.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return "react";
          if (/node_modules\/(@heroui|@react-aria|@react-stately|@react-types|@internationalized|framer-motion|motion-dom|motion-utils)\//.test(id)) return "heroui";
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: { "/api": process.env.API_URL || "http://localhost:8000" },
  },
});
