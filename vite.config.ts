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
    // Group the heavy deps into their own chunks. NOTE: manualChunks only
    // splits WHERE code lands — it does NOT defer loading. What actually
    // keeps Monaco/xterm off the boot path (and drops their modulepreload)
    // is that every consumer imports them via React.lazy (`lazyHeavy.tsx`),
    // so no static import chain from the entry reaches them. Mermaid is
    // lazy the same way. This block just makes those async chunks explicit
    // and stable across builds.
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React MUST get its own chunk BEFORE monaco/mermaid. Otherwise
          // Rollup co-locates the shared React runtime inside the big monaco
          // chunk, and since the entry needs React it ends up statically
          // importing (and modulepreloading) monaco — defeating the lazy
          // split. With React isolated, the entry depends on `react` (needed
          // at boot anyway) and monaco stays purely dynamic.
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/react/jsx-runtime") ||
            id.includes("node_modules/scheduler/") ||
            // Vite's dynamic-import preload helper. If left unassigned Rollup
            // hoists it into the biggest importer (monaco), and since the
            // entry uses it for its OWN dynamic imports the entry then
            // statically imports monaco. Pin it next to react (always loaded).
            id.includes("vite/preload-helper")
          ) {
            return "react";
          }
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
