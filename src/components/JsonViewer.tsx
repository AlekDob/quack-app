import React from 'react';
import './JsonViewer.css';

interface JsonViewerProps {
  data: string; // JSON string
  maxHeight?: string;
}

/**
 * JsonViewer - Component for rendering JSON with syntax highlighting
 * Parses JSON string and applies color-coded formatting
 */
export const JsonViewer: React.FC<JsonViewerProps> = ({ data, maxHeight = '400px' }) => {
  const renderJson = (jsonString: string): React.ReactElement => {
    try {
      // Try to parse as JSON
      const parsed = JSON.parse(jsonString);
      const formatted = JSON.stringify(parsed, null, 2);

      // Apply syntax highlighting
      const highlighted = formatted.replace(
        /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
        (match) => {
          let cls = 'json-number';
          if (/^"/.test(match)) {
            if (/:$/.test(match)) {
              cls = 'json-key';
            } else {
              cls = 'json-string';
            }
          } else if (/true|false/.test(match)) {
            cls = 'json-boolean';
          } else if (/null/.test(match)) {
            cls = 'json-null';
          }
          return `<span class="${cls}">${match}</span>`;
        }
      );

      return (
        <pre
          className="json-viewer"
          style={{ maxHeight }}
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      );
    } catch (e) {
      // If not valid JSON, render as plain text
      return (
        <pre className="json-viewer json-plain" style={{ maxHeight }}>
          {jsonString}
        </pre>
      );
    }
  };

  return renderJson(data);
};
