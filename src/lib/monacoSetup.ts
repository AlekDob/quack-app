/**
 * Monaco Editor Setup for Vite + Tauri Production Builds
 *
 * This module configures Monaco Editor to work correctly in both development
 * and production builds by using Vite's native worker bundling.
 *
 * The Problem:
 * - In production (Tauri), Monaco CDN workers don't load due to CORS/timing issues
 * - Syntax highlighting requires web workers for language services
 *
 * The Solution:
 * - Use Vite's `?worker` import syntax to bundle workers locally
 * - Configure `self.MonacoEnvironment.getWorker` to return the correct worker
 * - This ensures workers are same-origin and load synchronously
 *
 * References:
 * - https://github.com/vitejs/vite/discussions/1791
 * - https://github.com/microsoft/monaco-editor/blob/main/docs/integrate-esm.md
 * - https://www.codelantis.com/blog/sveltekit-monaco-editor
 */

// Import Monaco workers using Vite's ?worker suffix
// These will be bundled and served from the same origin
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

// Flag to track if setup has been run
let isSetup = false;

/**
 * Configure Monaco Environment for Vite builds
 * This MUST be called before any Monaco Editor component renders
 */
export function setupMonacoEnvironment(): void {
  if (isSetup) {
    console.log('[Monaco Setup] Already configured, skipping...');
    return;
  }

  if (typeof window === 'undefined') {
    console.warn('[Monaco Setup] Window not available, skipping...');
    return;
  }

  console.log('[Monaco Setup] Configuring Monaco workers for Vite...');

  // Configure MonacoEnvironment with getWorker function
  // This is the recommended approach for Vite (NOT getWorkerUrl)
  (self as unknown as { MonacoEnvironment: { getWorker: (_: string, label: string) => Worker } }).MonacoEnvironment = {
    getWorker(_moduleId: string, label: string): Worker {
      console.log(`[Monaco Setup] Creating worker for label: ${label}`);

      // Return the appropriate worker based on language
      if (label === 'json') {
        return new jsonWorker();
      }
      if (label === 'css' || label === 'scss' || label === 'less') {
        return new cssWorker();
      }
      if (label === 'html' || label === 'handlebars' || label === 'razor') {
        return new htmlWorker();
      }
      if (label === 'typescript' || label === 'javascript') {
        return new tsWorker();
      }
      // Default editor worker for all other languages
      return new editorWorker();
    }
  };

  isSetup = true;
  console.log('[Monaco Setup] Monaco workers configured successfully');
}

/**
 * Check if Monaco environment is properly configured
 */
export function isMonacoSetup(): boolean {
  return isSetup;
}

// Auto-initialize when module is imported
// This ensures workers are configured before any Editor component renders
setupMonacoEnvironment();
