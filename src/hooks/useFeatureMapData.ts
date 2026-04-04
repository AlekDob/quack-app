/**
 * Hook to fetch and build the feature map graph.
 * Uses existing Tauri commands: list_directory + read_file_content (zero new Rust).
 */

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { buildFeatureGraph } from '../services/featureMapService';
import type { FeatureGraph } from '../components/featureMap/featureMapTypes';
import { normalizeToForwardSlash } from '../utils/platform';

interface DirectoryEntry {
  name: string;
  path: string;
  is_dir: boolean;
}

interface DirectoryListing {
  path: string;
  entries: DirectoryEntry[];
}

interface UseFeatureMapDataReturn {
  graph: FeatureGraph | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useFeatureMapData(projectPath: string | undefined): UseFeatureMapDataReturn {
  const [graph, setGraph] = useState<FeatureGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!projectPath) {
      setError('No active project');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Build absolute path to documentation/features/ (normalize \ to / for Windows)
      const normProject = normalizeToForwardSlash(projectPath);
      const featuresDir = `${normProject}/documentation/features`;

      // list_directory may fail if the directory doesn't exist — treat as empty
      let listing: DirectoryListing;
      try {
        listing = await invoke<DirectoryListing>('list_directory', {
          path: featuresDir,
        });
      } catch {
        // Directory doesn't exist — show empty state, not an error
        setGraph({ nodes: [], links: [] });
        setLoading(false);
        return;
      }

      const mdFiles = listing.entries.filter(
        e => !e.is_dir && e.name.endsWith('.md'),
      );

      if (mdFiles.length === 0) {
        setGraph({ nodes: [], links: [] });
        setLoading(false);
        return;
      }

      // Read all feature docs in parallel
      const docs = await Promise.all(
        mdFiles.map(async (file) => {
          const content = await invoke<string>('read_file_content', {
            path: file.path,
          });
          return { raw: content, path: file.path };
        }),
      );

      const featureGraph = buildFeatureGraph(docs);
      setGraph(featureGraph);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      console.error('[FeatureMap] Failed to load feature docs:', err);
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { graph, loading, error, refresh: fetchData };
}
