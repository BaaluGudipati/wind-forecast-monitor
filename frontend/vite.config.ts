import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev, /api is proxied to the FastAPI server (uvicorn on :8000).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": process.env.API_PROXY_TARGET ?? "http://localhost:8001" },
  },
  build: {
    rollupOptions: {
      // Keep the charting library in its own long-cached chunk.
      output: { manualChunks: { recharts: ["recharts"], react: ["react", "react-dom"] } },
    },
    chunkSizeWarningLimit: 600,
  },
});
