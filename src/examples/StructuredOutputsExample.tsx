/**
 * Structured Outputs Example
 *
 * This file demonstrates how to use structured outputs with Claude Agent SDK.
 * It shows mock data examples for all available widgets.
 */

import { useState } from 'react';
import { BugReportWidget, WebAnalysisCard } from '../components/structured-outputs';
import type { BugReportOutput, WebAnalysisOutput } from '../types/structuredOutputs';

// Mock data for BugReport
const mockBugReport: BugReportOutput = {
  bugs_found: [
    {
      severity: 'critical',
      file: 'src/components/FileExplorer.tsx',
      line: 156,
      description: 'Potential XSS vulnerability in file name rendering',
      suggested_fix: 'Use DOMPurify.sanitize() or React\'s built-in escaping',
      category: 'Security',
      impact: 'Attackers could inject malicious scripts via crafted filenames'
    },
    {
      severity: 'high',
      file: 'src/utils/terminalUtils.ts',
      line: 42,
      description: 'Unchecked array access could cause index out of bounds',
      suggested_fix: 'Add bounds check: if (index >= 0 && index < array.length)',
      category: 'Runtime Error',
      impact: 'Application crash when processing malformed terminal output'
    },
    {
      severity: 'medium',
      file: 'src/hooks/useClaudeChat.ts',
      line: 89,
      description: 'Memory leak: event listeners not cleaned up on unmount',
      suggested_fix: 'Return cleanup function from useEffect',
      category: 'Memory Management',
      impact: 'Gradual memory consumption over time'
    },
    {
      severity: 'low',
      file: 'src/components/ChatInput.tsx',
      line: 234,
      description: 'Console.log statement left in production code',
      suggested_fix: 'Remove or replace with proper logging',
      category: 'Code Quality'
    }
  ],
  total_issues: 4,
  summary: 'Found 4 issues: 1 critical, 1 high, 1 medium, 1 low. Primary concern is XSS vulnerability.',
  risk_score: 7.8
};

// Mock data for WebAnalysis
const mockWebAnalysis: WebAnalysisOutput = {
  title: 'Claude Agent SDK - Structured Outputs Guide',
  summary: 'Complete documentation on using structured outputs with the Claude Agent SDK. Covers JSON schema definition, TypeScript integration, validation, and best practices for building reliable AI workflows with predictable output formats.',
  key_points: [
    'Structured outputs ensure validated JSON responses from agent workflows',
    'Support for TypeScript types, Zod schemas, and raw JSON Schema',
    'Automatic validation with clear error messages for invalid outputs',
    'Integrates seamlessly with existing agent tools and workflows',
    'Best practices include defining strict schemas and handling edge cases',
    'Use structured outputs for data extraction, form filling, and API responses'
  ],
  links: [
    {
      url: 'https://platform.claude.com/docs/en/agent-sdk/structured-outputs',
      description: 'Official Structured Outputs Documentation'
    },
    {
      url: 'https://json-schema.org/',
      description: 'JSON Schema Specification'
    },
    {
      url: 'https://github.com/anthropics/anthropic-sdk-typescript',
      description: 'Claude TypeScript SDK on GitHub'
    }
  ],
  confidence_score: 0.92,
  metadata: {
    word_count: 3450,
    reading_time_minutes: 14,
    last_updated: '2025-01-22T10:30:00Z'
  }
};

export default function StructuredOutputsExample() {
  const [selectedTab, setSelectedTab] = useState<'bug-report' | 'web-analysis'>('bug-report');

  const handleFileClick = (filePath: string, line?: number) => {
    console.log(`Open file: ${filePath}${line ? `:${line}` : ''}`);
    alert(`Would open: ${filePath}${line ? ` at line ${line}` : ''}`);
  };

  const handleLinkClick = (url: string) => {
    console.log(`Open link: ${url}`);
    window.open(url, '_blank');
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--color-text)' }}>
          Structured Outputs Examples
        </h1>
        <p style={{ fontSize: '1rem', color: 'var(--color-text-secondary)' }}>
          Interactive examples of structured output widgets for Claude Agent SDK
        </p>
      </header>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '1.5rem',
        borderBottom: '2px solid rgba(255, 255, 255, 0.1)',
        paddingBottom: '1rem'
      }}>
        <button
          onClick={() => setSelectedTab('bug-report')}
          style={{
            padding: '0.75rem 1.5rem',
            background: selectedTab === 'bug-report' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
            border: selectedTab === 'bug-report' ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            color: selectedTab === 'bug-report' ? '#EF4444' : 'var(--color-text-secondary)',
            fontSize: '0.9375rem',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          🐛 Bug Report
        </button>
        <button
          onClick={() => setSelectedTab('web-analysis')}
          style={{
            padding: '0.75rem 1.5rem',
            background: selectedTab === 'web-analysis' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
            border: selectedTab === 'web-analysis' ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            color: selectedTab === 'web-analysis' ? '#60A5FA' : 'var(--color-text-secondary)',
            fontSize: '0.9375rem',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          🌐 Web Analysis
        </button>
      </div>

      {/* Content */}
      {selectedTab === 'bug-report' && (
        <div>
          <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '8px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--color-text)' }}>
              Bug Report Widget
            </h2>
            <p style={{ fontSize: '0.9375rem', color: 'var(--color-text-secondary)', marginBottom: '0.75rem' }}>
              Displays code analysis results with severity levels, file locations, and suggested fixes.
            </p>
            <code style={{
              display: 'block',
              padding: '0.75rem',
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '6px',
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              color: '#93C5FD'
            }}>
              {`<BugReportWidget data={bugReport} onFileClick={openFile} />`}
            </code>
          </div>
          <BugReportWidget data={mockBugReport} onFileClick={handleFileClick} />
        </div>
      )}

      {selectedTab === 'web-analysis' && (
        <div>
          <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '8px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--color-text)' }}>
              Web Analysis Card
            </h2>
            <p style={{ fontSize: '0.9375rem', color: 'var(--color-text-secondary)', marginBottom: '0.75rem' }}>
              Shows web content summaries with key points, related links, and confidence scores.
            </p>
            <code style={{
              display: 'block',
              padding: '0.75rem',
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '6px',
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              color: '#93C5FD'
            }}>
              {`<WebAnalysisCard data={webAnalysis} onLinkClick={openLink} />`}
            </code>
          </div>
          <WebAnalysisCard data={mockWebAnalysis} onLinkClick={handleLinkClick} />
        </div>
      )}

      {/* Usage Info */}
      <div style={{
        marginTop: '3rem',
        padding: '1.5rem',
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(6, 182, 212, 0.05) 100%)',
        border: '1px solid rgba(16, 185, 129, 0.2)',
        borderRadius: '12px'
      }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--color-text)' }}>
          💡 How to Use Structured Outputs
        </h3>
        <ol style={{ paddingLeft: '1.5rem', lineHeight: 1.8, color: 'var(--color-text-secondary)' }}>
          <li>Define a JSON schema for your desired output structure</li>
          <li>Pass the schema to Claude Agent SDK with <code>outputFormat</code></li>
          <li>Receive validated, typed JSON responses</li>
          <li>Use the appropriate widget component to display the data</li>
        </ol>
        <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '8px' }}>
          <code style={{ fontFamily: 'monospace', fontSize: '0.875rem', color: '#A7F3D0' }}>
            {`import { bugReportSchema } from './types/structuredOutputs';

// Coming soon: Backend support for structured outputs
const result = await agent.run({
  prompt: "Analyze this code for bugs",
  outputFormat: {
    type: "json_schema",
    json_schema: bugReportSchema
  }
});`}
          </code>
        </div>
      </div>
    </div>
  );
}
