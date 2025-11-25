import { useState, useEffect } from 'react';
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

export default function DocsViewer({ initialPath = 'guide/01-getting-started/introduction' }: DocsViewerProps) {
  const [sections, setSections] = useState<DocsSection[]>([]);
  const [currentPage, setCurrentPage] = useState<DocsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
  }, [initialPath]);

  // Load docs structure from _meta.json files
  const loadDocsStructure = async (): Promise<DocsSection[]> => {
    // Load main guide _meta.json
    const guideMeta = await loadMetaFile('docs/guide/_meta.json');

    const sections: DocsSection[] = [];

    // Load each section
    for (const sectionSlug of guideMeta.sections || []) {
      const sectionMeta = await loadMetaFile(`docs/guide/${sectionSlug}/_meta.json`);

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
  };

  // Load a _meta.json file
  const loadMetaFile = async (path: string): Promise<DocsMeta> => {
    try {
      // In development, docs are in the project root
      // In production, they would be bundled (TODO: implement production path resolution)
      const absolutePath = `/Users/alekdob/Desktop/Dev/Personal/quack-app/${path}`;
      const content = await invoke<string>('read_file_content', {
        path: absolutePath
      });
      return JSON.parse(content);
    } catch (err) {
      console.error(`Failed to load meta file: ${path}`, err);
      return { title: 'Unknown', sections: [], pages: [] };
    }
  };

  // Load a markdown page
  const loadDocsPage = async (path: string): Promise<DocsPage> => {
    // In development, docs are in the project root
    // In production, they would be bundled (TODO: implement production path resolution)
    const absolutePath = `/Users/alekdob/Desktop/Dev/Personal/quack-app/docs/${path}.md`;
    const content = await invoke<string>('read_file_content', { path: absolutePath });

    // Extract title from first # heading
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : path.split('/').pop() || 'Untitled';

    return {
      path,
      title,
      content,
    };
  };

  const handlePageChange = async (pagePath: string) => {
    try {
      const page = await loadDocsPage(pagePath);
      setCurrentPage(page);
    } catch (err) {
      console.error('Failed to load page:', err);
      setError('Failed to load page');
    }
  };

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
    </div>
  );
}
