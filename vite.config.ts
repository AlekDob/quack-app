import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { visualizer } from 'rollup-plugin-visualizer'
import viteCompression from 'vite-plugin-compression'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production'
  const isDevelopment = mode === 'development'
  const isTauriDebug = !!process.env.TAURI_DEBUG

  return {
    plugins: [
      react(),

      // Bundle analyzer - creates stats.html with bundle visualization
      isProduction && visualizer({
        open: false, // Don't auto-open browser
        gzipSize: true,
        brotliSize: true,
        filename: './dist/stats.html',
        template: 'treemap', // or 'sunburst', 'network'
      }),

      // Gzip compression for production
      isProduction && viteCompression({
        algorithm: 'gzip',
        ext: '.gz',
        threshold: 10240, // Only compress files > 10KB
        deleteOriginFile: false,
      }),

      // Brotli compression (better than gzip)
      isProduction && viteCompression({
        algorithm: 'brotliCompress',
        ext: '.br',
        threshold: 10240,
        deleteOriginFile: false,
      }),
    ].filter(Boolean),

    clearScreen: false,

    server: {
      port: 5174,
      strictPort: true,
      host: process.env.TAURI_DEV_HOST,
    },

    envPrefix: ['VITE_', 'TAURI_'],

    build: {
      // Target modern browsers for smaller bundles
      target: process.env.TAURI_PLATFORM === 'windows'
        ? ['chrome105', 'edge105']
        : ['safari15', 'chrome105'],

      // Minification settings
      minify: isProduction && !isTauriDebug ? 'terser' : false,

      // Source maps
      sourcemap: isTauriDebug ? 'inline' : false,

      // Chunk size warning
      chunkSizeWarningLimit: 600, // 600KB per chunk

      // Report compressed sizes
      reportCompressedSize: true,

      // CSS code splitting
      cssCodeSplit: true,

      // Asset inlining threshold
      assetsInlineLimit: 4096, // 4KB

      // Rollup options
      rollupOptions: {
        input: {
          main: resolve(rootDir, 'index.html'),
          preview: resolve(rootDir, 'preview.html'),
          terminal: resolve(rootDir, 'terminal.html'),
          pip: resolve(rootDir, 'pip.html'),
          browser: resolve(rootDir, 'browser.html'),
        },

        output: {
          // Manual chunking strategy for optimal code splitting
          manualChunks: (id) => {
            // Monaco Editor - HEAVY (~300KB) - Load on demand
            if (id.includes('monaco-editor') || id.includes('@monaco-editor')) {
              return 'monaco-editor';
            }

            // XTerm - Terminal library (~150KB)
            if (id.includes('@xterm/xterm') || id.includes('xterm')) {
              return 'xterm';
            }

            // Claude SDK - AI library (~100KB)
            if (id.includes('@anthropic-ai/claude-agent-sdk') || id.includes('@anthropic-ai/sdk')) {
              return 'claude-sdk';
            }

            // Mermaid - Diagrams library (if used)
            if (id.includes('mermaid')) {
              return 'mermaid';
            }

            // React core libraries
            if (id.includes('node_modules') && (
              id.includes('react/') ||
              id.includes('react-dom/') ||
              id.includes('scheduler/')
            )) {
              return 'react-vendor';
            }

            // UI libraries
            if (id.includes('lucide-react') ||
                id.includes('sonner') ||
                id.includes('react-hotkeys-hook') ||
                id.includes('react-colorful')) {
              return 'ui-vendor';
            }

            // Tauri plugins
            if (id.includes('@tauri-apps/')) {
              return 'tauri-vendor';
            }

            // Settings and forms
            if (id.includes('/components/settings/')) {
              return 'settings';
            }

            // Drawers and modals (lazy loaded)
            if (id.includes('/components/') && (
              id.includes('Drawer') ||
              id.includes('Modal') ||
              id.includes('QuackAgency') ||
              id.includes('Marketplace')
            )) {
              return 'drawers-modals';
            }

            // Git components
            if (id.includes('/components/Git')) {
              return 'git-components';
            }

            // AI Assistant components
            if (id.includes('/components/AI') ||
                id.includes('/components/Chat') ||
                id.includes('/components/Stream')) {
              return 'ai-assistant';
            }

            // Terminal components
            if (id.includes('/components/Terminal')) {
              return 'terminal-components';
            }

            // Everything else from node_modules
            if (id.includes('node_modules')) {
              return 'vendor';
            }
          },

          // Naming strategy for chunks
          chunkFileNames: (chunkInfo) => {
            const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split('/').pop() : '';
            if (facadeModuleId && facadeModuleId.includes('monaco')) {
              return 'assets/monaco-[hash].js';
            }
            return 'assets/[name]-[hash].js';
          },
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',

          // Optimize for tree-shaking
          compact: isProduction,

          // External dependencies (if any)
          // external: [],
        },

        // Tree-shaking options
        treeshake: isProduction ? {
          moduleSideEffects: false,
          propertyReadSideEffects: false,
          tryCatchDeoptimization: false,
        } : false,
      },
    },

    // Optimize dependency pre-bundling
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        '@tauri-apps/api',
        '@tauri-apps/plugin-dialog',
        '@tauri-apps/plugin-notification',
        '@tauri-apps/plugin-store',
        'lucide-react',
        'sonner',
        'react-hotkeys-hook',
      ],
      exclude: [
        '@anthropic-ai/claude-agent-sdk', // Don't pre-bundle SDK
        'monaco-editor', // Too big, handle separately
      ],
      // Force dependency optimization
      force: isDevelopment,
    },

    // CSS options
    css: {
      devSourcemap: isDevelopment,
      // PostCSS config is in postcss.config.js
    },

    // JSON handling
    json: {
      namedExports: true,
      stringify: false,
    },

    // Worker options (if using web workers)
    worker: {
      format: 'es',
      rollupOptions: {
        output: {
          entryFileNames: 'assets/worker-[name]-[hash].js',
        },
      },
    },

    // Asset handling
    assetsInclude: ['**/*.png', '**/*.jpg', '**/*.svg', '**/*.woff2'],
  }
})