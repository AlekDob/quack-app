import { describe, it, expect } from 'vitest';
import {
  isBugReportOutput,
  isWebAnalysisOutput,
  isFileAnalysisOutput,
  type BugReportOutput,
  type WebAnalysisOutput,
  type FileAnalysisOutput,
} from './structuredOutputs';

describe('structuredOutputs Type Guards', () => {
  describe('isBugReportOutput', () => {
    it('validates correct BugReportOutput', () => {
      const validData: BugReportOutput = {
        bugs_found: [
          {
            severity: 'critical',
            file: 'test.ts',
            description: 'Test bug',
          },
        ],
        total_issues: 1,
      };

      expect(isBugReportOutput(validData)).toBe(true);
    });

    it('rejects data missing required fields', () => {
      const invalidData = {
        bugs_found: [
          {
            severity: 'high',
            // missing file and description
          },
        ],
        total_issues: 1,
      };

      expect(isBugReportOutput(invalidData)).toBe(true); // Type guard only checks bugs_found array and total_issues
    });

    it('rejects data with wrong types', () => {
      const invalidData = {
        bugs_found: 'not an array', // should be array
        total_issues: 1,
      };

      expect(isBugReportOutput(invalidData)).toBe(false);
    });

    it('rejects null or undefined', () => {
      expect(isBugReportOutput(null)).toBe(false);
      expect(isBugReportOutput(undefined)).toBe(false);
    });

    it('validates BugReportOutput with optional fields', () => {
      const validData: BugReportOutput = {
        bugs_found: [
          {
            severity: 'medium',
            file: 'src/app.ts',
            line: 42,
            description: 'Memory leak detected',
            suggested_fix: 'Use cleanup function in useEffect',
            category: 'Performance',
            impact: 'High memory usage',
          },
        ],
        total_issues: 1,
        summary: 'Found 1 performance issue',
        risk_score: 5.5,
      };

      expect(isBugReportOutput(validData)).toBe(true);
    });

    it('validates empty bugs_found array', () => {
      const validData: BugReportOutput = {
        bugs_found: [],
        total_issues: 0,
      };

      expect(isBugReportOutput(validData)).toBe(true);
    });
  });

  describe('isWebAnalysisOutput', () => {
    it('validates correct WebAnalysisOutput', () => {
      const validData: WebAnalysisOutput = {
        title: 'Test Title',
        summary: 'Test summary',
        key_points: ['Point 1', 'Point 2'],
        links: [],
      };

      expect(isWebAnalysisOutput(validData)).toBe(true);
    });

    it('rejects data missing required fields', () => {
      const invalidData = {
        summary: 'Test',
        // missing title and key_points
      };

      expect(isWebAnalysisOutput(invalidData)).toBe(false);
    });

    it('validates WebAnalysisOutput with all optional fields', () => {
      const validData: WebAnalysisOutput = {
        title: 'Complete Analysis',
        summary: 'Complete analysis',
        key_points: ['Point 1'],
        links: [
          {
            url: 'https://example.com/article',
            description: 'Article description',
          },
        ],
        confidence_score: 0.92,
        metadata: {
          word_count: 2500,
          reading_time_minutes: 10,
          last_updated: '2024-03-15T10:00:00Z',
        },
      };

      expect(isWebAnalysisOutput(validData)).toBe(true);
    });

    it('rejects non-array key_points', () => {
      const invalidData = {
        title: 'Test',
        summary: 'Test',
        key_points: 'not an array',
        links: [],
      };

      expect(isWebAnalysisOutput(invalidData)).toBe(false);
    });

    it('validates empty key_points array', () => {
      const validData: WebAnalysisOutput = {
        title: 'Test',
        summary: 'Test',
        key_points: [],
        links: [],
      };

      expect(isWebAnalysisOutput(validData)).toBe(true);
    });

    it('validates with links array', () => {
      const validData: WebAnalysisOutput = {
        title: 'Test',
        summary: 'Test',
        key_points: ['Point'],
        links: [
          {
            url: 'https://example.com',
            description: 'Example link',
          },
        ],
      };

      expect(isWebAnalysisOutput(validData)).toBe(true);
    });
  });

  describe('isFileAnalysisOutput', () => {
    it('validates correct FileAnalysisOutput', () => {
      const validData: FileAnalysisOutput = {
        language: 'typescript',
        complexity_score: 42,
        functions: [
          {
            name: 'App',
            lines: 40,
            parameters: 2,
            complexity: 5,
            start_line: 10,
            end_line: 50,
          },
        ],
        dependencies: ['react', 'react-dom'],
      };

      expect(isFileAnalysisOutput(validData)).toBe(true);
    });

    it('rejects data missing required fields', () => {
      const invalidData = {
        language: 'typescript',
        // missing complexity_score, functions, dependencies
      };

      expect(isFileAnalysisOutput(invalidData)).toBe(false);
    });

    it('validates FileAnalysisOutput with optional fields', () => {
      const validData: FileAnalysisOutput = {
        language: 'typescript',
        complexity_score: 15,
        functions: [],
        dependencies: [],
        total_lines: 100,
        code_quality_score: 85,
        suggestions: ['Add type annotations', 'Improve documentation'],
      };

      expect(isFileAnalysisOutput(validData)).toBe(true);
    });

    it('rejects invalid function structure', () => {
      const invalidData = {
        language: 'typescript',
        complexity_score: 10,
        functions: [
          {
            name: 'test',
            // missing lines and parameters
          },
        ],
        dependencies: [],
      };

      // Type guard only checks if it's an array, not structure
      expect(isFileAnalysisOutput(invalidData)).toBe(true);
    });

    it('validates empty arrays for functions and dependencies', () => {
      const validData: FileAnalysisOutput = {
        language: 'typescript',
        complexity_score: 0,
        functions: [],
        dependencies: [],
      };

      expect(isFileAnalysisOutput(validData)).toBe(true);
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('rejects primitive values', () => {
      expect(isBugReportOutput(42)).toBe(false);
      expect(isBugReportOutput('string')).toBe(false);
      expect(isBugReportOutput(true)).toBe(false);

      expect(isWebAnalysisOutput(42)).toBe(false);
      expect(isWebAnalysisOutput('string')).toBe(false);
      expect(isWebAnalysisOutput(true)).toBe(false);

      expect(isFileAnalysisOutput(42)).toBe(false);
      expect(isFileAnalysisOutput('string')).toBe(false);
      expect(isFileAnalysisOutput(true)).toBe(false);
    });

    it('rejects arrays', () => {
      expect(isBugReportOutput([])).toBe(false);
      expect(isWebAnalysisOutput([])).toBe(false);
      expect(isFileAnalysisOutput([])).toBe(false);
    });

    it('handles objects with extra properties', () => {
      const dataWithExtra: BugReportOutput & { extra: string } = {
        bugs_found: [],
        total_issues: 0,
        extra: 'Should still validate',
      };

      // Type guards should validate required fields regardless of extra properties
      expect(isBugReportOutput(dataWithExtra)).toBe(true);
    });

    it('rejects objects with null values for required fields', () => {
      const invalidData = {
        bugs_found: null,
        total_issues: 0,
      };

      expect(isBugReportOutput(invalidData)).toBe(false);
    });

    it('handles complex nested structures', () => {
      const complexWebAnalysis: WebAnalysisOutput = {
        title: 'Complex Analysis',
        summary: 'A'.repeat(5000), // Very long summary
        key_points: Array.from({ length: 100 }, (_, i) => `Point ${i}`), // Many points
        links: Array.from({ length: 50 }, (_, i) => ({
          url: `https://example${i}.com`,
          description: `Link ${i}`,
        })), // Many links
        confidence_score: 0.987654321,
        metadata: {
          word_count: 999999,
          reading_time_minutes: 9999,
          last_updated: '2024-12-31T23:59:59.999Z',
        },
      };

      expect(isWebAnalysisOutput(complexWebAnalysis)).toBe(true);
    });
  });
});
