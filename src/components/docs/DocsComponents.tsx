import { useState } from 'react';
import type { Components } from 'react-markdown';

// Callout component for info/warning/error/tip boxes
function Callout({ children, type = 'info' }: { children: React.ReactNode; type?: 'info' | 'warning' | 'error' | 'tip' }) {
  const icons = {
    info: 'ℹ️',
    warning: '⚠️',
    error: '❌',
    tip: '💡',
  };

  return (
    <div className={`docs-callout ${type}`}>
      <div className="docs-callout-icon">{icons[type]}</div>
      <div className="docs-callout-content">{children}</div>
    </div>
  );
}

// Steps component for numbered instructions
function Steps({ children }: { children: React.ReactNode }) {
  return <div className="docs-steps">{children}</div>;
}

// Tabs component for tabbed content
function Tabs({ items, children }: { items: string[]; children: React.ReactNode }) {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="docs-tabs">
      <div className="docs-tabs-header">
        {items.map((item, index) => (
          <button
            key={index}
            type="button"
            className={`docs-tab-button ${activeTab === index ? 'active' : ''}`}
            onClick={() => setActiveTab(index)}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="docs-tabs-content">
        {Array.isArray(children) ? children[activeTab] : children}
      </div>
    </div>
  );
}

// Card component for clickable cards
function Card({ title, href, children }: { title?: string; href?: string; children: React.ReactNode }) {
  const content = (
    <>
      {title && <h4 className="docs-card-title">{title}</h4>}
      <div className="docs-card-content">{children}</div>
    </>
  );

  if (href) {
    return (
      <a href={href} className="docs-card clickable">
        {content}
      </a>
    );
  }

  return <div className="docs-card">{content}</div>;
}

// Custom components for react-markdown
const DocsComponents: Components = {
  // Code blocks with syntax highlighting
  code({ node, inline, className, children, ...props }: any) {
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : '';

    if (inline) {
      return (
        <code className="docs-inline-code" {...props}>
          {children}
        </code>
      );
    }

    return (
      <div className="docs-code-block-wrapper">
        {language && <div className="docs-code-language">{language}</div>}
        <pre className="docs-code-block">
          <code className={className} {...props}>
            {children}
          </code>
        </pre>
        <button
          type="button"
          className="docs-code-copy"
          onClick={() => {
            const text = String(children).replace(/\n$/, '');
            navigator.clipboard.writeText(text);
          }}
          title="Copy code"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="5" y="5" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="1.5" />
            <path d="M3 11V3a2 2 0 0 1 2-2h8" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      </div>
    );
  },

  // Headings with anchors
  h1({ children, ...props }) {
    return (
      <h1 className="docs-h1" {...props}>
        {children}
      </h1>
    );
  },

  h2({ children, ...props }) {
    return (
      <h2 className="docs-h2" {...props}>
        {children}
      </h2>
    );
  },

  h3({ children, ...props }) {
    return (
      <h3 className="docs-h3" {...props}>
        {children}
      </h3>
    );
  },

  // Tables
  table({ children, ...props }) {
    return (
      <div className="docs-table-wrapper">
        <table className="docs-table" {...props}>
          {children}
        </table>
      </div>
    );
  },

  // Blockquotes (can be used for callouts)
  blockquote({ children, ...props }) {
    // Check if blockquote starts with a special marker for callouts
    const firstChild = Array.isArray(children) ? children[0] : children;
    const text = typeof firstChild === 'string' ? firstChild : '';

    const calloutMatch = text.match(/^\[!(info|warning|error|tip)\]/i);
    if (calloutMatch) {
      const type = calloutMatch[1].toLowerCase() as 'info' | 'warning' | 'error' | 'tip';
      // Remove the marker from content
      const contentWithoutMarker = String(children).replace(/^\[!.*?\]\s*/, '');

      return <Callout type={type}>{contentWithoutMarker}</Callout>;
    }

    return (
      <blockquote className="docs-blockquote" {...props}>
        {children}
      </blockquote>
    );
  },

  // Links (open external links in new tab)
  a({ href, children, ...props }) {
    const isExternal = href?.startsWith('http');

    return (
      <a
        href={href}
        target={isExternal ? '_blank' : undefined}
        rel={isExternal ? 'noopener noreferrer' : undefined}
        className="docs-link"
        {...props}
      >
        {children}
        {isExternal && (
          <svg
            className="docs-link-external"
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M10 3L6 7M10 3H7M10 3V6M10 10H2V2H5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </a>
    );
  },

  // Lists
  ul({ children, ...props }) {
    return (
      <ul className="docs-ul" {...props}>
        {children}
      </ul>
    );
  },

  ol({ children, ...props }) {
    return (
      <ol className="docs-ol" {...props}>
        {children}
      </ol>
    );
  },

  // Paragraphs
  p({ children, ...props }) {
    return (
      <p className="docs-p" {...props}>
        {children}
      </p>
    );
  },

  // Horizontal rule
  hr({ ...props }) {
    return <hr className="docs-hr" {...props} />;
  },
};

export default DocsComponents;

// Export custom components for direct use
export { Callout, Steps, Tabs, Card };
