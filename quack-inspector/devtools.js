// DevTools integration for Quack Inspector
console.log('🦆 Quack Inspector DevTools loaded');

// Create a panel in Chrome DevTools
chrome.devtools.panels.create(
  'Quack 🦆',
  'icons/icon48.png',
  'popup/popup.html',
  (panel) => {
    console.log('🦆 Quack Inspector panel created');

    panel.onShown.addListener((window) => {
      console.log('🦆 Quack Inspector panel shown');
    });

    panel.onHidden.addListener(() => {
      console.log('🦆 Quack Inspector panel hidden');
    });
  }
);
