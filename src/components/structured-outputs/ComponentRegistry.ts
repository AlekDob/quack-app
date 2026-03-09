/**
 * ComponentRegistry - Registry pattern for structured output renderers
 *
 * Maps structured output types to React components via type guards.
 * New output types can be registered without modifying StreamMessage.tsx.
 */
import type { ComponentType } from 'react';

export interface StructuredOutputAction {
  type: string;
  payload: unknown;
}

export interface StructuredOutputRendererProps<T = unknown> {
  data: T;
  onAction?: (action: StructuredOutputAction) => void;
}

interface RegisteredRenderer {
  typeGuard: (data: unknown) => boolean;
  component: ComponentType<StructuredOutputRendererProps<never>>;
  priority: number; // higher = checked first
}

class ComponentRegistry {
  private renderers: RegisteredRenderer[] = [];

  register(renderer: RegisteredRenderer): void {
    this.renderers.push(renderer);
    this.renderers.sort((a, b) => b.priority - a.priority);
  }

  find(data: unknown): ComponentType<StructuredOutputRendererProps<never>> | null {
    for (const r of this.renderers) {
      if (r.typeGuard(data)) return r.component;
    }
    return null;
  }
}

export const structuredOutputRegistry = new ComponentRegistry();
