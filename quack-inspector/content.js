// Main content script for Quack Inspector
console.log('🦆 Quack Inspector content script loaded');

// Load inspector modules
const scriptPath = chrome.runtime.getURL('inspector/detector.js');
const overlayPath = chrome.runtime.getURL('inspector/overlay.js');
const formatterPath = chrome.runtime.getURL('inspector/formatter.js');

// Inject scripts into page context (needed for React/Vue detection)
function injectScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    (document.head || document.documentElement).appendChild(script);
  });
}

// Initialize inspector modules
let detector = null;
let overlay = null;
let formatter = null;

Promise.all([
  injectScript(scriptPath),
  injectScript(overlayPath),
  injectScript(formatterPath)
]).then(() => {
  console.log('🦆 Inspector modules loaded');

  // Initialize on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeInspector);
  } else {
    initializeInspector();
  }
}).catch(error => {
  console.error('🦆 Failed to load inspector modules:', error);
});

// Initialize inspector
function initializeInspector() {
  console.log('🦆 Initializing inspector');

  // Access classes from injected scripts
  if (typeof ComponentDetector !== 'undefined') {
    detector = new ComponentDetector();
  } else {
    console.error('🦆 ComponentDetector not found');
  }

  if (typeof InspectorOverlay !== 'undefined') {
    overlay = new InspectorOverlay();
  } else {
    console.error('🦆 InspectorOverlay not found');
  }

  if (typeof MarkdownFormatter !== 'undefined') {
    formatter = MarkdownFormatter;
  } else {
    console.error('🦆 MarkdownFormatter not found');
  }
}

// Listen for messages from background script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('🦆 Content script received message:', message);

  switch (message.type) {
    case 'toggle-inspector-mode':
      handleToggleInspectorMode(sendResponse);
      return true;

    case 'copy-to-clipboard':
      handleCopyToClipboard(message.text, sendResponse);
      return true;

    case 'get-framework':
      handleGetFramework(sendResponse);
      return true;

    default:
      console.warn('🦆 Unknown message type:', message.type);
      sendResponse({ success: false });
  }
});

// Toggle inspector mode
function handleToggleInspectorMode(sendResponse) {
  if (!overlay) {
    console.error('🦆 Overlay not initialized');
    sendResponse({ success: false, error: 'Overlay not initialized' });
    return;
  }

  if (overlay.enabled) {
    overlay.disable();
    sendResponse({ success: true, enabled: false });
  } else {
    overlay.enable(handleElementInspected);
    sendResponse({ success: true, enabled: true });
  }
}

// Handle element inspected
function handleElementInspected(element) {
  console.log('🦆 Element inspected:', element);

  if (!detector || !formatter) {
    console.error('🦆 Detector or formatter not initialized');
    return;
  }

  // Detect component
  const componentInfo = detector.inspectElement(element);
  console.log('🦆 Component info:', componentInfo);

  // Format as markdown
  const markdown = formatter.format(componentInfo);
  const compact = formatter.formatCompact(componentInfo);

  // Copy to clipboard immediately
  copyToClipboard(markdown);

  // Save to history
  chrome.runtime.sendMessage({
    type: 'save-inspection',
    data: {
      componentInfo,
      markdown,
      compact,
      url: window.location.href
    }
  }, (response) => {
    if (response && response.success) {
      console.log('🦆 Inspection saved to history');
      showCopiedNotification(compact);
    }
  });
}

// Copy text to clipboard
function handleCopyToClipboard(text, sendResponse) {
  copyToClipboard(text);
  sendResponse({ success: true });
}

// Copy to clipboard helper
function copyToClipboard(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();

  try {
    document.execCommand('copy');
    console.log('🦆 Copied to clipboard');
  } catch (error) {
    console.error('🦆 Failed to copy to clipboard:', error);
  }

  document.body.removeChild(textarea);
}

// Show "Copied!" notification
function showCopiedNotification(componentName) {
  const notification = document.createElement('div');
  notification.textContent = `🦆 Copied: ${componentName}`;
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #1a1a1a;
    color: #fff;
    padding: 12px 24px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
    z-index: 2147483649;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    border: 1px solid #FF6B35;
    animation: quack-slide-in 0.3s ease, quack-slide-out 0.3s ease 2.7s;
  `;

  // Add animation
  if (!document.getElementById('quack-notification-styles')) {
    const style = document.createElement('style');
    style.id = 'quack-notification-styles';
    style.textContent = `
      @keyframes quack-slide-in {
        from {
          opacity: 0;
          transform: translateX(100px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
      @keyframes quack-slide-out {
        from {
          opacity: 1;
          transform: translateX(0);
        }
        to {
          opacity: 0;
          transform: translateX(100px);
        }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(notification);

  // Remove after animation
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 3000);
}

// Get detected framework
function handleGetFramework(sendResponse) {
  if (!detector) {
    sendResponse({ success: false, error: 'Detector not initialized' });
    return;
  }

  sendResponse({
    success: true,
    framework: detector.detectedFramework
  });
}

console.log('🦆 Quack Inspector ready!');
