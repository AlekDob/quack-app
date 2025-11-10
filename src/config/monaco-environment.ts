// Monaco Editor Environment Configuration for Tauri
// This file configures Monaco to work correctly in Tauri production builds
// with the custom tauri://localhost/ protocol

declare global {
  interface Window {
    MonacoEnvironment: {
      getWorkerUrl: (moduleId: string, label: string) => string;
    };
  }
}

// Configure Monaco workers for production
if (typeof window !== 'undefined') {
  window.MonacoEnvironment = {
    getWorkerUrl: function (moduleId: string, label: string) {
      // Get base URL - works for both dev and production
      const baseUrl = import.meta.env.DEV
        ? 'http://localhost:5174'
        : window.location.origin;

      // Map worker labels to their bundle files
      switch (label) {
        case 'editorWorkerService':
          return `${baseUrl}/monacoeditorwork/editor.worker.bundle.js`;
        case 'typescript':
        case 'javascript':
          return `${baseUrl}/monacoeditorwork/ts.worker.bundle.js`;
        case 'json':
          return `${baseUrl}/monacoeditorwork/json.worker.bundle.js`;
        case 'css':
        case 'scss':
        case 'less':
          return `${baseUrl}/monacoeditorwork/css.worker.bundle.js`;
        case 'html':
        case 'handlebars':
        case 'razor':
          return `${baseUrl}/monacoeditorwork/html.worker.bundle.js`;
        default:
          return `${baseUrl}/monacoeditorwork/editor.worker.bundle.js`;
      }
    }
  };
}

export {};
