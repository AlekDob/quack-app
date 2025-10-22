// Component detection engine for React, Vue, and Angular
console.log('🦆 Quack Component Detector loaded');

class ComponentDetector {
  constructor() {
    this.detectedFramework = null;
    this.detectFramework();
  }

  // Detect which framework is being used
  detectFramework() {
    // Check for React
    if (this.hasReact()) {
      this.detectedFramework = 'react';
      console.log('🦆 Detected React');
      return;
    }

    // Check for Vue
    if (this.hasVue()) {
      this.detectedFramework = 'vue';
      console.log('🦆 Detected Vue');
      return;
    }

    // Check for Angular
    if (this.hasAngular()) {
      this.detectedFramework = 'angular';
      console.log('🦆 Detected Angular');
      return;
    }

    // Fallback to generic DOM inspection
    this.detectedFramework = 'generic';
    console.log('🦆 No specific framework detected, using generic mode');
  }

  // Check if React is present
  hasReact() {
    return !!(
      window.React ||
      document.querySelector('[data-reactroot]') ||
      document.querySelector('[data-reactid]') ||
      this.findReactInstance(document.body)
    );
  }

  // Check if Vue is present
  hasVue() {
    return !!(
      window.Vue ||
      document.querySelector('[data-v-]') ||
      this.findVueInstance(document.body)
    );
  }

  // Check if Angular is present
  hasAngular() {
    return !!(
      window.ng ||
      window.angular ||
      document.querySelector('[ng-version]') ||
      document.querySelector('[ng-app]')
    );
  }

  // Find React fiber instance from DOM element
  findReactInstance(element) {
    if (!element) return null;

    // React 16+ (Fiber)
    for (let key in element) {
      if (key.startsWith('__reactInternalInstance$') || key.startsWith('__reactFiber')) {
        return element[key];
      }
    }

    return null;
  }

  // Find Vue instance from DOM element
  findVueInstance(element) {
    if (!element) return null;

    // Vue 2
    if (element.__vue__) {
      return element.__vue__;
    }

    // Vue 3
    if (element.__vueParentComponent) {
      return element.__vueParentComponent;
    }

    return null;
  }

  // Main inspection function
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

  // Inspect React component
  inspectReactComponent(element) {
    const fiber = this.findReactInstance(element);
    if (!fiber) return this.inspectGenericElement(element);

    try {
      const componentInfo = {
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

      console.log('🦆 React component info:', componentInfo);
      return componentInfo;
    } catch (error) {
      console.error('🦆 Error inspecting React component:', error);
      return this.inspectGenericElement(element);
    }
  }

  // Get React component name
  getReactComponentName(fiber) {
    if (!fiber) return 'Unknown';

    // Try to get component name from fiber
    if (fiber.type) {
      if (typeof fiber.type === 'function') {
        return fiber.type.name || fiber.type.displayName || 'Anonymous';
      }
      if (typeof fiber.type === 'string') {
        return fiber.type;
      }
    }

    // Traverse to find component
    let currentFiber = fiber;
    while (currentFiber) {
      if (currentFiber.type && typeof currentFiber.type === 'function') {
        return currentFiber.type.name || currentFiber.type.displayName || 'Anonymous';
      }
      currentFiber = currentFiber.return;
    }

    return 'Unknown';
  }

  // Get React props
  getReactProps(fiber) {
    try {
      return fiber.memoizedProps || fiber.pendingProps || {};
    } catch (error) {
      return {};
    }
  }

  // Get React state
  getReactState(fiber) {
    try {
      return fiber.memoizedState || {};
    } catch (error) {
      return {};
    }
  }

  // Get React hooks
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

  // Get React source file from stack trace
  getReactSourceFile(fiber) {
    try {
      if (fiber.type && fiber.type.toString) {
        const source = fiber.type.toString();
        // Try to extract file path from source map
        const match = source.match(/\/([^\/]+\.(tsx?|jsx?))/);
        if (match) return match[0];
      }

      // Try to get from _debugSource
      if (fiber._debugSource) {
        return `${fiber._debugSource.fileName}:${fiber._debugSource.lineNumber}`;
      }

      return 'Unknown';
    } catch (error) {
      return 'Unknown';
    }
  }

  // Get React parent component chain
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

  // Inspect Vue component
  inspectVueComponent(element) {
    const vueInstance = this.findVueInstance(element);
    if (!vueInstance) return this.inspectGenericElement(element);

    try {
      const componentInfo = {
        framework: 'Vue',
        componentName: this.getVueComponentName(vueInstance),
        props: vueInstance.$props || {},
        data: vueInstance.$data || {},
        computed: this.getVueComputed(vueInstance),
        file: this.getVueSourceFile(vueInstance),
        parentChain: this.getVueParentChain(vueInstance),
        domPath: this.getDOMPath(element),
        element: element
      };

      console.log('🦆 Vue component info:', componentInfo);
      return componentInfo;
    } catch (error) {
      console.error('🦆 Error inspecting Vue component:', error);
      return this.inspectGenericElement(element);
    }
  }

  // Get Vue component name
  getVueComponentName(instance) {
    if (!instance) return 'Unknown';

    // Vue 2
    if (instance.$options) {
      return instance.$options.name || instance.$options._componentTag || 'Anonymous';
    }

    // Vue 3
    if (instance.type) {
      return instance.type.name || instance.type.__name || 'Anonymous';
    }

    return 'Unknown';
  }

  // Get Vue computed properties
  getVueComputed(instance) {
    try {
      const computed = {};
      if (instance._computedWatchers) {
        for (let key in instance._computedWatchers) {
          computed[key] = instance._computedWatchers[key].value;
        }
      }
      return computed;
    } catch (error) {
      return {};
    }
  }

  // Get Vue source file
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

  // Get Vue parent chain
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

  // Inspect Angular component
  inspectAngularComponent(element) {
    try {
      // Use Angular debug API
      const debugElement = window.ng?.probe?.(element);
      if (!debugElement) return this.inspectGenericElement(element);

      const componentInfo = {
        framework: 'Angular',
        componentName: debugElement.name || 'Unknown',
        properties: debugElement.properties || {},
        injector: debugElement.injector || null,
        domPath: this.getDOMPath(element),
        element: element
      };

      console.log('🦆 Angular component info:', componentInfo);
      return componentInfo;
    } catch (error) {
      console.error('🦆 Error inspecting Angular component:', error);
      return this.inspectGenericElement(element);
    }
  }

  // Fallback: inspect generic DOM element
  inspectGenericElement(element) {
    return {
      framework: 'Generic',
      tagName: element.tagName.toLowerCase(),
      id: element.id || null,
      className: element.className || null,
      attributes: this.getAttributes(element),
      domPath: this.getDOMPath(element),
      computedStyles: this.getComputedStyles(element),
      element: element
    };
  }

  // Get DOM path (CSS selector path)
  getDOMPath(element) {
    const path = [];
    let current = element;

    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();

      if (current.id) {
        selector += `#${current.id}`;
        path.unshift(selector);
        break; // ID is unique, stop here
      }

      if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\s+/).filter(c => c);
        if (classes.length > 0) {
          selector += `.${classes.join('.')}`;
        }
      }

      // Add nth-child if needed for specificity
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children);
        const index = siblings.indexOf(current);
        if (siblings.length > 1) {
          selector += `:nth-child(${index + 1})`;
        }
      }

      path.unshift(selector);
      current = current.parentElement;
    }

    return path.join(' > ');
  }

  // Get element attributes
  getAttributes(element) {
    const attrs = {};
    for (let attr of element.attributes) {
      attrs[attr.name] = attr.value;
    }
    return attrs;
  }

  // Get computed styles (only important ones)
  getComputedStyles(element) {
    const computed = window.getComputedStyle(element);
    return {
      display: computed.display,
      position: computed.position,
      width: computed.width,
      height: computed.height,
      backgroundColor: computed.backgroundColor,
      color: computed.color
    };
  }
}

// Export for use in content script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ComponentDetector;
}
