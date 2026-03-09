/**
 * JsonRenderAdapter - Bridge between ComponentRegistry and json-render
 *
 * Detects json-render specs in structured outputs and renders them
 * using the Quack component catalog and registry.
 *
 * A json-render spec has the shape: { root: string, elements: Record<string, Element> }
 * where each Element has: type, props, children?, on?, visible?
 */
import { Renderer, ActionProvider } from '@json-render/react';
import { quackRegistry } from './quackRegistry';
import type { StructuredOutputRendererProps } from './ComponentRegistry';

// ===== Types =====

interface JsonRenderElement {
  type: string;
  props: Record<string, unknown>;
  children?: string[];
  on?: Record<string, unknown>;
  visible?: unknown;
}

export interface JsonRenderSpec {
  root: string;
  elements: Record<string, JsonRenderElement>;
}

// ===== Type Guard =====

export function isJsonRenderSpec(data: unknown): data is JsonRenderSpec {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.root === 'string' &&
    typeof obj.elements === 'object' &&
    obj.elements !== null &&
    typeof (obj.elements as Record<string, unknown>)[obj.root] === 'object'
  );
}

// ===== Component =====

export default function JsonRenderAdapter({ data }: StructuredOutputRendererProps<JsonRenderSpec>) {
  return (
    <ActionProvider handlers={{
      copy_to_clipboard: (params) => {
        const text = typeof params === 'string' ? params : JSON.stringify(params);
        navigator.clipboard.writeText(text);
      },
      open_link: (params) => {
        const url = typeof params === 'string' ? params : (params as Record<string, string>)?.url;
        if (url) window.open(url, '_blank');
      },
    }}>
      <div style={{ padding: '4px 0' }}>
        <Renderer spec={data as never} registry={quackRegistry} />
      </div>
    </ActionProvider>
  );
}
