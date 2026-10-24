/// <reference types="vitest" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    // MUI core is ~520 kB minified (160 kB gzip) on its own; app code is split from it.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Vendor code changes rarely; separate chunks stay cached across app deploys.
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom", "@tanstack/react-query"],
          mui: ["@mui/material", "@emotion/react", "@emotion/styled"],
          "mui-grid": ["@mui/x-data-grid"],
        },
      },
    },
  },
  server: {
    // In dev, the API runs separately on :8000; in prod FastAPI serves both.
    proxy: { "/api": "http://localhost:8000" },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
