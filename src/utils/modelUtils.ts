// Brain: 005-performance-critical-refactor
// Extracted from App.tsx to module level — avoids recreation on every render

// Map legacy short names to Supabase model IDs
const MODEL_LEGACY_MAP: Record<string, string> = {
  'sonnet': 'sonnet46',
  'sonnet45': 'sonnet46', // Sonnet 4.5 deprecated
  'opus': 'opus48',
  'opus47': 'opus48', // Opus 4.7 superseded by 4.8 (2026-05-28)
  'haiku': 'haiku45',
};

/**
 * Normalize model IDs to Supabase IDs (e.g. "sonnet46", "opus46", "haiku45").
 * Handles legacy short names ("sonnet", "opus") and full API IDs ("claude-sonnet-4-5-...").
 */
export function normalizeModelName(model: string): string {
  if (MODEL_LEGACY_MAP[model]) return MODEL_LEGACY_MAP[model];

  // Normalize full API model IDs to Supabase IDs
  if (model.startsWith('claude-')) {
    if (model.includes('opus')) return 'opus48';
    if (model.includes('haiku')) return 'haiku45';
    if (model.includes('sonnet')) return 'sonnet46';
  }

  // Supabase IDs (sonnet46, opus46, haiku45) pass through as-is
  return model;
}
