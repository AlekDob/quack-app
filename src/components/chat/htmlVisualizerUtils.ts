/**
 * Utilities for preparing HTML content for sandboxed iframe rendering.
 * Used by HtmlVisualizer to wrap user-generated HTML safely.
 */

// === DETECTION ===

/** Check if HTML string is a complete document (has <html> or <!DOCTYPE>) */
export function isCompleteHtmlDocument(html: string): boolean {
  const trimmed = html.trim().toLowerCase();
  return trimmed.startsWith('<!doctype') || trimmed.startsWith('<html');
}

// === SANDBOX WRAPPER ===

const AUTO_RESIZE_SCRIPT = `
<script>
(function() {
  function sendHeight() {
    var h = document.documentElement.scrollHeight || document.body.scrollHeight;
    parent.postMessage({ type: 'quack-viz-resize', height: h }, '*');
  }
  // WHY: ResizeObserver catches dynamic content changes (charts loading, etc.)
  if (window.ResizeObserver) {
    var lastSent = 0;
    new ResizeObserver(function() {
      // Throttle: max 1 resize per 500ms
      var now = Date.now();
      if (now - lastSent > 500) { lastSent = now; sendHeight(); }
    }).observe(document.body);
  }
  window.addEventListener('load', sendHeight);
  // Fallback for scripts that render after load
  setTimeout(sendHeight, 1000);
  setTimeout(sendHeight, 3000);
})();
</script>`;

const BASE_STYLES = `
<style>
  html, body {
    margin: 0; padding: 16px;
    background: #000;
    color: rgba(255, 255, 255, 0.85);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 13px;
    line-height: 1.5;
    overflow-x: hidden;
  }
  * { box-sizing: border-box; }
</style>`;

/** Wrap HTML content with auto-resize script and base dark styles */
export function wrapHtmlForSandbox(html: string): string {
  if (isCompleteHtmlDocument(html)) {
    // WHY: lastIndexOf handles edge cases where </body> appears in comments or <pre>
    const insertPoint = html.toLowerCase().lastIndexOf('</body>');
    if (insertPoint !== -1) {
      return html.slice(0, insertPoint) + AUTO_RESIZE_SCRIPT + html.slice(insertPoint);
    }
    return html + AUTO_RESIZE_SCRIPT;
  }

  // Fragment → wrap in full document
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">${BASE_STYLES}</head>
<body>${html}${AUTO_RESIZE_SCRIPT}</body></html>`;
}
