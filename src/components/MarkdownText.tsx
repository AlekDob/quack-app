import React, { useCallback, lazy, Suspense } from 'react';
import { CopyButton } from './chat/CopyButton';
import HtmlVisualizer from './chat/HtmlVisualizer';
import './MarkdownText.css';

const MermaidDiagram = lazy(() => import('./MermaidDiagram'));

/** File extensions that make inline code clickable */
const FILE_EXTENSIONS = /\.(tsx?|jsx?|css|scss|rs|py|go|html|json|md|mdx|yaml|yml|toml|sh|sql|xml|svg|java|kt|swift|rb|php|cpp|c|h|vue|mjs|cjs)$/i;

interface MarkdownTextProps {
  children: string;
}

/**
 * Simple markdown renderer for Claude messages
 * Supports: bold, headings, lists, horizontal rules, code blocks
 */
export default function MarkdownText({ children }: MarkdownTextProps) {
  const renderMarkdown = (text: string): React.ReactNode[] => {
    // Safety check for undefined/null
    if (!text) return [];

    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let currentList: string[] | null = null;
    let listKey = 0;
    let codeBlock: string[] | null = null;
    let codeBlockLang = '';
    let codeBlockKey = 0;
    let tableRows: string[][] | null = null;
    let tableKey = 0;
    let blockquoteLines: string[] | null = null;
    let blockquoteKey = 0;

    const flushList = () => {
      if (currentList && currentList.length > 0) {
        elements.push(
          <ul key={`list-${listKey++}`} className="md-list">
            {currentList.map((item, idx) => (
              <li key={idx} dangerouslySetInnerHTML={{ __html: processInlineMarkdown(item) }} />
            ))}
          </ul>
        );
        currentList = null;
      }
    };

    const flushCodeBlock = () => {
      if (codeBlock && codeBlock.length > 0) {
        const codeContent = codeBlock.join('\n');
        const key = codeBlockKey++;
        // Brain: quack-visualizer-inline-html
        if (codeBlockLang === 'quack-viz') {
          elements.push(<HtmlVisualizer key={`viz-${key}`} html={codeContent} />);
        } else if (codeBlockLang === 'mermaid') {
          elements.push(
            <Suspense key={`mermaid-${key}`} fallback={<div className="md-code-block-wrapper"><pre className="md-code-block"><code>{codeContent}</code></pre></div>}>
              <MermaidDiagram>{codeContent}</MermaidDiagram>
            </Suspense>
          );
        } else {
          elements.push(
            <div key={`code-wrapper-${key}`} className="md-code-block-wrapper">
              <CopyButton text={codeContent} />
              <pre key={`code-${key}`} className="md-code-block">
                <code>{codeContent}</code>
              </pre>
            </div>
          );
        }
        codeBlock = null;
        codeBlockLang = '';
      }
    };

    const flushTable = () => {
      if (tableRows && tableRows.length > 0) {
        const headerRow = tableRows[0];
        const bodyRows = tableRows.slice(1);
        elements.push(
          <div key={`table-wrap-${tableKey}`} className="md-table-wrapper">
            <table key={`table-${tableKey++}`} className="md-table">
              <thead>
                <tr>
                  {headerRow.map((cell, i) => (
                    <th key={i} dangerouslySetInnerHTML={{ __html: processInlineMarkdown(cell) }} />
                  ))}
                </tr>
              </thead>
              <tbody>
                {bodyRows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td key={ci} dangerouslySetInnerHTML={{ __html: processInlineMarkdown(cell) }} />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        tableRows = null;
      }
    };

    const flushBlockquote = () => {
      if (blockquoteLines && blockquoteLines.length > 0) {
        elements.push(
          <blockquote key={`bq-${blockquoteKey++}`} className="md-blockquote">
            {blockquoteLines.map((bqLine, idx) =>
              bqLine === '' ? (
                <br key={idx} />
              ) : (
                <p
                  key={idx}
                  className="md-paragraph"
                  dangerouslySetInnerHTML={{ __html: processInlineMarkdown(bqLine) }}
                />
              )
            )}
          </blockquote>
        );
        blockquoteLines = null;
      }
    };

    const escapeHtml = (str: string): string => {
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };

    const processInlineMarkdown = (line: string): string => {
      // Inline code: `code` - process FIRST to protect content from other transformations
      // File-path-like code gets a clickable data attribute
      line = line.replace(/`([^`]+)`/g, (_match, code: string) => {
        const escaped = escapeHtml(code);
        if (FILE_EXTENSIONS.test(code)) {
          return `<code class="md-inline-code md-file-link" data-filepath="${escaped}" role="button" tabindex="0">${escaped}</code>`;
        }
        return `<code class="md-inline-code">${escaped}</code>`;
      });

      // Links: [text](url) - must be processed BEFORE bold/italic to avoid conflicts
      line = line.replace(
        /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer" class="md-link">$1</a>'
      );

      // Bold: **text** or __text__ (must be processed BEFORE italic)
      // Brain: fix-markdown-underscore-intra-word
      line = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      line = line.replace(/(?<![a-zA-Z0-9])__(.+?)__(?![a-zA-Z0-9])/g, '<strong>$1</strong>');

      // Italic: *text* or _text_ (after bold to avoid conflicts)
      // Per CommonMark/GFM: underscore intra-word NON è emphasis (retry_request_status resta intatto)
      line = line.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
      line = line.replace(/(?<![a-zA-Z0-9_])_([^_]+)_(?![a-zA-Z0-9_])/g, '<em>$1</em>');

      return line;
    };

    lines.forEach((line, idx) => {
      // Code block delimiters — capture language tag (e.g. ```quack-viz, ```typescript)
      const fenceMatch = line.trim().match(/^```(\S*)/);
      if (fenceMatch) {
        if (codeBlock === null) {
          flushList();
          codeBlockLang = fenceMatch[1] || '';
          codeBlock = [];
        } else {
          flushCodeBlock();
        }
        return;
      }

      // Inside code block
      if (codeBlock !== null) {
        codeBlock.push(line);
        return;
      }

      // Table rows (lines starting and containing |)
      const isTableRow = line.trim().startsWith('|') && line.trim().endsWith('|');
      const isSeparatorRow = isTableRow && /^\|[\s\-:|]+\|$/.test(line.trim());

      if (isTableRow) {
        if (isSeparatorRow) {
          // Skip separator row (|---|---|)
          return;
        }
        if (!tableRows) {
          flushList();
          tableRows = [];
        }
        const cells = line.trim().slice(1, -1).split('|').map(c => c.trim());
        tableRows.push(cells);
        return;
      }

      // Flush table if we hit non-table content
      if (tableRows) {
        flushTable();
      }

      // Blockquote lines (> text)
      const bqMatch = line.match(/^>\s?(.*)/);
      if (bqMatch) {
        if (!blockquoteLines) {
          flushList();
          blockquoteLines = [];
        }
        blockquoteLines.push(bqMatch[1]);
        return;
      }

      // Flush blockquote if we hit non-blockquote content
      if (blockquoteLines) {
        flushBlockquote();
      }

      // Horizontal rule
      if (line.trim() === '---' || line.trim() === '***' || line.trim() === '___') {
        flushList();
        elements.push(<hr key={`hr-${idx}`} className="md-hr" />);
        return;
      }

      // Headings
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        flushList();
        const level = headingMatch[1].length;
        const text = headingMatch[2];

        // Dynamically create heading element
        const headingKey = `heading-${idx}`;
        const headingProps = {
          className: `md-heading md-h${level}`,
          dangerouslySetInnerHTML: { __html: processInlineMarkdown(text) },
        };

        if (level === 1) elements.push(<h1 key={headingKey} {...headingProps} />);
        else if (level === 2) elements.push(<h2 key={headingKey} {...headingProps} />);
        else if (level === 3) elements.push(<h3 key={headingKey} {...headingProps} />);
        else if (level === 4) elements.push(<h4 key={headingKey} {...headingProps} />);
        else if (level === 5) elements.push(<h5 key={headingKey} {...headingProps} />);
        else elements.push(<h6 key={headingKey} {...headingProps} />);

        return;
      }

      // List items
      const listMatch = line.match(/^[\s]*[-*+]\s+(.+)$/);
      if (listMatch) {
        if (!currentList) {
          currentList = [];
        }
        currentList.push(listMatch[1]);
        return;
      }

      // Flush list if we hit non-list content
      if (currentList) {
        flushList();
      }

      // Empty line
      if (line.trim() === '') {
        elements.push(<br key={`br-${idx}`} />);
        return;
      }

      // Normal paragraph
      elements.push(
        <p
          key={`p-${idx}`}
          className="md-paragraph"
          dangerouslySetInnerHTML={{ __html: processInlineMarkdown(line) }}
        />
      );
    });

    // Flush any remaining list, code block, table, or blockquote
    flushList();
    flushCodeBlock();
    flushTable();
    flushBlockquote();

    return elements;
  };

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const filepath = target.getAttribute('data-filepath');
    if (filepath && target.classList.contains('md-file-link')) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('quack:open-file', { detail: { path: filepath } }));
    }
  }, []);

  return <div className="markdown-content" onClick={handleClick}>{renderMarkdown(children)}</div>;
}
