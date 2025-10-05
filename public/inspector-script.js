/**
 * Inspector Script - Injected into preview WebView
 * Handles element inspection, React component detection, and UI rendering
 */

(function() {
  'use strict';

  // State
  let isActive = false;
  let highlightedElement = null;
  let currentInspectorData = null;
  let inspectorHistory = [];

  // UI Elements
  const highlightBox = createHighlightBox();
  const toggleButton = createToggleButton();
  const inspectorPanel = createInspectorPanel();
  const historyPanel = createHistoryPanel();

  // Create highlight overlay
  function createHighlightBox() {
    const box = document.createElement('div');
    box.id = '__quack_inspector_highlight__';
    box.style.cssText = `
      position: fixed;
      pointer-events: none;
      border: 2px solid #10b981;
      background: rgba(16, 185, 129, 0.1);
      z-index: 999999;
      transition: all 0.1s ease;
      display: none;
    `;
    document.body.appendChild(box);
    return box;
  }

  // Create toggle button
  function createToggleButton() {
    const button = document.createElement('button');
    button.id = '__quack_inspector_toggle__';
    button.style.cssText = `
      position: fixed;
      bottom: 16px;
      right: 16px;
      z-index: 1000000;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border-radius: 9999px;
      font-size: 14px;
      font-weight: 500;
      backdrop-filter: blur(8px);
      transition: all 0.2s;
      cursor: pointer;
      border: 1px solid rgba(71, 85, 105, 0.75);
      background: rgba(15, 23, 42, 0.95);
      color: rgb(226, 232, 240);
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    `;

    const indicator = document.createElement('span');
    indicator.id = '__quack_inspector_indicator__';
    indicator.style.cssText = `
      width: 10px;
      height: 10px;
      border-radius: 9999px;
      border: 1px solid rgba(100, 116, 139, 0.7);
      background: rgba(30, 41, 59, 0.8);
    `;

    const text = document.createElement('span');
    text.textContent = 'Activate inspector';
    text.id = '__quack_inspector_text__';

    button.appendChild(indicator);
    button.appendChild(text);
    button.addEventListener('click', toggleInspector);

    document.body.appendChild(button);
    return button;
  }

  // Create inspector panel
  function createInspectorPanel() {
    const panel = document.createElement('div');
    panel.id = '__quack_inspector_panel__';
    panel.style.cssText = `
      position: fixed;
      top: 16px;
      right: 16px;
      width: 320px;
      z-index: 1000000;
      border-radius: 8px;
      border: 1px solid rgba(52, 211, 153, 0.3);
      background: rgba(15, 23, 42, 0.95);
      padding: 16px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      backdrop-filter: blur(8px);
      display: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    document.body.appendChild(panel);
    return panel;
  }

  // Create history panel
  function createHistoryPanel() {
    const panel = document.createElement('div');
    panel.id = '__quack_inspector_history__';
    panel.style.cssText = `
      position: fixed;
      bottom: 80px;
      right: 16px;
      width: 256px;
      z-index: 1000000;
      border-radius: 8px;
      border: 1px solid rgba(71, 85, 105, 0.5);
      background: rgba(15, 23, 42, 0.9);
      padding: 12px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
      backdrop-filter: blur(8px);
      display: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    const title = document.createElement('div');
    title.textContent = 'History';
    title.style.cssText = `
      font-size: 12px;
      font-weight: 500;
      color: rgb(148, 163, 184);
      margin-bottom: 8px;
    `;

    const list = document.createElement('div');
    list.id = '__quack_inspector_history_list__';
    list.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 6px;
    `;

    panel.appendChild(title);
    panel.appendChild(list);
    document.body.appendChild(panel);
    return panel;
  }

  // Toggle inspector
  function toggleInspector() {
    isActive = !isActive;

    const button = document.getElementById('__quack_inspector_toggle__');
    const indicator = document.getElementById('__quack_inspector_indicator__');
    const text = document.getElementById('__quack_inspector_text__');

    if (isActive) {
      button.style.borderColor = 'rgba(52, 211, 153, 0.7)';
      button.style.background = 'rgba(16, 185, 129, 0.2)';
      button.style.color = 'rgb(209, 250, 229)';
      button.style.boxShadow = '0 0 0 1px rgba(16, 185, 129, 0.25)';

      indicator.style.borderColor = 'rgba(52, 211, 153, 0.8)';
      indicator.style.background = 'rgba(52, 211, 153, 0.6)';
      indicator.style.animation = 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite';

      text.textContent = 'Inspector active';

      document.addEventListener('mousemove', handleMouseMove, true);
      document.addEventListener('click', handleClick, true);
    } else {
      button.style.borderColor = 'rgba(71, 85, 105, 0.75)';
      button.style.background = 'rgba(15, 23, 42, 0.95)';
      button.style.color = 'rgb(226, 232, 240)';
      button.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';

      indicator.style.borderColor = 'rgba(100, 116, 139, 0.7)';
      indicator.style.background = 'rgba(30, 41, 59, 0.8)';
      indicator.style.animation = '';

      text.textContent = 'Activate inspector';

      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('click', handleClick, true);

      highlightBox.style.display = 'none';
      inspectorPanel.style.display = 'none';
      highlightedElement = null;
      currentInspectorData = null;
    }
  }

  // Update inspector panel UI
  function updateInspectorPanel(data) {
    if (!data) {
      inspectorPanel.style.display = 'none';
      return;
    }

    currentInspectorData = data;
    inspectorPanel.style.display = 'block';

    const componentName = data.component?.componentName || data.element.tagName;
    const fileName = data.component?.fileName?.split('/').pop();
    const lineNumber = data.component?.lineNumber;

    inspectorPanel.innerHTML = `
      <div style="display: flex; align-items: start; justify-content: space-between; margin-bottom: 12px;">
        <div>
          <div style="font-size: 14px; font-weight: 600; color: rgb(52, 211, 153);">
            ${componentName}
          </div>
          ${fileName ? `
            <div style="margin-top: 4px; font-family: monospace; font-size: 12px; color: rgb(148, 163, 184);">
              ${fileName}${lineNumber ? `:${lineNumber}` : ''}
            </div>
          ` : ''}
        </div>
        <button
          onclick="window.__quackInspectorCopyForAI()"
          style="
            padding: 4px 8px;
            border-radius: 4px;
            border: 1px solid rgba(16, 185, 129, 0.4);
            background: rgba(16, 185, 129, 0.2);
            color: rgb(110, 231, 183);
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.2s;
          "
          onmouseover="this.style.background='rgba(16, 185, 129, 0.3)'"
          onmouseout="this.style.background='rgba(16, 185, 129, 0.2)'"
        >
          Copy for AI
        </button>
      </div>

      ${data.component?.componentStack && data.component.componentStack.length > 0 ? `
        <div style="margin-bottom: 12px; font-size: 12px; color: rgb(148, 163, 184);">
          <div style="margin-bottom: 4px; font-weight: 500; color: rgb(203, 213, 225);">Stack:</div>
          <div style="font-family: monospace;">${data.component.componentStack.join(' > ')}</div>
        </div>
      ` : ''}

      ${data.element.className ? `
        <div style="margin-bottom: 8px; font-size: 12px;">
          <span style="color: rgb(148, 163, 184);">Class: </span>
          <span style="font-family: monospace; color: rgb(203, 213, 225);">${data.element.className}</span>
        </div>
      ` : ''}

      ${data.element.id ? `
        <div style="margin-bottom: 8px; font-size: 12px;">
          <span style="color: rgb(148, 163, 184);">ID: </span>
          <span style="font-family: monospace; color: rgb(203, 213, 225);">${data.element.id}</span>
        </div>
      ` : ''}

      <div style="
        margin-top: 12px;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        ${data.hasReact
          ? 'background: rgba(16, 185, 129, 0.1); color: rgb(110, 231, 183);'
          : 'background: rgba(251, 191, 36, 0.1); color: rgb(253, 224, 71);'
        }
      ">
        ${data.hasReact ? '✓ React detected' : '⚠ No React DevTools'}
      </div>
    `;
  }

  // Update history panel
  function updateHistoryPanel() {
    const list = document.getElementById('__quack_inspector_history_list__');

    if (inspectorHistory.length === 0) {
      historyPanel.style.display = 'none';
      return;
    }

    historyPanel.style.display = 'block';

    list.innerHTML = inspectorHistory.map((item, index) => {
      const componentName = item.component?.componentName || item.element.tagName;
      const fileName = item.component?.fileName?.split('/').pop();

      return `
        <button
          onclick="window.__quackInspectorSelectHistory(${index})"
          style="
            width: 100%;
            padding: 6px 8px;
            border-radius: 4px;
            border: 1px solid rgba(71, 85, 105, 0.5);
            background: rgba(30, 41, 59, 0.5);
            text-align: left;
            cursor: pointer;
            transition: all 0.2s;
          "
          onmouseover="this.style.borderColor='rgba(52, 211, 153, 0.4)'; this.style.background='rgba(51, 65, 85, 0.5)'"
          onmouseout="this.style.borderColor='rgba(71, 85, 105, 0.5)'; this.style.background='rgba(30, 41, 59, 0.5)'"
        >
          <div style="font-weight: 500; font-size: 12px; color: rgb(226, 232, 240);">
            ${componentName}
          </div>
          ${fileName ? `
            <div style="margin-top: 2px; font-family: monospace; font-size: 11px; color: rgb(100, 116, 139); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${fileName}
            </div>
          ` : ''}
        </button>
      `;
    }).join('');
  }

  // Copy for AI
  window.__quackInspectorCopyForAI = function() {
    if (!currentInspectorData) return;

    const { element, component } = currentInspectorData;

    let text = '# Inspector Data\n\n';

    if (component?.componentName) {
      text += `## Component: ${component.componentName}\n\n`;
      if (component.fileName) {
        text += `**File:** ${component.fileName}`;
        if (component.lineNumber) {
          text += `:${component.lineNumber}`;
          if (component.columnNumber) {
            text += `:${component.columnNumber}`;
          }
        }
        text += '\n\n';
      }
      if (component.componentStack && component.componentStack.length > 0) {
        text += `**Stack:** ${component.componentStack.join(' > ')}\n\n`;
      }
      if (component.props) {
        text += `**Props:**\n\`\`\`json\n${JSON.stringify(component.props, null, 2)}\n\`\`\`\n\n`;
      }
    }

    text += `## Element: <${element.tagName}>\n\n`;
    if (element.className) text += `**Class:** ${element.className}\n`;
    if (element.id) text += `**ID:** ${element.id}\n`;

    navigator.clipboard.writeText(text).then(() => {
      console.log('📋 Copied to clipboard for AI!');
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  };

  // Select from history
  window.__quackInspectorSelectHistory = function(index) {
    const item = inspectorHistory[index];
    if (item) {
      updateInspectorPanel(item);
    }
  };

  // Get React Fiber from DOM element
  function getReactFiber(element) {
    const fiberKey = Object.keys(element).find(key =>
      key.startsWith('__reactFiber') ||
      key.startsWith('__reactInternalInstance')
    );

    if (fiberKey) {
      return element[fiberKey];
    }

    if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
      try {
        const renderers = window.__REACT_DEVTOOLS_GLOBAL_HOOK__.renderers;
        if (renderers && renderers.size > 0) {
          const renderer = Array.from(renderers.values())[0];
          if (renderer && renderer.findFiberByHostInstance) {
            return renderer.findFiberByHostInstance(element);
          }
        }
      } catch (e) {
        console.warn('React DevTools hook failed:', e);
      }
    }

    return null;
  }

  // Extract component info from fiber
  function getComponentInfo(fiber) {
    if (!fiber) return null;

    let current = fiber;
    const info = {
      componentName: null,
      fileName: null,
      lineNumber: null,
      columnNumber: null,
      props: null,
      componentStack: []
    };

    while (current) {
      const { type, _debugSource, _debugOwner, memoizedProps } = current;

      if (type && typeof type === 'function') {
        if (!info.componentName) {
          info.componentName = type.displayName || type.name || 'Anonymous';
        }
        info.componentStack.push(type.displayName || type.name || 'Unknown');
      } else if (type && typeof type === 'object' && type.$$typeof) {
        if (!info.componentName) {
          info.componentName = type.displayName || type.render?.name || 'Component';
        }
      }

      if (_debugSource && !info.fileName) {
        info.fileName = _debugSource.fileName;
        info.lineNumber = _debugSource.lineNumber;
        info.columnNumber = _debugSource.columnNumber;
      }

      if (memoizedProps && !info.props) {
        try {
          info.props = JSON.parse(JSON.stringify(memoizedProps, (key, value) => {
            if (typeof value === 'function') return '[Function]';
            if (typeof value === 'symbol') return '[Symbol]';
            if (value instanceof Node) return '[DOMNode]';
            return value;
          }));
        } catch (e) {
          info.props = { error: 'Could not serialize props' };
        }
      }

      current = current.return;

      if (info.componentName && info.fileName) break;
      if (!current || current.tag === 3) break;
    }

    return info;
  }

  // Get element info
  function getElementInfo(element) {
    const rect = element.getBoundingClientRect();

    return {
      tagName: element.tagName.toLowerCase(),
      className: element.className,
      id: element.id,
      textContent: element.textContent?.slice(0, 50),
      attributes: Array.from(element.attributes).reduce((acc, attr) => {
        acc[attr.name] = attr.value;
        return acc;
      }, {}),
      position: {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
      }
    };
  }

  // Handle mouse move
  function handleMouseMove(e) {
    if (!isActive) return;

    const element = e.target;
    if (!element || element === highlightBox) return;

    // Skip inspector UI elements
    if (element.id && element.id.startsWith('__quack_inspector')) return;
    if (element.closest('[id^="__quack_inspector"]')) return;

    highlightedElement = element;
    const rect = element.getBoundingClientRect();

    highlightBox.style.display = 'block';
    highlightBox.style.top = rect.top + 'px';
    highlightBox.style.left = rect.left + 'px';
    highlightBox.style.width = rect.width + 'px';
    highlightBox.style.height = rect.height + 'px';

    const fiber = getReactFiber(element);
    const componentInfo = getComponentInfo(fiber);
    const elementInfo = getElementInfo(element);

    const data = {
      element: elementInfo,
      component: componentInfo,
      hasReact: !!fiber
    };

    updateInspectorPanel(data);
  }

  // Handle click
  function handleClick(e) {
    if (!isActive) return;

    // Skip inspector UI elements
    if (e.target.id && e.target.id.startsWith('__quack_inspector')) return;
    if (e.target.closest('[id^="__quack_inspector"]')) return;

    e.preventDefault();
    e.stopPropagation();

    const element = e.target;
    const fiber = getReactFiber(element);
    const componentInfo = getComponentInfo(fiber);
    const elementInfo = getElementInfo(element);

    const data = {
      element: elementInfo,
      component: componentInfo,
      hasReact: !!fiber
    };

    // Add to history (max 5 items)
    inspectorHistory = [data, ...inspectorHistory.slice(0, 4)];
    updateHistoryPanel();
    updateInspectorPanel(data);
  }

  // Add pulse animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse {
      0%, 100% {
        opacity: 1;
      }
      50% {
        opacity: 0.5;
      }
    }
  `;
  document.head.appendChild(style);

  console.log('🦆 Quack Inspector loaded with UI!');
})();
