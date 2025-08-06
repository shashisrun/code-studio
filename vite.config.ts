import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// Safely access process.env in a way that works in both browser and Node.js environments
const host = typeof process !== 'undefined' && process.env ? process.env.TAURI_DEV_HOST : undefined;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [
    preact(),
    tailwindcss()
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "react": "preact/compat",
      "react-dom": "preact/compat",
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 5173,
    strictPort: true,
    host: host || false,
    hmr: {
      host: 'localhost',
      port: 5173,
      protocol: 'ws'
    },
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
