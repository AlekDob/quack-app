// Background service worker for Quack Inspector
console.log('🦆 Quack Inspector background service worker loaded');

// Store for inspector state and history
let inspectorState = {
  enabled: false,
  history: []
};

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('🦆 Quack Inspector installed successfully!');
    // Set default settings
    chrome.storage.local.set({
      inspectorEnabled: false,
      history: [],
      maxHistoryItems: 20
    });
  }
});

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('🦆 Background received message:', message);

  switch (message.type) {
    case 'toggle-inspector':
      handleToggleInspector(sender.tab.id, sendResponse);
      return true; // Keep channel open for async response

    case 'save-inspection':
      handleSaveInspection(message.data, sendResponse);
      return true;

    case 'get-history':
      handleGetHistory(sendResponse);
      return true;

    case 'clear-history':
      handleClearHistory(sendResponse);
      return true;

    case 'copy-to-clipboard':
      handleCopyToClipboard(message.data, sendResponse);
      return true;

    default:
      console.warn('🦆 Unknown message type:', message.type);
      sendResponse({ success: false, error: 'Unknown message type' });
  }
});

// Handle keyboard commands
chrome.commands.onCommand.addListener((command) => {
  console.log('🦆 Command triggered:', command);

  if (command === 'toggle-inspector') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'toggle-inspector-mode' });
      }
    });
  } else if (command === 'copy-last-component') {
    chrome.storage.local.get(['history'], (result) => {
      if (result.history && result.history.length > 0) {
        const lastComponent = result.history[0];
        copyToClipboard(lastComponent.markdown);
      }
    });
  }
});

// Toggle inspector mode
function handleToggleInspector(tabId, sendResponse) {
  chrome.tabs.sendMessage(tabId, { type: 'toggle-inspector-mode' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('🦆 Error toggling inspector:', chrome.runtime.lastError);
      sendResponse({ success: false, error: chrome.runtime.lastError.message });
    } else {
      sendResponse({ success: true, enabled: response?.enabled });
    }
  });
}

// Save inspection to history
function handleSaveInspection(data, sendResponse) {
  chrome.storage.local.get(['history', 'maxHistoryItems'], (result) => {
    let history = result.history || [];
    const maxItems = result.maxHistoryItems || 20;

    // Add timestamp
    data.timestamp = Date.now();

    // Add to beginning of history
    history.unshift(data);

    // Limit history size
    if (history.length > maxItems) {
      history = history.slice(0, maxItems);
    }

    chrome.storage.local.set({ history }, () => {
      console.log('🦆 Inspection saved to history:', data);
      sendResponse({ success: true, historyLength: history.length });
    });
  });
}

// Get inspection history
function handleGetHistory(sendResponse) {
  chrome.storage.local.get(['history'], (result) => {
    sendResponse({ success: true, history: result.history || [] });
  });
}

// Clear inspection history
function handleClearHistory(sendResponse) {
  chrome.storage.local.set({ history: [] }, () => {
    console.log('🦆 History cleared');
    sendResponse({ success: true });
  });
}

// Copy to clipboard
function handleCopyToClipboard(data, sendResponse) {
  copyToClipboard(data.text);
  sendResponse({ success: true });
}

// Helper to copy text to clipboard
function copyToClipboard(text) {
  // Use offscreen document or clipboard API
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'copy-to-clipboard',
        text: text
      });
    }
  });
}

console.log('🦆 Quack Inspector background service worker ready!');
