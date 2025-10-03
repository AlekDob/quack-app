/**
 * Inspector Script - Injected into preview iframe
 * Handles element inspection, React component detection, and communication with parent
 */

(function() {
  'use strict';

  // State
  let isActive = false;
  let highlightedElement = null;
  const highlightBox = createHighlightBox();

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

  // Get React Fiber from DOM element
  function getReactFiber(element) {
    // Try multiple React internal keys (React 16-18+)
    const fiberKey = Object.keys(element).find(key =>
      key.startsWith('__reactFiber') ||
      key.startsWith('__reactInternalInstance')
    );

    if (fiberKey) {
      return element[fiberKey];
    }

    // Fallback: check for React DevTools global hook
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

    // Walk up the fiber tree to find component info
    while (current) {
      const { type, _debugSource, _debugOwner, memoizedProps } = current;

      // Get component name
      if (type && typeof type === 'function') {
        if (!info.componentName) {
          info.componentName = type.displayName || type.name || 'Anonymous';
        }
        info.componentStack.push(type.displayName || type.name || 'Unknown');
      } else if (type && typeof type === 'object' && type.$$typeof) {
        // Handle memo, forwardRef, etc.
        if (!info.componentName) {
          info.componentName = type.displayName || type.render?.name || 'Component';
        }
      }

      // Get source location (only in dev mode)
      if (_debugSource && !info.fileName) {
        info.fileName = _debugSource.fileName;
        info.lineNumber = _debugSource.lineNumber;
        info.columnNumber = _debugSource.columnNumber;
      }

      // Get props (sanitize for transfer)
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

      // Stop if we found everything or went too far up
      if (info.componentName && info.fileName) break;
      if (!current || current.tag === 3) break; // 3 = HostRoot
    }

    return info;
  }

  // Get element info (fallback when React is not available)
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

    highlightedElement = element;
    const rect = element.getBoundingClientRect();

    // Update highlight box
    highlightBox.style.display = 'block';
    highlightBox.style.top = rect.top + 'px';
    highlightBox.style.left = rect.left + 'px';
    highlightBox.style.width = rect.width + 'px';
    highlightBox.style.height = rect.height + 'px';

    // Collect info
    const fiber = getReactFiber(element);
    const componentInfo = getComponentInfo(fiber);
    const elementInfo = getElementInfo(element);

    // Send to parent
    window.parent.postMessage({
      type: 'quack-inspector-hover',
      data: {
        element: elementInfo,
        component: componentInfo,
        hasReact: !!fiber
      }
    }, '*');
  }

  // Handle click
  function handleClick(e) {
    if (!isActive) return;

    e.preventDefault();
    e.stopPropagation();

    const element = e.target;
    const fiber = getReactFiber(element);
    const componentInfo = getComponentInfo(fiber);
    const elementInfo = getElementInfo(element);

    window.parent.postMessage({
      type: 'quack-inspector-click',
      data: {
        element: elementInfo,
        component: componentInfo,
        hasReact: !!fiber
      }
    }, '*');
  }

  // Listen for commands from parent
  window.addEventListener('message', (event) => {
    if (event.data.type === 'quack-inspector-toggle') {
      isActive = event.data.enabled;

      if (isActive) {
        document.addEventListener('mousemove', handleMouseMove, true);
        document.addEventListener('click', handleClick, true);
        highlightBox.style.display = 'none';
      } else {
        document.removeEventListener('mousemove', handleMouseMove, true);
        document.removeEventListener('click', handleClick, true);
        highlightBox.style.display = 'none';
        highlightedElement = null;
      }

      window.parent.postMessage({
        type: 'quack-inspector-ready',
        data: {
          active: isActive,
          hasReactDevTools: !!window.__REACT_DEVTOOLS_GLOBAL_HOOK__
        }
      }, '*');
    }
  });

  // Notify parent that script is loaded
  window.parent.postMessage({
    type: 'quack-inspector-loaded',
    data: {
      hasReactDevTools: !!window.__REACT_DEVTOOLS_GLOBAL_HOOK__,
      hasReact: !!(window.React || document.querySelector('[data-reactroot], [data-reactid]'))
    }
  }, '*');

  console.log('🦆 Quack Inspector loaded!');
})();
