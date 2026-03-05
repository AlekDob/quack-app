import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { visualizer } from 'rollup-plugin-visualizer'
import viteCompression from 'vite-plugin-compression'
import crypto from 'node:crypto'

// Polyfill for crypto.hash() (required for Node.js <21)
if (typeof crypto.hash !== 'function') {
  (crypto as any).hash = function(algorithm: string, data: crypto.BinaryLike, outputEncoding?: crypto.BinaryToTextEncoding) {
    return crypto.createHash(algorithm).update(data).digest(outputEncoding as any);
  };
}

const rootDir = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production'
  const isDevelopment = mode === 'development'
  const isTauriDebug = !!process.env.TAURI_DEBUG

  return {
    // CRITICAL: Use relative paths for Tauri production builds
    // Without this, assets use absolute paths (/assets/) which don't work in tauri://localhost/
    base: './',

    // Fix for Vite 7 crypto.hash error
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode),
    },

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
      // Watch configuration - exclude worktrees to prevent page reload when creating task worktrees
      watch: {
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/.worktrees/**',  // Ignore Git worktrees created for Kanban tasks
          '**/dist/**',
          '**/.quack/**',
        ],
      },
    },

    envPrefix: ['VITE_', 'TAURI_'],

    build: {
      // Target modern browsers for smaller bundles
      target: process.env.TAURI_PLATFORM === 'windows'
        ? ['chrome105', 'edge105']
        : ['safari15', 'chrome105'],

      // Minification settings
      // IMPORTANT: Use esbuild instead of terser for React 19 compatibility
      // Terser can incorrectly remove React internals like useLayoutEffect
      minify: isProduction && !isTauriDebug ? 'esbuild' : false,

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
          'terminal-window': resolve(rootDir, 'terminal-window.html'),
          pip: resolve(rootDir, 'pip.html'),
          browser: resolve(rootDir, 'browser.html'),
          'tab-popout': resolve(rootDir, 'tab-popout.html'),
          brain: resolve(rootDir, 'brain.html'),
        },

        // External dependencies - only Claude Agent SDK runs in Node.js subprocess
        // IMPORTANT: Do NOT externalize Node.js builtins (fs, path, etc.)
        // They must be replaced with empty polyfills via resolve.alias
        external: (id: string) => {
          // Only externalize Claude SDK - it runs in Node.js subprocess, not browser
          if (id.includes('@anthropic-ai/claude-agent-sdk')) {
            return true;
          }
          return false;
        },

        output: {
          // Manual chunking strategy for optimal code splitting
          manualChunks: (id) => {
            // XTerm - Terminal library, self-contained (~150KB)
            if (id.includes('@xterm/xterm') || id.includes('xterm')) {
              return 'xterm';
            }

            // Claude SDK - AI library, self-contained (~100KB)
            if (id.includes('@anthropic-ai/claude-agent-sdk') || id.includes('@anthropic-ai/sdk')) {
              return 'claude-sdk';
            }

            // Mermaid - Diagrams library, self-contained
            if (id.includes('mermaid')) {
              return 'mermaid';
            }

            // Tauri plugins - self-contained
            if (id.includes('@tauri-apps/')) {
              return 'tauri-vendor';
            }

            // All other node_modules in a single vendor chunk
            // IMPORTANT: Do NOT split React from other deps — causes circular
            // chunk dependencies that make React undefined at runtime
            // Brain: gotcha-vendor-circular-chunk-dependency
            if (id.includes('node_modules')) {
              return 'vendor';
            }
          },

          // Naming strategy for chunks
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',

          // Optimize for tree-shaking
          compact: isProduction,
        },

        // Tree-shaking options - be careful not to remove React internals
        treeshake: isProduction ? {
          // IMPORTANT: Keep moduleSideEffects true for React to work properly
          // Setting to false was removing useLayoutEffect and other React internals
          moduleSideEffects: true,
          propertyReadSideEffects: false,
          tryCatchDeoptimization: false,
        } : false,
      },
    },

    // Resolve aliases for Node.js modules that shouldn't be bundled
    resolve: {
      alias: {
        // Provide empty module for Node.js built-ins that some libraries try to import
        // This fixes the "Module name, 'fs' does not resolve to a valid URL" error
        // caused by @anthropic-ai/sdk importing fs, path, url, etc.
        'fs': resolve(rootDir, 'src/polyfills/empty-module.ts'),
        'path': resolve(rootDir, 'src/polyfills/empty-module.ts'),
        'os': resolve(rootDir, 'src/polyfills/empty-module.ts'),
        'crypto': resolve(rootDir, 'src/polyfills/empty-module.ts'),
        'url': resolve(rootDir, 'src/polyfills/empty-module.ts'),
        'util': resolve(rootDir, 'src/polyfills/empty-module.ts'),
        'stream': resolve(rootDir, 'src/polyfills/empty-module.ts'),
        'events': resolve(rootDir, 'src/polyfills/empty-module.ts'),
        'child_process': resolve(rootDir, 'src/polyfills/empty-module.ts'),
        'readline': resolve(rootDir, 'src/polyfills/empty-module.ts'),
        'fs/promises': resolve(rootDir, 'src/polyfills/empty-module.ts'),
        // Also handle node: prefix imports
        'node:fs': resolve(rootDir, 'src/polyfills/empty-module.ts'),
        'node:path': resolve(rootDir, 'src/polyfills/empty-module.ts'),
        'node:os': resolve(rootDir, 'src/polyfills/empty-module.ts'),
        'node:crypto': resolve(rootDir, 'src/polyfills/empty-module.ts'),
        'node:url': resolve(rootDir, 'src/polyfills/empty-module.ts'),
        'node:util': resolve(rootDir, 'src/polyfills/empty-module.ts'),
        'node:stream': resolve(rootDir, 'src/polyfills/empty-module.ts'),
        'node:events': resolve(rootDir, 'src/polyfills/empty-module.ts'),
        'node:child_process': resolve(rootDir, 'src/polyfills/empty-module.ts'),
        'node:readline': resolve(rootDir, 'src/polyfills/empty-module.ts'),
        'node:fs/promises': resolve(rootDir, 'src/polyfills/empty-module.ts'),
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
      ],
      exclude: [
        '@anthropic-ai/claude-agent-sdk', // Don't pre-bundle SDK
      ],
      // Force dependency optimization
      force: isDevelopment,

      // Configure Node.js polyfills for Tauri
      esbuildOptions: {
        define: {
          global: 'globalThis',
        },
      },
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