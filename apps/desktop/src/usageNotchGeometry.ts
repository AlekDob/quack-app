// FILE: usageNotchGeometry.ts
// Purpose: Pure geometry for the macOS usage notch overlay.

export type UsageNotchPresentation = "compact" | "expanded";

export interface UsageNotchDisplayBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface UsageNotchBounds extends UsageNotchDisplayBounds {}

export const USAGE_NOTCH_COMPACT_SIZE = { width: 40, height: 40 } as const;
export const USAGE_NOTCH_EXPANDED_SIZE = { width: 760, height: 286 } as const;
export const USAGE_NOTCH_TOP_OFFSET = 0;

export function resolveUsageNotchBounds(input: {
  display: UsageNotchDisplayBounds;
  presentation: UsageNotchPresentation;
}): UsageNotchBounds {
  const preferred =
    input.presentation === "expanded" ? USAGE_NOTCH_EXPANDED_SIZE : USAGE_NOTCH_COMPACT_SIZE;
  const width = Math.min(preferred.width, Math.max(320, input.display.width));
  const height = Math.min(preferred.height, Math.max(32, input.display.height));
  return {
    x: Math.round(input.display.x + (input.display.width - width) / 2),
    y: input.display.y + USAGE_NOTCH_TOP_OFFSET,
    width,
    height,
  };
}
