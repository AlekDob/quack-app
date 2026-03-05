// Popup script for Quack Inspector
console.log('🦆 Quack Inspector popup loaded');

// DOM elements
const toggleBtn = document.getElementById('toggle-inspector');
const toggleText = document.getElementById('toggle-text');
const frameworkEl = document.getElementById('framework');
const historyEl = document.getElementById('history');
const clearHistoryBtn = document.getElementById('clear-history');

// State
let inspectorEnabled = false;

// Initialize popup
async function init() {
  console.log('🦆 Initializing popup');

  // Load inspector state
  loadInspectorState();

  // Load framework detection
  detectFramework();

  // Load history
  loadHistory();

  // Setup event listeners
  setupEventListeners();
}

// Setup event listeners
function setupEventListeners() {
  toggleBtn.addEventListener('click', handleToggleInspector);
  clearHistoryBtn.addEventListener('click', handleClearHistory);
}

// Toggle inspector
async function handleToggleInspector() {
  console.log('🦆 Toggle inspector clicked');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    chrome.tabs.sendMessage(tab.id, { type: 'toggle-inspector-mode' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('🦆 Error:', chrome.runtime.lastError);
        showError('Could not activate inspector. Try refreshing the page.');
        return;
      }

      if (response && response.success) {
        inspectorEnabled = response.enabled;
        updateToggleButton();

        // Close popup if inspector is enabled (user will click on page)
        if (inspectorEnabled) {
          window.close();
        }
      }
    });
  } catch (error) {
    console.error('🦆 Error toggling inspector:', error);
    showError('Failed to toggle inspector');
  }
}

// Update toggle button state
function updateToggleButton() {
  if (inspectorEnabled) {
    toggleBtn.classList.add('active');
    toggleText.textContent = 'Inspector Active';
  } else {
    toggleBtn.classList.remove('active');
    toggleText.textContent = 'Start Inspecting';
  }
}

// Load inspector state
function loadInspectorState() {
  chrome.storage.local.get(['inspectorEnabled'], (result) => {
    inspectorEnabled = result.inspectorEnabled || false;
    updateToggleButton();
  });
}

// Detect framework
async function detectFramework() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    chrome.tabs.sendMessage(tab.id, { type: 'get-framework' }, (response) => {
      if (chrome.runtime.lastError) {
        frameworkEl.textContent = 'Unknown';
        frameworkEl.style.color = 'rgba(255, 255, 255, 0.4)';
        return;
      }

      if (response && response.success) {
        const framework = response.framework || 'generic';
        frameworkEl.textContent = formatFrameworkName(framework);

        // Color based on framework
        const colors = {
          react: '#61DAFB',
          vue: '#42B883',
          angular: '#DD0031',
          generic: 'rgba(255, 255, 255, 0.6)'
        };
        frameworkEl.style.color = colors[framework] || colors.generic;
      }
    });
  } catch (error) {
    console.error('🦆 Error detecting framework:', error);
    frameworkEl.textContent = 'Unknown';
  }
}

// Format framework name
function formatFrameworkName(framework) {
  const names = {
    react: 'React',
    vue: 'Vue.js',
    angular: 'Angular',
    generic: 'Generic HTML'
  };
  return names[framework] || framework;
}

// Load history
async function loadHistory() {
  chrome.runtime.sendMessage({ type: 'get-history' }, (response) => {
    if (response && response.success) {
      displayHistory(response.history || []);
    }
  });
}

// Display history
function displayHistory(history) {
  if (!history || history.length === 0) {
    historyEl.innerHTML = '<p class="empty-state">No inspections yet</p>';
    return;
  }

  historyEl.innerHTML = '';

  history.forEach((item, index) => {
    const historyItem = createHistoryItem(item, index);
    historyEl.appendChild(historyItem);
  });
}

// Create history item
function createHistoryItem(item, index) {
  const div = document.createElement('div');
  div.className = 'history-item';

  const componentName = item.compact || 'Unknown Component';
  const framework = item.componentInfo?.framework || 'Unknown';
  const file = item.componentInfo?.file || '';
  const timestamp = item.timestamp ? formatTimestamp(item.timestamp) : '';

  div.innerHTML = `
    <div class="history-item-header">
      <span class="history-item-name">${escapeHtml(componentName)}</span>
      <span class="history-item-framework">${escapeHtml(framework)}</span>
    </div>
    ${file ? `<div class="history-item-file">${escapeHtml(file)}</div>` : ''}
    ${timestamp ? `<div class="history-item-time">${timestamp}</div>` : ''}
  `;

  // Click to copy
  div.addEventListener('click', () => {
    copyToClipboard(item.markdown);
    showCopiedFeedback(div);
  });

  return div;
}

// Format timestamp
function formatTimestamp(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

// Copy to clipboard
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    console.log('🦆 Copied to clipboard');
  } catch (error) {
    console.error('🦆 Failed to copy:', error);
  }
}

// Show copied feedback
function showCopiedFeedback(element) {
  const originalBg = element.style.background;
  element.style.background = 'rgba(76, 175, 80, 0.2)';
  element.style.borderColor = '#4CAF50';

  setTimeout(() => {
    element.style.background = originalBg;
    element.style.borderColor = 'transparent';
  }, 500);
}

// Clear history
function handleClearHistory() {
  chrome.runtime.sendMessage({ type: 'clear-history' }, (response) => {
    if (response && response.success) {
      console.log('🦆 History cleared');
      displayHistory([]);
    }
  });
}

// Show error
function showError(message) {
  // Could add a toast notification here
  console.error('🦆 Error:', message);
  alert(message);
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize on load
document.addEventListener('DOMContentLoaded', init);

console.log('🦆 Quack Inspector popup ready!');
