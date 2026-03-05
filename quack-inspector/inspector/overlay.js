// Visual overlay system for highlighting inspected elements
console.log('🦆 Quack Overlay System loaded');

class InspectorOverlay {
  constructor() {
    this.overlay = null;
    this.tooltip = null;
    this.enabled = false;
    this.currentElement = null;
    this.clickedElement = null;
    this.onInspectCallback = null;

    this.createOverlay();
    this.createTooltip();
  }

  // Create overlay elements
  createOverlay() {
    this.overlay = document.createElement('div');
    this.overlay.id = 'quack-inspector-overlay';
    this.overlay.style.cssText = `
      position: absolute;
      pointer-events: none;
      border: 2px solid #FF6B35;
      background: rgba(255, 107, 53, 0.1);
      z-index: 2147483647;
      transition: all 0.1s ease;
      display: none;
      box-shadow: 0 0 0 1px rgba(255, 107, 53, 0.3), 0 0 20px rgba(255, 107, 53, 0.2);
    `;
  }

  // Create tooltip
  createTooltip() {
    this.tooltip = document.createElement('div');
    this.tooltip.id = 'quack-inspector-tooltip';
    this.tooltip.style.cssText = `
      position: absolute;
      pointer-events: none;
      background: #1a1a1a;
      color: #fff;
      padding: 8px 12px;
      border-radius: 6px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 12px;
      line-height: 1.4;
      z-index: 2147483648;
      display: none;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      border: 1px solid #FF6B35;
      max-width: 300px;
      word-wrap: break-word;
    `;
  }

  // Enable inspector mode
  enable(onInspect) {
    console.log('🦆 Enabling inspector mode');
    this.enabled = true;
    this.onInspectCallback = onInspect;

    // Add overlay to DOM
    document.body.appendChild(this.overlay);
    document.body.appendChild(this.tooltip);

    // Add event listeners
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('click', this.handleClick, true);
    document.addEventListener('scroll', this.handleScroll, true);

    // Change cursor
    document.body.style.cursor = 'crosshair';

    // Show notification
    this.showNotification('🦆 Inspector Mode Active - Click to inspect element');
  }

  // Disable inspector mode
  disable() {
    console.log('🦆 Disabling inspector mode');
    this.enabled = false;
    this.onInspectCallback = null;

    // Remove overlay from DOM
    if (this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    if (this.tooltip.parentNode) {
      this.tooltip.parentNode.removeChild(this.tooltip);
    }

    // Remove event listeners
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('click', this.handleClick, true);
    document.removeEventListener('scroll', this.handleScroll, true);

    // Reset cursor
    document.body.style.cursor = '';

    // Hide notification
    this.hideNotification();
  }

  // Handle mouse move
  handleMouseMove = (e) => {
    if (!this.enabled) return;

    const element = document.elementFromPoint(e.clientX, e.clientY);
    if (!element || element === this.overlay || element === this.tooltip) return;

    // Skip if already highlighted
    if (element === this.currentElement) return;

    this.currentElement = element;
    this.highlightElement(element);
    this.showTooltip(element, e.clientX, e.clientY);
  };

  // Handle click
  handleClick = (e) => {
    if (!this.enabled) return;

    e.preventDefault();
    e.stopPropagation();

    const element = document.elementFromPoint(e.clientX, e.clientY);
    if (!element || element === this.overlay || element === this.tooltip) return;

    console.log('🦆 Element clicked:', element);
    this.clickedElement = element;

    // Flash the overlay
    this.flashOverlay();

    // Call inspect callback
    if (this.onInspectCallback) {
      this.onInspectCallback(element);
    }

    // Disable inspector mode after click
    this.disable();
  };

  // Handle scroll
  handleScroll = () => {
    if (!this.enabled || !this.currentElement) return;

    // Update overlay position on scroll
    this.highlightElement(this.currentElement);
  };

  // Highlight element with overlay
  highlightElement(element) {
    if (!element) return;

    const rect = element.getBoundingClientRect();

    this.overlay.style.display = 'block';
    this.overlay.style.top = `${rect.top + window.scrollY}px`;
    this.overlay.style.left = `${rect.left + window.scrollX}px`;
    this.overlay.style.width = `${rect.width}px`;
    this.overlay.style.height = `${rect.height}px`;
  }

  // Show tooltip with element info
  showTooltip(element, x, y) {
    if (!element) return;

    const tagName = element.tagName.toLowerCase();
    const id = element.id ? `#${element.id}` : '';
    const classes = element.className && typeof element.className === 'string'
      ? `.${element.className.split(' ').filter(c => c).join('.')}`
      : '';

    let text = `<strong>${tagName}${id}${classes}</strong>`;

    // Add dimensions
    const rect = element.getBoundingClientRect();
    text += `<br><span style="opacity: 0.7;">${Math.round(rect.width)}×${Math.round(rect.height)}px</span>`;

    this.tooltip.innerHTML = text;
    this.tooltip.style.display = 'block';

    // Position tooltip
    const tooltipRect = this.tooltip.getBoundingClientRect();
    let tooltipX = x + 10;
    let tooltipY = y + 10;

    // Keep tooltip in viewport
    if (tooltipX + tooltipRect.width > window.innerWidth) {
      tooltipX = x - tooltipRect.width - 10;
    }
    if (tooltipY + tooltipRect.height > window.innerHeight) {
      tooltipY = y - tooltipRect.height - 10;
    }

    this.tooltip.style.left = `${tooltipX + window.scrollX}px`;
    this.tooltip.style.top = `${tooltipY + window.scrollY}px`;
  }

  // Flash overlay on click
  flashOverlay() {
    this.overlay.style.background = 'rgba(255, 107, 53, 0.3)';
    setTimeout(() => {
      this.overlay.style.background = 'rgba(255, 107, 53, 0.1)';
    }, 150);
  }

  // Show notification banner
  showNotification(message) {
    // Remove existing notification
    this.hideNotification();

    const notification = document.createElement('div');
    notification.id = 'quack-inspector-notification';
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #1a1a1a;
      color: #fff;
      padding: 12px 24px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      z-index: 2147483649;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      border: 1px solid #FF6B35;
      animation: quack-fade-in 0.3s ease;
    `;

    // Add animation keyframes
    if (!document.getElementById('quack-inspector-styles')) {
      const style = document.createElement('style');
      style.id = 'quack-inspector-styles';
      style.textContent = `
        @keyframes quack-fade-in {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(notification);
  }

  // Hide notification banner
  hideNotification() {
    const notification = document.getElementById('quack-inspector-notification');
    if (notification) {
      notification.remove();
    }
  }

  // Get last clicked element
  getClickedElement() {
    return this.clickedElement;
  }
}

// Export for use in content script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = InspectorOverlay;
}
