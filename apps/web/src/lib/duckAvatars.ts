// FILE: duckAvatars.ts
// Purpose: Stable duck avatar URLs for paperi / agent identity (ported from Codetta).
// Layer: Web lib
// Exports: DUCK_COUNT, duckAvatarFor, JACK_AVATAR_URL

/** Number of duck avatars shipped in public/images/ducks/ (duck1..duckN). */
export const DUCK_COUNT = 35;

export const JACK_AVATAR_URL = "/images/ducks/jack.jpeg";

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Public URL of a duck avatar. Same agent name always maps to the same duck.
 * `explicit` may be a path (`/images/...`) or a duck id (`duck3` / `3`).
 */
export function duckAvatarFor(name: string, explicit?: string): string {
  if (explicit) {
    if (explicit.startsWith("/")) return explicit;
    const m = explicit.match(/(\d+)/);
    if (m) return `/images/ducks/duck${m[1]}.jpeg`;
  }
  const idx = (hashName(name) % DUCK_COUNT) + 1;
  return `/images/ducks/duck${idx}.jpeg`;
}
