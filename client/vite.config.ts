import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    // Add this proxy configuration
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
        changeOrigin: true
      }
    },
    allowedHosts: [
      ".ngrok-free.app",
      ".ngrok.io",
      ".ngrok.app",
      ".ngrok.dev",
    ],
    hmr: {
      protocol: "wss",
      clientPort: 443,
    },
  },
});