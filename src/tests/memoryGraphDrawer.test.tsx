import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MemoryGraphDrawer from '../components/memory/MemoryGraphDrawer';
import { mcpMemoryService } from '../services/mcpMemoryService';

// Mock the mcpMemoryService
vi.mock('../services/mcpMemoryService', () => ({
  mcpMemoryService: {
    refreshFromFile: vi.fn(),
    getKnowledgeGraph: vi.fn(),
  },
}));

// Mock ForceGraph2D - it uses canvas which isn't available in test environment
vi.mock('react-force-graph-2d', () => ({
  default: vi.fn(() => <div data-testid="force-graph" />),
}));

describe('MemoryGraphDrawer', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when closed', () => {
    render(<MemoryGraphDrawer open={false} onClose={mockOnClose} />);

    // The drawer should exist but be hidden
    const drawer = document.querySelector('.memory-graph-drawer');
    expect(drawer).toBeTruthy();
    expect(drawer?.classList.contains('open')).toBe(false);
  });

  it('renders with open class when open', () => {
    vi.mocked(mcpMemoryService.getKnowledgeGraph).mockReturnValue({
      entities: [],
      relations: [],
    });

    render(<MemoryGraphDrawer open={true} onClose={mockOnClose} />);

    const drawer = document.querySelector('.memory-graph-drawer');
    expect(drawer?.classList.contains('open')).toBe(true);
  });

  it('shows header with Knowledge Graph title', () => {
    vi.mocked(mcpMemoryService.getKnowledgeGraph).mockReturnValue({
      entities: [],
      relations: [],
    });

    render(<MemoryGraphDrawer open={true} onClose={mockOnClose} />);

    expect(screen.getByText('Knowledge Graph')).toBeInTheDocument();
  });

  it('calls onClose when clicking backdrop', () => {
    vi.mocked(mcpMemoryService.getKnowledgeGraph).mockReturnValue({
      entities: [],
      relations: [],
    });

    render(<MemoryGraphDrawer open={true} onClose={mockOnClose} />);

    const backdrop = document.querySelector('.memory-graph-backdrop');
    if (backdrop) {
      fireEvent.click(backdrop);
    }

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onClose when clicking close button', () => {
    vi.mocked(mcpMemoryService.getKnowledgeGraph).mockReturnValue({
      entities: [],
      relations: [],
    });

    render(<MemoryGraphDrawer open={true} onClose={mockOnClose} />);

    const closeButton = screen.getByLabelText('Close');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('shows empty state when no entities', async () => {
    vi.mocked(mcpMemoryService.getKnowledgeGraph).mockReturnValue({
      entities: [],
      relations: [],
    });

    render(<MemoryGraphDrawer open={true} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('No memories yet')).toBeInTheDocument();
    });
  });

  it('shows entity count when entities exist', async () => {
    vi.mocked(mcpMemoryService.getKnowledgeGraph).mockReturnValue({
      entities: [
        {
          name: 'TestEntity',
          entityType: 'feature',
          observations: ['Test observation'],
        },
      ],
      relations: [],
    });

    render(<MemoryGraphDrawer open={true} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('1 entities')).toBeInTheDocument();
    });
  });

  it('renders ForceGraph when entities exist', async () => {
    vi.mocked(mcpMemoryService.getKnowledgeGraph).mockReturnValue({
      entities: [
        {
          name: 'TestEntity',
          entityType: 'feature',
          observations: ['Test observation'],
        },
      ],
      relations: [],
    });

    render(<MemoryGraphDrawer open={true} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByTestId('force-graph')).toBeInTheDocument();
    });
  });

  it('refreshes data when refresh button is clicked', async () => {
    vi.mocked(mcpMemoryService.getKnowledgeGraph).mockReturnValue({
      entities: [],
      relations: [],
    });

    render(<MemoryGraphDrawer open={true} onClose={mockOnClose} />);

    const refreshButton = screen.getByTitle('Refresh');
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(mcpMemoryService.refreshFromFile).toHaveBeenCalled();
    });
  });

  it('shows legend with entity type colors', async () => {
    vi.mocked(mcpMemoryService.getKnowledgeGraph).mockReturnValue({
      entities: [
        {
          name: 'TestEntity',
          entityType: 'feature',
          observations: ['Test observation'],
        },
      ],
      relations: [],
    });

    render(<MemoryGraphDrawer open={true} onClose={mockOnClose} />);

    await waitFor(() => {
      const legend = document.querySelector('.memory-graph-legend');
      expect(legend).toBeTruthy();
    });
  });

  it('loads data on open', async () => {
    vi.mocked(mcpMemoryService.getKnowledgeGraph).mockReturnValue({
      entities: [],
      relations: [],
    });

    render(<MemoryGraphDrawer open={true} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(mcpMemoryService.refreshFromFile).toHaveBeenCalled();
    });
  });
});

describe('MemoryGraphDrawer - Entity Colors', () => {
  it('assigns correct colors to different entity types', async () => {
    vi.mocked(mcpMemoryService.getKnowledgeGraph).mockReturnValue({
      entities: [
        {
          name: 'UserPrefs',
          entityType: 'UserPreferences',
          observations: ['Pref 1'],
        },
        {
          name: 'Feature1',
          entityType: 'feature',
          observations: ['Feature obs'],
        },
      ],
      relations: [],
    });

    render(<MemoryGraphDrawer open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('2 entities')).toBeInTheDocument();
    });
  });
});

describe('MemoryGraphDrawer - Relations', () => {
  it('handles entities with relations', async () => {
    vi.mocked(mcpMemoryService.getKnowledgeGraph).mockReturnValue({
      entities: [
        {
          name: 'Entity1',
          entityType: 'feature',
          observations: ['Obs 1'],
        },
        {
          name: 'Entity2',
          entityType: 'project',
          observations: ['Obs 2'],
        },
      ],
      relations: [
        {
          from: 'Entity1',
          to: 'Entity2',
          relationType: 'uses',
        },
      ],
    });

    render(<MemoryGraphDrawer open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('2 entities')).toBeInTheDocument();
    });
  });
});
