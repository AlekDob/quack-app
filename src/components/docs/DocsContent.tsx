import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import type { DocsPage, DocsSection } from './DocsViewer';
import DocsComponents from './DocsComponents';

interface DocsContentProps {
  page: DocsPage | null;
  sections: DocsSection[];
  onPageChange: (pagePath: string) => void;
}

interface PageNavigation {
  prev?: { path: string; title: string };
  next?: { path: string; title: string };
}

export default function DocsContent({ page, sections, onPageChange }: DocsContentProps) {
  // Calculate previous and next pages
  const navigation = useMemo<PageNavigation>(() => {
    if (!page) return {};

    const allPages = sections.flatMap(s => s.pages);
    const currentIndex = allPages.findIndex(p => p.path === page.path);

    if (currentIndex === -1) return {};

    return {
      prev: currentIndex > 0 ? allPages[currentIndex - 1] : undefined,
      next: currentIndex < allPages.length - 1 ? allPages[currentIndex + 1] : undefined,
    };
  }, [page, sections]);

  // Extract headings for TOC
  const headings = useMemo(() => {
    if (!page) return [];

    const headingRegex = /^(#{2,3})\s+(.+)$/gm;
    const matches: { level: number; text: string; id: string }[] = [];
    let match;

    while ((match = headingRegex.exec(page.content)) !== null) {
      const level = match[1].length;
      const text = match[2];
      const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');

      matches.push({ level, text, id });
    }

    return matches;
  }, [page]);

  if (!page) {
    return (
      <div className="docs-content empty">
        <p>Select a page to view documentation</p>
      </div>
    );
  }

  return (
    <div className="docs-content-wrapper">
      {/* Table of Contents */}
      {headings.length > 0 && (
        <aside className="docs-toc">
          <h4>On This Page</h4>
          <nav>
            {headings.map((heading) => (
              <a
                key={heading.id}
                href={`#${heading.id}`}
                className={`docs-toc-link level-${heading.level}`}
              >
                {heading.text}
              </a>
            ))}
          </nav>
        </aside>
      )}

      {/* Main Content */}
      <div className="docs-content">
        <article className="docs-article">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[
              rehypeRaw,
              rehypeSlug,
              [rehypeAutolinkHeadings, { behavior: 'wrap' }],
            ]}
            components={DocsComponents}
          >
            {page.content}
          </ReactMarkdown>
        </article>

        {/* Navigation */}
        {(navigation.prev || navigation.next) && (
          <nav className="docs-page-navigation">
            {navigation.prev && (
              <button
                type="button"
                className="docs-nav-button prev"
                onClick={() => onPageChange(navigation.prev!.path)}
              >
                <span className="docs-nav-label">Previous</span>
                <span className="docs-nav-title">{navigation.prev.title}</span>
              </button>
            )}
            {navigation.next && (
              <button
                type="button"
                className="docs-nav-button next"
                onClick={() => onPageChange(navigation.next!.path)}
              >
                <span className="docs-nav-label">Next</span>
                <span className="docs-nav-title">{navigation.next.title}</span>
              </button>
            )}
          </nav>
        )}
      </div>
    </div>
  );
}
