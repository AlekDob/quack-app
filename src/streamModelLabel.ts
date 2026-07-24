/**
 * Cursor-style short model labels for stream / subagent chips
 * ("Haiku 4.5", "Opus 4.8") — distinct from picker aliases (071).
 */

const FAMILY_RE =
  /(?:^|[-_])(haiku|opus|sonnet|fable|mythos)(?:[-_](\d+)(?:[-_](\d+))?)?/i;

/** Title-case a family token. */
function titleFamily(f: string): string {
  return f ? f[0]!.toUpperCase() + f.slice(1).toLowerCase() : f;
}

/**
 * Format a raw Claude / API model id for compact stream UI.
 * Returns null for empty / synthetic ids that should not be shown.
 */
export function streamModelLabel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const id = raw.trim();
  if (!id || id === "<synthetic>" || id.toLowerCase() === "synthetic") {
    return null;
  }
  // Bare alias: "haiku" / "sonnet" / "opus"
  const bare = id.toLowerCase();
  if (/^(haiku|opus|sonnet|fable|mythos|default)$/.test(bare)) {
    return bare === "default" ? "Default" : titleFamily(bare);
  }
  const m = id.match(FAMILY_RE);
  if (!m) return id;
  const family = titleFamily(m[1]!);
  const major = m[2];
  const minor = m[3];
  if (major && minor) return `${family} ${major}.${minor}`;
  if (major) return `${family} ${major}`;
  return family;
}
