import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import DocsSidebar from './DocsSidebar';
import DocsContent from './DocsContent';
import './DocsViewer.css';

export interface DocsMeta {
  title: string;
  description?: string;
  icon?: string;
  order?: number;
  sections?: string[];
  pages?: string[];
}

export interface DocsPage {
  path: string; // e.g., "guide/01-getting-started/introduction"
  title: string;
  content: string;
  section?: string;
}

export interface DocsSection {
  slug: string;
  title: string;
  icon?: string;
  order: number;
  pages: DocsPage[];
}

interface DocsViewerProps {
  initialPath?: string;
}

// GitHub raw content URL for quack-docs repo
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/AlekDob/quack-docs/main';

// Local development path
const LOCAL_DEV_BASE = '/Users/alekdob/Desktop/Dev/Personal/quack-app/docs/guide';

// Cache for fetched docs (persists during session)
const docsCache = new Map<string, string>();

// Check if we're in development mode
const isDevelopment = (): boolean => {
  // In Tauri, we can check if we're running in dev mode
  // by checking the window location or a custom flag
  return window.location.hostname === 'localhost' ||
         window.location.hostname === '127.0.0.1' ||
         window.location.protocol === 'tauri:';
};

export default function DocsViewer({ initialPath = 'guide/01-getting-started/introduction' }: DocsViewerProps) {
  const [sections, setSections] = useState<DocsSection[]>([]);
  const [currentPage, setCurrentPage] = useState<DocsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [source, setSource] = useState<'local' | 'github'>('local');

  // Fetch content from GitHub with caching
  const fetchFromGitHub = useCallback(async (relativePath: string): Promise<string> => {
    // Check cache first
    const cacheKey = `github:${relativePath}`;
    if (docsCache.has(cacheKey)) {
      return docsCache.get(cacheKey)!;
    }

    const url = `${GITHUB_RAW_BASE}/${relativePath}`;
    console.log(`[Docs] Fetching from GitHub: ${url}`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`GitHub fetch failed: ${response.status} ${response.statusText}`);
    }

    const content = await response.text();
    docsCache.set(cacheKey, content);
    return content;
  }, []);

  // Fetch content from local filesystem
  const fetchFromLocal = useCallback(async (relativePath: string): Promise<string> => {
    // Check cache first
    const cacheKey = `local:${relativePath}`;
    if (docsCache.has(cacheKey)) {
      return docsCache.get(cacheKey)!;
    }

    const absolutePath = `${LOCAL_DEV_BASE}/${relativePath}`;
    console.log(`[Docs] Fetching from local: ${absolutePath}`);

    const content = await invoke<string>('read_file_content', { path: absolutePath });
    docsCache.set(cacheKey, content);
    return content;
  }, []);

  // Smart fetch: try local first in dev, GitHub in production, with fallback
  const fetchContent = useCallback(async (relativePath: string): Promise<string> => {
    const inDev = isDevelopment();

    if (inDev) {
      // In development: try local first, fallback to GitHub
      try {
        const content = await fetchFromLocal(relativePath);
        setSource('local');
        return content;
      } catch (localErr) {
        console.warn(`[Docs] Local fetch failed, trying GitHub:`, localErr);
        try {
          const content = await fetchFromGitHub(relativePath);
          setSource('github');
          return content;
        } catch (githubErr) {
          throw new Error(`Failed to load docs from both local and GitHub`);
        }
      }
    } else {
      // In production: try GitHub first, fallback to local (bundled)
      try {
        const content = await fetchFromGitHub(relativePath);
        setSource('github');
        return content;
      } catch (githubErr) {
        console.warn(`[Docs] GitHub fetch failed, trying local:`, githubErr);
        try {
          const content = await fetchFromLocal(relativePath);
          setSource('local');
          return content;
        } catch (localErr) {
          throw new Error(`Failed to load docs from both GitHub and local`);
        }
      }
    }
  }, [fetchFromLocal, fetchFromGitHub]);

  // Load a _meta.json file
  const loadMetaFile = useCallback(async (relativePath: string): Promise<DocsMeta> => {
    try {
      const content = await fetchContent(relativePath);
      return JSON.parse(content);
    } catch (err) {
      console.error(`Failed to load meta file: ${relativePath}`, err);
      return { title: 'Unknown', sections: [], pages: [] };
    }
  }, [fetchContent]);

  // Load a markdown page
  const loadDocsPage = useCallback(async (path: string): Promise<DocsPage> => {
    // Convert path like "guide/01-getting-started/introduction" to relative path
    const relativePath = path.startsWith('guide/')
      ? path.substring(6) + '.md'  // Remove "guide/" prefix, add .md
      : path + '.md';

    const content = await fetchContent(relativePath);

    // Extract title from first # heading
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : path.split('/').pop() || 'Untitled';

    return {
      path,
      title,
      content,
    };
  }, [fetchContent]);

  // Load docs structure from _meta.json files
  const loadDocsStructure = useCallback(async (): Promise<DocsSection[]> => {
    // Load main guide _meta.json
    const guideMeta = await loadMetaFile('_meta.json');

    const sections: DocsSection[] = [];

    // Load each section
    for (const sectionSlug of guideMeta.sections || []) {
      const sectionMeta = await loadMetaFile(`${sectionSlug}/_meta.json`);

      const pages: DocsPage[] = [];
      for (const pageSlug of sectionMeta.pages || []) {
        try {
          const page = await loadDocsPage(`guide/${sectionSlug}/${pageSlug}`);
          pages.push(page);
        } catch (err) {
          console.warn(`Failed to load page: ${pageSlug}`, err);
        }
      }

      sections.push({
        slug: sectionSlug,
        title: sectionMeta.title,
        icon: sectionMeta.icon,
        order: sectionMeta.order || 999,
        pages,
      });
    }

    return sections.sort((a, b) => a.order - b.order);
  }, [loadMetaFile, loadDocsPage]);

  // Load documentation structure
  useEffect(() => {
    const loadDocs = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load the main docs structure
        const docsStructure = await loadDocsStructure();
        setSections(docsStructure);

        // Load initial page
        const page = await loadDocsPage(initialPath);
        setCurrentPage(page);
      } catch (err) {
        console.error('Failed to load docs:', err);
        setError(err instanceof Error ? err.message : 'Failed to load documentation');
      } finally {
        setLoading(false);
      }
    };

    void loadDocs();
  }, [initialPath, loadDocsStructure, loadDocsPage]);

  const handlePageChange = async (pagePath: string) => {
    try {
      const page = await loadDocsPage(pagePath);
      setCurrentPage(page);
    } catch (err) {
      console.error('Failed to load page:', err);
      setError('Failed to load page');
    }
  };

  // Clear cache and reload (useful for debugging)
  const handleRefresh = useCallback(async () => {
    docsCache.clear();
    setLoading(true);
    try {
      const docsStructure = await loadDocsStructure();
      setSections(docsStructure);
      if (currentPage) {
        const page = await loadDocsPage(currentPage.path);
        setCurrentPage(page);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh');
    } finally {
      setLoading(false);
    }
  }, [loadDocsStructure, loadDocsPage, currentPage]);

  if (loading) {
    return (
      <div className="docs-viewer docs-loading">
        <div className="docs-loading-spinner">Loading documentation...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="docs-viewer docs-error">
        <div className="docs-error-message">
          <h3>Error Loading Documentation</h3>
          <p>{error}</p>
          <button onClick={handleRefresh} className="docs-retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="docs-viewer">
      <DocsSidebar
        sections={sections}
        currentPage={currentPage}
        onPageSelect={handlePageChange}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <DocsContent
        page={currentPage}
        sections={sections}
        onPageChange={handlePageChange}
      />
      {/* Source indicator (only visible in dev) */}
      {isDevelopment() && (
        <div className="docs-source-indicator" title={`Source: ${source}`}>
          {source === 'github' ? 'GH' : 'Local'}
        </div>
      )}
    </div>
  );
}
