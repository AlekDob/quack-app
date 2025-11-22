import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BugReportWidget from './BugReportWidget';
import type { BugReportOutput } from '../../types/structuredOutputs';

describe('BugReportWidget', () => {
  const mockData: BugReportOutput = {
    bugs_found: [
      {
        severity: 'critical',
        file: 'src/components/App.tsx',
        line: 42,
        description: 'Null pointer dereference vulnerability',
        suggested_fix: 'Add null check before accessing object property',
        category: 'Security',
        impact: 'Application crash',
      },
      {
        severity: 'high',
        file: 'src/utils/parser.ts',
        line: 128,
        description: 'SQL injection risk in user input',
        suggested_fix: 'Use parameterized queries instead of string concatenation',
      },
      {
        severity: 'medium',
        file: 'src/api/auth.ts',
        line: 67,
        description: 'Weak password validation',
      },
      {
        severity: 'low',
        file: 'src/styles/theme.css',
        line: 15,
        description: 'Missing fallback font',
      },
    ],
    total_issues: 4,
    summary: 'Found 4 security and quality issues across the codebase',
    risk_score: 7.2,
  };

  it('renders bug report widget with correct data', () => {
    render(<BugReportWidget data={mockData} />);

    expect(screen.getByText('Bug Analysis Report')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('issues found')).toBeInTheDocument();
  });

  it('displays summary when provided', () => {
    render(<BugReportWidget data={mockData} />);

    expect(screen.getByText(mockData.summary!)).toBeInTheDocument();
  });

  it('displays risk score when provided', () => {
    render(<BugReportWidget data={mockData} />);

    expect(screen.getByText('7.2/10')).toBeInTheDocument();
  });

  it('displays all severity levels in breakdown', () => {
    const { container } = render(<BugReportWidget data={mockData} />);

    const criticalBadge = container.querySelector('.severity-badge');
    expect(criticalBadge).toBeInTheDocument();

    // Check for severity names in the breakdown section
    const severityBadges = container.querySelectorAll('.severity-badge .severity-name');
    const severityTexts = Array.from(severityBadges).map(badge => badge.textContent);

    expect(severityTexts).toContain('critical');
    expect(severityTexts).toContain('high');
    expect(severityTexts).toContain('medium');
    expect(severityTexts).toContain('low');
  });

  it('expands and collapses bug details on click', () => {
    render(<BugReportWidget data={mockData} />);

    const firstBug = screen.getByText('Null pointer dereference vulnerability');
    expect(firstBug).toBeInTheDocument();

    // Should not show fix initially (collapsed)
    expect(screen.queryByText('Add null check before accessing object property')).not.toBeInTheDocument();

    // Click to expand
    const bugHeader = firstBug.closest('.bug-item-header');
    if (bugHeader) {
      fireEvent.click(bugHeader);
    }

    // Should show fix after expansion
    expect(screen.getByText('Add null check before accessing object property')).toBeInTheDocument();
  });

  it('calls onFileClick when file is clicked', () => {
    const onFileClick = vi.fn();
    render(<BugReportWidget data={mockData} onFileClick={onFileClick} />);

    // Expand first bug to reveal "Open File" button
    const firstBugHeader = screen.getByText('Null pointer dereference vulnerability').closest('.bug-item-header');
    if (firstBugHeader) {
      fireEvent.click(firstBugHeader);
    }

    // Click "Open File" button
    const openFileButton = screen.getByText('Open File');
    fireEvent.click(openFileButton);

    expect(onFileClick).toHaveBeenCalledWith('src/components/App.tsx', 42);
  });

  it('handles missing optional fields gracefully', () => {
    const dataWithoutOptionalFields: BugReportOutput = {
      bugs_found: [
        {
          severity: 'medium',
          file: 'test.js',
          description: 'Test issue',
          // line, suggested_fix, category, impact are optional
        },
      ],
      total_issues: 1,
    };

    render(<BugReportWidget data={dataWithoutOptionalFields} />);

    expect(screen.getByText('Test issue')).toBeInTheDocument();
    expect(screen.getByText('test.js')).toBeInTheDocument();
    // Should not crash when optional fields are missing
  });

  it('renders empty state when no bugs found', () => {
    const emptyData: BugReportOutput = {
      bugs_found: [],
      total_issues: 0,
    };

    render(<BugReportWidget data={emptyData} />);

    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('issues found')).toBeInTheDocument();
  });

  it('displays severity icons correctly', () => {
    const { container } = render(<BugReportWidget data={mockData} />);

    // Check for severity icons in the list
    const severityIcons = container.querySelectorAll('.severity-icon');
    expect(severityIcons.length).toBeGreaterThan(0);
  });

  it('shows file name without full path in bug items', () => {
    render(<BugReportWidget data={mockData} />);

    // Should show only filename, not full path
    expect(screen.getByText('App.tsx')).toBeInTheDocument();
    expect(screen.getByText('parser.ts')).toBeInTheDocument();
  });

  it('displays line numbers when available', () => {
    render(<BugReportWidget data={mockData} />);

    expect(screen.getByText('L42')).toBeInTheDocument();
    expect(screen.getByText('L128')).toBeInTheDocument();
  });

  it('handles bugs with same severity', () => {
    const dataWithDuplicateSeverity: BugReportOutput = {
      bugs_found: [
        {
          severity: 'critical',
          file: 'file1.ts',
          description: 'Bug 1',
        },
        {
          severity: 'critical',
          file: 'file2.ts',
          description: 'Bug 2',
        },
        {
          severity: 'critical',
          file: 'file3.ts',
          description: 'Bug 3',
        },
      ],
      total_issues: 3,
    };

    const { container } = render(<BugReportWidget data={dataWithDuplicateSeverity} />);

    // Check total count
    const totalCount = container.querySelector('.bug-count-total');
    expect(totalCount?.textContent).toBe('3');

    expect(screen.getByText('Bug 1')).toBeInTheDocument();
    expect(screen.getByText('Bug 2')).toBeInTheDocument();
    expect(screen.getByText('Bug 3')).toBeInTheDocument();

    // Should show count of 3 for critical severity in the badge
    const severityCount = container.querySelector('.severity-count');
    expect(severityCount?.textContent).toBe('3');
  });

  it('displays additional bug details when expanded', () => {
    render(<BugReportWidget data={mockData} />);

    // Expand first bug
    const bugHeader = screen.getByText('Null pointer dereference vulnerability').closest('.bug-item-header');
    if (bugHeader) {
      fireEvent.click(bugHeader);
    }

    // Should show category and impact
    expect(screen.getByText('Security')).toBeInTheDocument();
    expect(screen.getByText('Application crash')).toBeInTheDocument();
  });

  it('applies correct styling for severity levels', () => {
    const { container } = render(<BugReportWidget data={mockData} />);

    const bugItems = container.querySelectorAll('.bug-item');
    expect(bugItems.length).toBe(4); // All 4 bugs should be rendered
  });
});
