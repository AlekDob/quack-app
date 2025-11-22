import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WebAnalysisCard from './WebAnalysisCard';
import type { WebAnalysisOutput } from '../../types/structuredOutputs';

describe('WebAnalysisCard', () => {
  const mockData: WebAnalysisOutput = {
    title: 'React 19 Features Guide',
    summary: 'Comprehensive guide to React 19 features including Server Components, Actions, and improved hooks.',
    key_points: [
      'Server Components reduce bundle size by 40%',
      'New use() hook for async data fetching',
      'Form Actions simplify state management',
      'Automatic batching improvements',
    ],
    links: [
      {
        url: 'https://react.dev/blog/2024/react-19',
        description: 'React 19 Release Notes - Official announcement',
      },
      {
        url: 'https://github.com/facebook/react/releases',
        description: 'GitHub Releases - Technical changelog',
      },
    ],
    confidence_score: 0.92,
    metadata: {
      word_count: 2500,
      reading_time_minutes: 10,
      last_updated: '2024-03-15T10:00:00Z',
    },
  };

  it('renders web analysis card with correct data', () => {
    render(<WebAnalysisCard data={mockData} />);

    expect(screen.getByText('React 19 Features Guide')).toBeInTheDocument();
    expect(screen.getByText(mockData.summary)).toBeInTheDocument();
  });

  it('displays confidence score correctly', () => {
    render(<WebAnalysisCard data={mockData} />);

    const confidenceScore = screen.getByText('92%');
    expect(confidenceScore).toBeInTheDocument();
  });

  it('renders all key points', () => {
    render(<WebAnalysisCard data={mockData} />);

    mockData.key_points.forEach((point) => {
      expect(screen.getByText(point)).toBeInTheDocument();
    });
  });

  it('calls onLinkClick when link is clicked', () => {
    const onLinkClick = vi.fn();
    render(<WebAnalysisCard data={mockData} onLinkClick={onLinkClick} />);

    const linkItem = screen.getByText('React 19 Release Notes - Official announcement').closest('.link-item');
    if (linkItem) {
      fireEvent.click(linkItem);
    }

    expect(onLinkClick).toHaveBeenCalledWith('https://react.dev/blog/2024/react-19');
  });

  it('displays links with descriptions', () => {
    render(<WebAnalysisCard data={mockData} />);

    mockData.links.forEach((link) => {
      expect(screen.getByText(link.description)).toBeInTheDocument();
    });
  });

  it('handles missing optional fields gracefully', () => {
    const minimalData: WebAnalysisOutput = {
      title: 'Simple Analysis',
      summary: 'Simple analysis result',
      key_points: ['Point 1'],
      links: [],
    };

    render(<WebAnalysisCard data={minimalData} />);

    expect(screen.getByText('Simple Analysis')).toBeInTheDocument();
    expect(screen.getByText('Simple analysis result')).toBeInTheDocument();
  });

  it('displays metadata when present', () => {
    render(<WebAnalysisCard data={mockData} />);

    expect(screen.getByText('2,500 words')).toBeInTheDocument();
    expect(screen.getByText('10 min read')).toBeInTheDocument();
  });

  it('formats confidence score as percentage', () => {
    const dataWithLowConfidence: WebAnalysisOutput = {
      title: 'Test',
      summary: 'Test analysis',
      key_points: ['Point'],
      links: [],
      confidence_score: 0.45,
    };

    render(<WebAnalysisCard data={dataWithLowConfidence} />);

    expect(screen.getByText('45%')).toBeInTheDocument();
  });

  it('renders empty links array', () => {
    const dataWithoutLinks: WebAnalysisOutput = {
      title: 'Analysis',
      summary: 'Analysis without links',
      key_points: ['Point 1'],
      links: [],
    };

    render(<WebAnalysisCard data={dataWithoutLinks} />);

    expect(screen.getByText('Analysis without links')).toBeInTheDocument();
    // Should not show related links section
    expect(screen.queryByText('Related Links')).not.toBeInTheDocument();
  });

  it('applies correct CSS classes', () => {
    const { container } = render(<WebAnalysisCard data={mockData} />);

    expect(container.querySelector('.web-analysis-card')).toBeInTheDocument();
    expect(container.querySelector('.web-analysis-header')).toBeInTheDocument();
    expect(container.querySelector('.confidence-badge')).toBeInTheDocument();
  });

  it('handles many key points with show more button', () => {
    const manyPoints = Array.from({ length: 10 }, (_, i) => `Key point ${i + 1}`);
    const dataWithManyPoints: WebAnalysisOutput = {
      title: 'Analysis',
      summary: 'Analysis with many points',
      key_points: manyPoints,
      links: [],
      confidence_score: 0.88,
    };

    render(<WebAnalysisCard data={dataWithManyPoints} />);

    // Should initially show only first 5 points
    expect(screen.getByText('Key point 1')).toBeInTheDocument();
    expect(screen.getByText('Key point 5')).toBeInTheDocument();

    // Should have a show more button
    const showMoreButton = screen.getByText(/Show 5 More/);
    expect(showMoreButton).toBeInTheDocument();

    // Click to expand
    fireEvent.click(showMoreButton);

    // Now all points should be visible
    expect(screen.getByText('Key point 10')).toBeInTheDocument();
  });

  it('handles many links with show more button', () => {
    const manyLinks = Array.from({ length: 5 }, (_, i) => ({
      url: `https://example.com/link-${i + 1}`,
      description: `Link description ${i + 1}`,
    }));

    const dataWithManyLinks: WebAnalysisOutput = {
      title: 'Analysis',
      summary: 'Analysis with many links',
      key_points: ['Point'],
      links: manyLinks,
    };

    render(<WebAnalysisCard data={dataWithManyLinks} />);

    // Should initially show only first 3 links
    expect(screen.getByText('Link description 1')).toBeInTheDocument();
    expect(screen.getByText('Link description 3')).toBeInTheDocument();

    // Should have a show more button
    const showMoreButton = screen.getByText(/Show 2 More/);
    expect(showMoreButton).toBeInTheDocument();

    // Click to expand
    fireEvent.click(showMoreButton);

    // Now all links should be visible
    expect(screen.getByText('Link description 5')).toBeInTheDocument();
  });
});
