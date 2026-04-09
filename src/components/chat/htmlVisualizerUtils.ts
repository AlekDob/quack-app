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
  // Brain: fix-anchor-navigation-sandboxed-iframe
  // WHY: In Tauri WebView srcdoc iframes, <a href="#id"> resolves to
  // tauri://localhost/#id instead of scrolling in-place. This crashes the
  // iframe by loading the full app. Three-layer defense:
  // 1. Capture-phase listener fires BEFORE browser default navigation
  // 2. Both preventDefault AND stopImmediatePropagation to kill the event
  // 3. Strip href from all anchor links as CSS-only fallback
  document.addEventListener('click', function(e) {
    var link = e.target.closest('a[href]');
    if (!link) return;
    var href = link.getAttribute('href') || '';
    // Anchor links: scroll in-place
    if (href.startsWith('#')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      var targetId = href.slice(1);
      var target = document.getElementById(targetId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return false;
    }
    // External links: forward to parent to open in system browser
    if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      parent.postMessage({ type: 'quack-viz-link-click', url: href }, '*');
      return false;
    }
  }, true);
  // Layer 3: strip href from anchor-only links so browser can't navigate even without JS
  document.querySelectorAll('a[href^="#"]').forEach(function(a) {
    var id = a.getAttribute('href').slice(1);
    a.removeAttribute('href');
    a.style.cursor = 'pointer';
    a.dataset.scrollTo = id;
  });
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
