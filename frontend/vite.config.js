import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8080", // Use 8080 if your backend runs on this port locally
        // NOTE: This proxy is ONLY for local development.
        // In production (Vercel), your frontend must use the public Railway URL via VITE_API_URL env variable in your code.
        changeOrigin: true
      }
    }
  }
});

