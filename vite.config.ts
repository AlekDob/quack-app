import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import pkg from "./package.json" with { type: "json" };

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],
  // Inject the package.json version into the bundle so the splash screen
  // (and any other UI that shows version) doesn't drift behind releases.
  // Was a hand-maintained constant — got stuck on v0.2.0 while the app
  // shipped v0.3.x.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },

  build: {
    // Keep Monaco + Mermaid out of the main entry chunk so first paint /
    // splash stays lighter. Mermaid is already dynamic-imported; this
    // makes the split explicit and stable across builds.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("node_modules/monaco-editor") ||
            id.includes("node_modules/@monaco-editor")
          ) {
            return "monaco";
          }
          if (
            id.includes("node_modules/mermaid") ||
            id.includes("node_modules/cytoscape") ||
            id.includes("node_modules/katex")
          ) {
            return "mermaid";
          }
        },
      },
    },
    chunkSizeWarningLimit: 1200,
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 5180,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 5181,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
