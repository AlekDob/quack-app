/**
 * Inspector Bridge Service
 * Manages communication between main app and inspector script in iframe
 */

export interface ElementInfo {
  tagName: string;
  className: string;
  id: string;
  textContent?: string;
  attributes: Record<string, string>;
  position: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}

export interface ComponentInfo {
  componentName: string | null;
  fileName: string | null;
  lineNumber: number | null;
  columnNumber: number | null;
  props: Record<string, unknown> | null;
  componentStack: string[];
}

export interface InspectorData {
  element: ElementInfo;
  component: ComponentInfo | null;
  hasReact: boolean;
}

export type InspectorEventType = 'hover' | 'click' | 'ready' | 'loaded';

export type InspectorEventHandler = (data: InspectorData | Record<string, unknown>) => void;

class InspectorBridge {
  private iframe: HTMLIFrameElement | null = null;
  private listeners = new Map<InspectorEventType, Set<InspectorEventHandler>>();
  private scriptInjected = false;
  private isActive = false;

  /**
   * Inject inspector script into iframe
   */
  async injectScript(iframe: HTMLIFrameElement): Promise<void> {
    this.iframe = iframe;

    // Wait for iframe to load
    if (!iframe.contentWindow) {
      throw new Error('Iframe content window not available');
    }

    try {
      // Check if we can access iframe content (same-origin or CORS allowed)
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

      if (!iframeDoc) {
        throw new Error('Cannot access iframe document');
      }

      // Create script element
      const script = iframeDoc.createElement('script');

      // Load script content from public folder
      const response = await fetch('/inspector-script.js');
      const scriptContent = await response.text();

      script.textContent = scriptContent;
      script.type = 'text/javascript';

      // Inject into iframe
      (iframeDoc.head || iframeDoc.body).appendChild(script);

      this.scriptInjected = true;

      console.log('🦆 Inspector script injected successfully');
    } catch (error) {
      console.error('Failed to inject inspector script:', error);

      // Fallback: try postMessage injection (less reliable but works cross-origin)
      this.fallbackInjection(iframe);
    }
  }

  /**
   * Fallback injection using postMessage (for cross-origin iframes)
   */
  private async fallbackInjection(iframe: HTMLIFrameElement): Promise<void> {
    try {
      const response = await fetch('/inspector-script.js');
      const scriptContent = await response.text();

      // Send script to iframe via postMessage
      iframe.contentWindow?.postMessage({
        type: 'quack-inspector-inject',
        script: scriptContent
      }, '*');

      // Add listener in iframe to execute received script
      const listenerScript = `
        window.addEventListener('message', (event) => {
          if (event.data.type === 'quack-inspector-inject') {
            const script = document.createElement('script');
            script.textContent = event.data.script;
            document.head.appendChild(script);
          }
        });
      `;

      // This might fail cross-origin, but worth trying
      const script = document.createElement('script');
      script.textContent = listenerScript;
      iframe.contentWindow?.document.head.appendChild(script);

      this.scriptInjected = true;
    } catch (error) {
      console.error('Fallback injection failed:', error);
      throw new Error('Could not inject inspector script (CORS restriction)');
    }
  }

  /**
   * Toggle inspector on/off
   */
  toggle(enabled: boolean): void {
    if (!this.iframe?.contentWindow) {
      console.warn('No iframe available for inspector');
      return;
    }

    this.isActive = enabled;

    this.iframe.contentWindow.postMessage({
      type: 'quack-inspector-toggle',
      enabled
    }, '*');
  }

  /**
   * Add event listener
   */
  on(event: InspectorEventType, handler: InspectorEventHandler): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  /**
   * Remove event listener
   */
  off(event: InspectorEventType, handler: InspectorEventHandler): void {
    this.listeners.get(event)?.delete(handler);
  }

  /**
   * Initialize message listener
   */
  init(): void {
    window.addEventListener('message', this.handleMessage);
  }

  /**
   * Cleanup
   */
  destroy(): void {
    window.removeEventListener('message', this.handleMessage);
    this.listeners.clear();
    this.iframe = null;
    this.scriptInjected = false;
  }

  /**
   * Handle messages from iframe
   */
  private handleMessage = (event: MessageEvent): void => {
    const { type, data } = event.data;

    switch (type) {
      case 'quack-inspector-hover':
        this.emit('hover', data);
        break;

      case 'quack-inspector-click':
        this.emit('click', data);
        break;

      case 'quack-inspector-ready':
        this.emit('ready', data);
        break;

      case 'quack-inspector-loaded':
        this.emit('loaded', data);
        break;
    }
  };

  /**
   * Emit event to listeners
   */
  private emit(event: InspectorEventType, data: unknown): void {
    this.listeners.get(event)?.forEach(handler => {
      try {
        handler(data as InspectorData);
      } catch (error) {
        console.error(`Error in inspector ${event} handler:`, error);
      }
    });
  }

  /**
   * Get current state
   */
  getState() {
    return {
      isActive: this.isActive,
      isInjected: this.scriptInjected,
      hasIframe: !!this.iframe
    };
  }
}

// Singleton instance
export const inspectorBridge = new InspectorBridge();
