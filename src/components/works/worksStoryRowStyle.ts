import type { CSSProperties } from "react";

/** Per-row tint from workspace project color (`--works-story-accent`). */
export function worksStoryAccentStyle(hex?: string | null): CSSProperties | undefined {
  if (!hex) return undefined;
  return { "--works-story-accent": hex } as CSSProperties;
}
