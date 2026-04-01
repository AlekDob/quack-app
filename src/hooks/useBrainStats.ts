/**
 * useBrainStats Hook
 *
 * Computes Brain knowledge stats for the current project.
 * Used by BrainContextBanner to show stats at session start.
 */

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface BrainStats {
  gotchas: number;
  bugs: number;
  patterns: number;
  decisions: number;
  diary: number;
  total: number;
  lastDiary: string | null;
  staleCount: number;
}

interface UseBrainStatsResult {
  stats: BrainStats | null;
  isLoading: boolean;
}

const EMPTY_STATS: BrainStats = {
  gotchas: 0, bugs: 0, patterns: 0,
  decisions: 0, diary: 0, total: 0,
  lastDiary: null, staleCount: 0,
};

export function useBrainStats(
  basePath: string | undefined,
  sessionId: string | undefined
): UseBrainStatsResult {
  const [stats, setStats] = useState<BrainStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!basePath) return;

    let cancelled = false;
    setIsLoading(true);

    computeStats(basePath).then((result) => {
      if (!cancelled) {
        setStats(result);
        setIsLoading(false);
      }
    }).catch(() => {
      if (!cancelled) {
        setStats(null);
        setIsLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [basePath, sessionId]);

  return { stats, isLoading };
}

async function computeStats(basePath: string): Promise<BrainStats> {
  const docsPath = `${basePath}/documentation`;
  const stats = { ...EMPTY_STATS };

  const dirs: Array<{ key: keyof BrainStats; name: string }> = [
    { key: 'gotchas', name: 'gotchas' },
    { key: 'bugs', name: 'bugs' },
    { key: 'patterns', name: 'patterns' },
    { key: 'decisions', name: 'decisions' },
    { key: 'diary', name: 'diary' },
  ];

  for (const dir of dirs) {
    try {
      const listing = await invoke<{
        entries: Array<{ name: string; is_dir: boolean }>;
      }>('list_directory', { path: `${docsPath}/${dir.name}` });

      const mdFiles = listing.entries.filter(
        (e) => !e.is_dir && e.name.endsWith('.md')
      );
      (stats[dir.key] as number) = mdFiles.length;

      // Get last diary date
      if (dir.key === 'diary' && mdFiles.length > 0) {
        const sorted = mdFiles
          .map((f) => f.name.replace('.md', ''))
          .sort()
          .reverse();
        stats.lastDiary = sorted[0];
      }
    } catch {
      // Directory doesn't exist — skip
    }
  }

  stats.total = stats.gotchas + stats.bugs
    + stats.patterns + stats.decisions;

  // Stale count: check a sample of entries
  stats.staleCount = await countStaleEntries(docsPath);

  return stats;
}

async function countStaleEntries(docsPath: string): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  let stale = 0;

  for (const dir of ['gotchas', 'bugs', 'patterns']) {
    try {
      const listing = await invoke<{
        entries: Array<{ name: string; path: string; is_dir: boolean }>;
      }>('list_directory', { path: `${docsPath}/${dir}` });

      const mdFiles = listing.entries.filter(
        (e) => !e.is_dir && e.name.endsWith('.md')
      );

      // Sample max 10 files per dir to keep it fast
      const sample = mdFiles.slice(0, 10);
      for (const file of sample) {
        try {
          const content = await invoke<string>(
            'read_file_content',
            { path: file.path }
          );
          const match = content.match(
            /last_verified:\s*(\d{4}-\d{2}-\d{2})/
          );
          if (match) {
            if (new Date(match[1]) < cutoff) stale++;
          } else {
            stale++;
          }
        } catch { /* skip unreadable */ }
      }
    } catch { /* dir missing */ }
  }

  return stale;
}
