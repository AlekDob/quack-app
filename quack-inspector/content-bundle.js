// Quack Inspector - Complete Bundle
// All functionality in one file for Chrome extension compatibility
console.log('🦆 Quack Inspector loading...');

// =============================================================================
// COMPONENT DETECTOR
// =============================================================================

class ComponentDetector {
  constructor() {
    this.detectedFramework = null;
    this.detectFramework();
  }

  detectFramework() {
    if (this.hasReact()) {
      this.detectedFramework = 'react';
      console.log('🦆 Detected React');
      return;
    }
    if (this.hasVue()) {
      this.detectedFramework = 'vue';
      console.log('🦆 Detected Vue');
      return;
    }
    if (this.hasAngular()) {
      this.detectedFramework = 'angular';
      console.log('🦆 Detected Angular');
      return;
    }
    this.detectedFramework = 'generic';
    console.log('🦆 No specific framework detected, using generic mode');
  }

  hasReact() {
    return !!(
      window.React ||
      document.querySelector('[data-reactroot]') ||
      document.querySelector('[data-reactid]') ||
      this.findReactInstance(document.body)
    );
  }

  hasVue() {
    return !!(
      window.Vue ||
      document.querySelector('[data-v-]') ||
      this.findVueInstance(document.body)
    );
  }

  hasAngular() {
    return !!(
      window.ng ||
      window.angular ||
      document.querySelector('[ng-version]') ||
      document.querySelector('[ng-app]')
    );
  }

  findReactInstance(element) {
    if (!element) return null;
    for (let key in element) {
      if (key.startsWith('__reactInternalInstance$') || key.startsWith('__reactFiber')) {
        return element[key];
      }
    }
    return null;
  }

  findVueInstance(element) {
    if (!element) return null;
    if (element.__vue__) return element.__vue__;
    if (element.__vueParentComponent) return element.__vueParentComponent;
    return null;
  }

  inspectElement(element) {
    if (!element) return null;
    console.log('🦆 Inspecting element:', element);

    switch (this.detectedFramework) {
      case 'react':
        return this.inspectReactComponent(element);
      case 'vue':
        return this.inspectVueComponent(element);
      case 'angular':
        return this.inspectAngularComponent(element);
      default:
        return this.inspectGenericElement(element);
    }
  }

  inspectReactComponent(element) {
    const fiber = this.findReactInstance(element);
    if (!fiber) return this.inspectGenericElement(element);

    try {
      return {
        framework: 'React',
        componentName: this.getReactComponentName(fiber),
        props: this.getReactProps(fiber),
        state: this.getReactState(fiber),
        hooks: this.getReactHooks(fiber),
        file: this.getReactSourceFile(fiber),
        parentChain: this.getReactParentChain(fiber),
        domPath: this.getDOMPath(element),
        element: element
      };
    } catch (error) {
      console.error('🦆 Error inspecting React component:', error);
      return this.inspectGenericElement(element);
    }
  }

  getReactComponentName(fiber) {
    if (!fiber) return 'Unknown';
    if (fiber.type) {
      if (typeof fiber.type === 'function') {
        return fiber.type.name || fiber.type.displayName || 'Anonymous';
      }
      if (typeof fiber.type === 'string') {
        return fiber.type;
      }
    }
    let currentFiber = fiber;
    while (currentFiber) {
      if (currentFiber.type && typeof currentFiber.type === 'function') {
        return currentFiber.type.name || currentFiber.type.displayName || 'Anonymous';
      }
      currentFiber = currentFiber.return;
    }
    return 'Unknown';
  }

  getReactProps(fiber) {
    try {
      return fiber.memoizedProps || fiber.pendingProps || {};
    } catch (error) {
      return {};
    }
  }

  getReactState(fiber) {
    try {
      return fiber.memoizedState || {};
    } catch (error) {
      return {};
    }
  }

  getReactHooks(fiber) {
    try {
      const hooks = [];
      let hook = fiber.memoizedState;
      while (hook) {
        hooks.push({
          value: hook.memoizedState,
          type: hook.queue ? 'useState' : 'useEffect'
        });
        hook = hook.next;
      }
      return hooks;
    } catch (error) {
      return [];
    }
  }

  getReactSourceFile(fiber) {
    try {
      if (fiber._debugSource) {
        return `${fiber._debugSource.fileName}:${fiber._debugSource.lineNumber}`;
      }
      return 'Unknown';
    } catch (error) {
      return 'Unknown';
    }
  }

  getReactParentChain(fiber) {
    const chain = [];
    let currentFiber = fiber.return;
    while (currentFiber && chain.length < 5) {
      const name = this.getReactComponentName(currentFiber);
      if (name && name !== 'Unknown' && typeof currentFiber.type === 'function') {
        chain.push(name);
      }
      currentFiber = currentFiber.return;
    }
    return chain;
  }

  inspectVueComponent(element) {
    const vueInstance = this.findVueInstance(element);
    if (!vueInstance) return this.inspectGenericElement(element);

    try {
      return {
        framework: 'Vue',
        componentName: this.getVueComponentName(vueInstance),
        props: vueInstance.$props || {},
        data: vueInstance.$data || {},
        file: this.getVueSourceFile(vueInstance),
        parentChain: this.getVueParentChain(vueInstance),
        domPath: this.getDOMPath(element),
        element: element
      };
    } catch (error) {
      console.error('🦆 Error inspecting Vue component:', error);
      return this.inspectGenericElement(element);
    }
  }

  getVueComponentName(instance) {
    if (!instance) return 'Unknown';
    if (instance.$options) {
      return instance.$options.name || instance.$options._componentTag || 'Anonymous';
    }
    if (instance.type) {
      return instance.type.name || instance.type.__name || 'Anonymous';
    }
    return 'Unknown';
  }

  getVueSourceFile(instance) {
    try {
      if (instance.$options && instance.$options.__file) {
        return instance.$options.__file;
      }
      return 'Unknown';
    } catch (error) {
      return 'Unknown';
    }
  }

  getVueParentChain(instance) {
    const chain = [];
    let current = instance.$parent;
    while (current && chain.length < 5) {
      const name = this.getVueComponentName(current);
      if (name && name !== 'Unknown') {
        chain.push(name);
      }
      current = current.$parent;
    }
    return chain;
  }

  inspectAngularComponent(element) {
    try {
      const debugElement = window.ng?.probe?.(element);
      if (!debugElement) return this.inspectGenericElement(element);

      return {
        framework: 'Angular',
        componentName: debugElement.name || 'Unknown',
        properties: debugElement.properties || {},
        domPath: this.getDOMPath(element),
        element: element
      };
    } catch (error) {
      console.error('🦆 Error inspecting Angular component:', error);
      return this.inspectGenericElement(element);
    }
  }

  inspectGenericElement(element) {
    return {
      framework: 'Generic',
      tagName: element.tagName.toLowerCase(),
      id: element.id || null,
      className: element.className || null,
      attributes: this.getAttributes(element),
      domPath: this.getDOMPath(element),
      element: element
    };
  }

  getDOMPath(element) {
    const path = [];
    let current = element;

    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();

      if (current.id) {
        selector += `#${current.id}`;
        path.unshift(selector);
        break;
      }

      if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\s+/).filter(c => c);
        if (classes.length > 0) {
          selector += `.${classes.join('.')}`;
        }
      }

      path.unshift(selector);
      current = current.parentElement;
    }

    return path.join(' > ');
  }

  getAttributes(element) {
    const attrs = {};
    for (let attr of element.attributes) {
      attrs[attr.name] = attr.value;
    }
    return attrs;
  }
}

// =============================================================================
// MARKDOWN FORMATTER
// =============================================================================

class MarkdownFormatter {
  static format(componentInfo) {
    if (!componentInfo) return '## No component detected';

    const lines = [];
    lines.push(`## 🦆 Component Inspector`);
    lines.push('');
    lines.push(`**Framework**: ${componentInfo.framework}`);
    lines.push('');

    switch (componentInfo.framework) {
      case 'React':
        this.formatReactComponent(lines, componentInfo);
        break;
      case 'Vue':
        this.formatVueComponent(lines, componentInfo);
        break;
      case 'Angular':
        this.formatAngularComponent(lines, componentInfo);
        break;
      default:
        this.formatGenericElement(lines, componentInfo);
    }

    lines.push('');
    lines.push(`**DOM Path**:`);
    lines.push('```css');
    lines.push(componentInfo.domPath || 'Unknown');
    lines.push('```');
    lines.push('');
    lines.push('---');
    lines.push('*Generated by Quack Inspector 🦆*');

    return lines.join('\n');
  }

  static formatReactComponent(lines, info) {
    lines.push(`**Component**: \`${info.componentName}\``);
    lines.push('');

    if (info.file && info.file !== 'Unknown') {
      lines.push(`**File**: \`${info.file}\``);
      lines.push('');
    }

    if (info.parentChain && info.parentChain.length > 0) {
      lines.push(`**Parent Chain**: ${info.parentChain.join(' > ')}`);
      lines.push('');
    }

    if (info.props && Object.keys(info.props).length > 0) {
      lines.push(`**Props**:`);
      lines.push('```json');
      lines.push(JSON.stringify(this.sanitizeProps(info.props), null, 2));
      lines.push('```');
      lines.push('');
    }
  }

  static formatVueComponent(lines, info) {
    lines.push(`**Component**: \`${info.componentName}\``);
    lines.push('');

    if (info.file && info.file !== 'Unknown') {
      lines.push(`**File**: \`${info.file}\``);
      lines.push('');
    }

    if (info.props && Object.keys(info.props).length > 0) {
      lines.push(`**Props**:`);
      lines.push('```json');
      lines.push(JSON.stringify(this.sanitizeProps(info.props), null, 2));
      lines.push('```');
      lines.push('');
    }
  }

  static formatAngularComponent(lines, info) {
    lines.push(`**Component**: \`${info.componentName}\``);
    lines.push('');
  }

  static formatGenericElement(lines, info) {
    lines.push(`**Element**: \`<${info.tagName}>\``);
    lines.push('');

    if (info.id) {
      lines.push(`**ID**: \`${info.id}\``);
      lines.push('');
    }

    if (info.className) {
      lines.push(`**Classes**: \`${info.className}\``);
      lines.push('');
    }
  }

  static sanitizeProps(obj, depth = 0, maxDepth = 2) {
    if (depth > maxDepth) return '[Max depth reached]';
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'function') return `[Function: ${obj.name || 'anonymous'}]`;
    if (obj instanceof HTMLElement) return `[HTMLElement: ${obj.tagName}]`;
    if (obj instanceof Node) return '[DOM Node]';

    if (Array.isArray(obj)) {
      if (obj.length > 10) return `[Array(${obj.length})]`;
      return obj.map(item => this.sanitizeProps(item, depth + 1, maxDepth));
    }

    if (typeof obj === 'object') {
      const sanitized = {};
      const keys = Object.keys(obj).slice(0, 20);

      for (let key of keys) {
        if (key.startsWith('_') || key.startsWith('__')) continue;
        try {
          sanitized[key] = this.sanitizeProps(obj[key], depth + 1, maxDepth);
        } catch (error) {
          sanitized[key] = '[Error reading property]';
        }
      }

      return sanitized;
    }

    return obj;
  }

  static formatCompact(componentInfo) {
    if (!componentInfo) return 'No component';

    switch (componentInfo.framework) {
      case 'React':
      case 'Vue':
        return `${componentInfo.componentName} (${componentInfo.file || 'Unknown'})`;
      case 'Angular':
        return componentInfo.componentName;
      default:
        return `<${componentInfo.tagName}>${componentInfo.id ? `#${componentInfo.id}` : ''}`;
    }
  }
}

// =============================================================================
// INSPECTOR OVERLAY
// =============================================================================

class InspectorOverlay {
  constructor() {
    this.overlay = null;
    this.tooltip = null;
    this.enabled = false;
    this.currentElement = null;
    this.onInspectCallback = null;
    this.createOverlay();
    this.createTooltip();
  }

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
      box-shadow: 0 0 0 1px rgba(255, 107, 53, 0.3);
    `;
  }

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
      z-index: 2147483648;
      display: none;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      border: 1px solid #FF6B35;
      max-width: 300px;
    `;
  }

  enable(onInspect) {
    console.log('🦆 Enabling inspector mode');
    this.enabled = true;
    this.onInspectCallback = onInspect;

    document.body.appendChild(this.overlay);
    document.body.appendChild(this.tooltip);

    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('click', this.handleClick, true);
    document.body.style.cursor = 'crosshair';

    this.showNotification('🦆 Inspector Mode Active - Click to inspect element');
  }

  disable() {
    console.log('🦆 Disabling inspector mode');
    this.enabled = false;
    this.onInspectCallback = null;

    if (this.overlay.parentNode) this.overlay.parentNode.removeChild(this.overlay);
    if (this.tooltip.parentNode) this.tooltip.parentNode.removeChild(this.tooltip);

    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('click', this.handleClick, true);
    document.body.style.cursor = '';

    this.hideNotification();
  }

  handleMouseMove = (e) => {
    if (!this.enabled) return;
    const element = document.elementFromPoint(e.clientX, e.clientY);
    if (!element || element === this.overlay || element === this.tooltip) return;
    if (element === this.currentElement) return;

    this.currentElement = element;
    this.highlightElement(element);
    this.showTooltip(element, e.clientX, e.clientY);
  };

  handleClick = (e) => {
    if (!this.enabled) return;

    e.preventDefault();
    e.stopPropagation();

    const element = document.elementFromPoint(e.clientX, e.clientY);
    if (!element || element === this.overlay || element === this.tooltip) return;

    console.log('🦆 Element clicked:', element);

    if (this.onInspectCallback) {
      this.onInspectCallback(element);
    }

    this.disable();
  };

  highlightElement(element) {
    if (!element) return;
    const rect = element.getBoundingClientRect();
    this.overlay.style.display = 'block';
    this.overlay.style.top = `${rect.top + window.scrollY}px`;
    this.overlay.style.left = `${rect.left + window.scrollX}px`;
    this.overlay.style.width = `${rect.width}px`;
    this.overlay.style.height = `${rect.height}px`;
  }

  showTooltip(element, x, y) {
    if (!element) return;

    const tagName = element.tagName.toLowerCase();
    const id = element.id ? `#${element.id}` : '';
    const classes = element.className && typeof element.className === 'string'
      ? `.${element.className.split(' ').filter(c => c).join('.')}`
      : '';

    this.tooltip.innerHTML = `<strong>${tagName}${id}${classes}</strong>`;
    this.tooltip.style.display = 'block';

    const tooltipRect = this.tooltip.getBoundingClientRect();
    let tooltipX = x + 10;
    let tooltipY = y + 10;

    if (tooltipX + tooltipRect.width > window.innerWidth) {
      tooltipX = x - tooltipRect.width - 10;
    }
    if (tooltipY + tooltipRect.height > window.innerHeight) {
      tooltipY = y - tooltipRect.height - 10;
    }

    this.tooltip.style.left = `${tooltipX + window.scrollX}px`;
    this.tooltip.style.top = `${tooltipY + window.scrollY}px`;
  }

  showNotification(message) {
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
    `;

    document.body.appendChild(notification);
  }

  hideNotification() {
    const notification = document.getElementById('quack-inspector-notification');
    if (notification) notification.remove();
  }
}

// =============================================================================
// MAIN CONTENT SCRIPT
// =============================================================================

let detector = null;
let overlay = null;

// Initialize
function initialize() {
  console.log('🦆 Initializing Quack Inspector');
  detector = new ComponentDetector();
  overlay = new InspectorOverlay();
  console.log('🦆 Quack Inspector ready!');
}

// Initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// Message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('🦆 Message received:', message);

  switch (message.type) {
    case 'toggle-inspector-mode':
      if (!overlay) {
        sendResponse({ success: false, error: 'Not initialized' });
        return;
      }

      if (overlay.enabled) {
        overlay.disable();
        sendResponse({ success: true, enabled: false });
      } else {
        overlay.enable((element) => {
          const componentInfo = detector.inspectElement(element);
          const markdown = MarkdownFormatter.format(componentInfo);
          const compact = MarkdownFormatter.formatCompact(componentInfo);

          // Copy to clipboard
          navigator.clipboard.writeText(markdown).then(() => {
            console.log('🦆 Copied to clipboard');

            // Save to history
            chrome.runtime.sendMessage({
              type: 'save-inspection',
              data: { componentInfo, markdown, compact, url: window.location.href }
            });

            // Show notification
            showCopiedNotification(compact);
          });
        });
        sendResponse({ success: true, enabled: true });
      }
      break;

    case 'get-framework':
      sendResponse({
        success: true,
        framework: detector ? detector.detectedFramework : 'unknown'
      });
      break;

    case 'copy-to-clipboard':
      navigator.clipboard.writeText(message.text).then(() => {
        sendResponse({ success: true });
      });
      break;

    default:
      sendResponse({ success: false, error: 'Unknown message type' });
  }

  return true;
});

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
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 3000);
}

console.log('🦆 Quack Inspector content script loaded');
