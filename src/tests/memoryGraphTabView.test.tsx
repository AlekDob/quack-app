import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MemoryGraphTabView from '../views/MemoryGraphTabView';
import { useUnifiedMemory } from '../hooks/useUnifiedMemory';
import type { UnifiedMemoryItem } from '../services/mcpMemoryService';
import type { Tab } from '../components/TabBar';

// Mock the useUnifiedMemory hook
vi.mock('../hooks/useUnifiedMemory', () => ({
  useUnifiedMemory: vi.fn(),
}));

// Mock ForceGraph2D - it uses canvas which isn't available in test environment
vi.mock('react-force-graph-2d', () => ({
  default: vi.fn(() => <div data-testid="force-graph" />),
}));

// Mock toast from sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockTab: Tab = {
  id: 'memory-graph-123',
  label: 'Knowledge Graph',
  type: 'memory-graph',
  closable: true,
};

const mockMcpItem: UnifiedMemoryItem = {
  id: 'mcp-TestEntity',
  source: 'mcp',
  content: 'Test MCP observation',
  category: 'feature',
  timestamp: new Date('2025-01-01'),
  entityName: 'TestEntity',
  entityType: 'feature',
  relations: [],
};

const mockQuackItem: UnifiedMemoryItem = {
  id: 'quack-123',
  source: 'quack',
  content: 'User prefers dark mode for coding',
  category: 'preference',
  timestamp: new Date('2025-01-02'),
};

describe('MemoryGraphTabView', () => {
  const mockRefresh = vi.fn();
  const mockCreateQuackMemory = vi.fn();
  const mockDeleteMemory = vi.fn();

  const defaultMockReturn = {
    unifiedItems: [] as UnifiedMemoryItem[],
    isLoading: false,
    stats: { mcp: 0, quack: 0, total: 0 },
    refresh: mockRefresh,
    createQuackMemory: mockCreateQuackMemory,
    deleteMemory: mockDeleteMemory,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUnifiedMemory).mockReturnValue(defaultMockReturn);
  });

  it('renders nothing when not active', () => {
    render(<MemoryGraphTabView tab={mockTab} isActive={false} />);

    expect(screen.queryByText('Knowledge Graph')).not.toBeInTheDocument();
  });

  it('renders nothing when tab type is not memory-graph', () => {
    const wrongTab: Tab = { ...mockTab, type: 'chat' };
    render(<MemoryGraphTabView tab={wrongTab} isActive={true} />);

    expect(screen.queryByText('Knowledge Graph')).not.toBeInTheDocument();
  });

  it('renders toolbar with title when active', () => {
    render(<MemoryGraphTabView tab={mockTab} isActive={true} />);

    expect(screen.getByText('Knowledge Graph')).toBeInTheDocument();
  });

  it('shows empty state when no memories', async () => {
    render(<MemoryGraphTabView tab={mockTab} isActive={true} />);

    await waitFor(() => {
      expect(screen.getByText('No memories yet')).toBeInTheDocument();
    });
  });

  it('shows loading state', () => {
    vi.mocked(useUnifiedMemory).mockReturnValue({
      ...defaultMockReturn,
      isLoading: true,
    });

    render(<MemoryGraphTabView tab={mockTab} isActive={true} />);

    expect(screen.getByText('Loading knowledge graph...')).toBeInTheDocument();
  });

  it('renders ForceGraph when entities exist', async () => {
    vi.mocked(useUnifiedMemory).mockReturnValue({
      ...defaultMockReturn,
      unifiedItems: [mockMcpItem],
      stats: { mcp: 1, quack: 0, total: 1 },
    });

    render(<MemoryGraphTabView tab={mockTab} isActive={true} />);

    await waitFor(() => {
      expect(screen.getByTestId('force-graph')).toBeInTheDocument();
    });
  });

  it('calls refresh on mount when active', () => {
    render(<MemoryGraphTabView tab={mockTab} isActive={true} />);

    expect(mockRefresh).toHaveBeenCalled();
  });
});

describe('MemoryGraphTabView - Stats Display', () => {
  const mockRefresh = vi.fn();
  const mockCreateQuackMemory = vi.fn();
  const mockDeleteMemory = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows correct MCP stats count', () => {
    vi.mocked(useUnifiedMemory).mockReturnValue({
      unifiedItems: [mockMcpItem],
      isLoading: false,
      stats: { mcp: 3, quack: 0, total: 3 },
      refresh: mockRefresh,
      createQuackMemory: mockCreateQuackMemory,
      deleteMemory: mockDeleteMemory,
    });

    render(<MemoryGraphTabView tab={mockTab} isActive={true} />);

    const mcpStat = screen.getByTitle('MCP (AI) memories');
    expect(mcpStat).toHaveTextContent('3');
  });

  it('shows correct Quack stats count', () => {
    vi.mocked(useUnifiedMemory).mockReturnValue({
      unifiedItems: [mockQuackItem],
      isLoading: false,
      stats: { mcp: 0, quack: 5, total: 5 },
      refresh: mockRefresh,
      createQuackMemory: mockCreateQuackMemory,
      deleteMemory: mockDeleteMemory,
    });

    render(<MemoryGraphTabView tab={mockTab} isActive={true} />);

    const quackStat = screen.getByTitle('Quack (Pattern) memories');
    expect(quackStat).toHaveTextContent('5');
  });

  it('shows both MCP and Quack stats', () => {
    vi.mocked(useUnifiedMemory).mockReturnValue({
      unifiedItems: [mockMcpItem, mockQuackItem],
      isLoading: false,
      stats: { mcp: 2, quack: 3, total: 5 },
      refresh: mockRefresh,
      createQuackMemory: mockCreateQuackMemory,
      deleteMemory: mockDeleteMemory,
    });

    render(<MemoryGraphTabView tab={mockTab} isActive={true} />);

    expect(screen.getByTitle('MCP (AI) memories')).toHaveTextContent('2');
    expect(screen.getByTitle('Quack (Pattern) memories')).toHaveTextContent('3');
  });
});

describe('MemoryGraphTabView - Source Filter', () => {
  const mockRefresh = vi.fn();
  const mockCreateQuackMemory = vi.fn();
  const mockDeleteMemory = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUnifiedMemory).mockReturnValue({
      unifiedItems: [mockMcpItem, mockQuackItem],
      isLoading: false,
      stats: { mcp: 1, quack: 1, total: 2 },
      refresh: mockRefresh,
      createQuackMemory: mockCreateQuackMemory,
      deleteMemory: mockDeleteMemory,
    });
  });

  it('shows filter buttons for All, MCP, and Quack', () => {
    render(<MemoryGraphTabView tab={mockTab} isActive={true} />);

    // Use class selectors to distinguish from legend text
    const filterButtons = document.querySelectorAll('.memory-graph-filter-btn');
    expect(filterButtons.length).toBe(3);
    expect(screen.getByText('All')).toBeInTheDocument();

    // Check for MCP and Quack buttons specifically in the filter section
    const mcpFilterBtn = document.querySelector('.memory-graph-filter-btn.mcp');
    const quackFilterBtn = document.querySelector('.memory-graph-filter-btn.quack');
    expect(mcpFilterBtn).toBeTruthy();
    expect(quackFilterBtn).toBeTruthy();
  });

  it('All filter is active by default', () => {
    render(<MemoryGraphTabView tab={mockTab} isActive={true} />);

    const allButton = screen.getByText('All');
    expect(allButton.classList.contains('active')).toBe(true);
  });

  it('clicking MCP filter makes it active', () => {
    render(<MemoryGraphTabView tab={mockTab} isActive={true} />);

    const mcpButton = screen.getByText('MCP');
    fireEvent.click(mcpButton);

    expect(mcpButton.classList.contains('active')).toBe(true);
  });

  it('clicking Quack filter makes it active', () => {
    render(<MemoryGraphTabView tab={mockTab} isActive={true} />);

    // Use class selector to get the filter button specifically (not legend text)
    const quackButton = document.querySelector('.memory-graph-filter-btn.quack') as HTMLElement;
    expect(quackButton).toBeTruthy();
    fireEvent.click(quackButton);

    expect(quackButton.classList.contains('active')).toBe(true);
  });
});

describe('MemoryGraphTabView - Add Memory Form', () => {
  const mockRefresh = vi.fn();
  const mockCreateQuackMemory = vi.fn().mockResolvedValue(undefined);
  const mockDeleteMemory = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUnifiedMemory).mockReturnValue({
      unifiedItems: [],
      isLoading: false,
      stats: { mcp: 0, quack: 0, total: 0 },
      refresh: mockRefresh,
      createQuackMemory: mockCreateQuackMemory,
      deleteMemory: mockDeleteMemory,
    });
  });

  it('add button toggles form visibility', () => {
    render(<MemoryGraphTabView tab={mockTab} isActive={true} />);

    // Form should not be visible initially
    expect(screen.queryByPlaceholderText('Enter a memory to save...')).not.toBeInTheDocument();

    // Click add button
    const addButton = screen.getByTitle('Add Memory');
    fireEvent.click(addButton);

    // Form should be visible
    expect(screen.getByPlaceholderText('Enter a memory to save...')).toBeInTheDocument();
  });

  it('shows category selector when form is open', () => {
    render(<MemoryGraphTabView tab={mockTab} isActive={true} />);

    const addButton = screen.getByTitle('Add Memory');
    fireEvent.click(addButton);

    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    expect(screen.getByText('Fact')).toBeInTheDocument();
  });

  it('calls createQuackMemory when adding memory', async () => {
    render(<MemoryGraphTabView tab={mockTab} isActive={true} />);

    // Open form
    const addButton = screen.getByTitle('Add Memory');
    fireEvent.click(addButton);

    // Enter content
    const input = screen.getByPlaceholderText('Enter a memory to save...');
    fireEvent.change(input, { target: { value: 'Test memory content' } });

    // Submit
    const submitButton = screen.getByText('Add');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockCreateQuackMemory).toHaveBeenCalledWith('Test memory content', 'fact');
    });
  });

  it('closes form after successful add', async () => {
    render(<MemoryGraphTabView tab={mockTab} isActive={true} />);

    // Open form
    fireEvent.click(screen.getByTitle('Add Memory'));

    // Enter content and submit
    const input = screen.getByPlaceholderText('Enter a memory to save...');
    fireEvent.change(input, { target: { value: 'Test memory' } });
    fireEvent.click(screen.getByText('Add'));

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Enter a memory to save...')).not.toBeInTheDocument();
    });
  });

  it('cancel button closes the form', () => {
    render(<MemoryGraphTabView tab={mockTab} isActive={true} />);

    // Open form
    fireEvent.click(screen.getByTitle('Add Memory'));
    expect(screen.getByPlaceholderText('Enter a memory to save...')).toBeInTheDocument();

    // Find and click the cancel button (X icon button within form)
    const cancelButtons = screen.getAllByRole('button');
    const cancelBtn = cancelButtons.find(btn =>
      btn.classList.contains('memory-graph-add-cancel')
    );
    expect(cancelBtn).toBeTruthy();
    if (cancelBtn) {
      fireEvent.click(cancelBtn);
    }

    // Form should be closed
    expect(screen.queryByPlaceholderText('Enter a memory to save...')).not.toBeInTheDocument();
  });
});

describe('MemoryGraphTabView - Toolbar Actions', () => {
  const mockRefresh = vi.fn();
  const mockCreateQuackMemory = vi.fn();
  const mockDeleteMemory = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUnifiedMemory).mockReturnValue({
      unifiedItems: [mockMcpItem],
      isLoading: false,
      stats: { mcp: 1, quack: 0, total: 1 },
      refresh: mockRefresh,
      createQuackMemory: mockCreateQuackMemory,
      deleteMemory: mockDeleteMemory,
    });
  });

  it('refresh button calls refresh', () => {
    render(<MemoryGraphTabView tab={mockTab} isActive={true} />);

    const refreshButton = screen.getByTitle('Refresh');
    fireEvent.click(refreshButton);

    expect(mockRefresh).toHaveBeenCalled();
  });

  it('zoom in button exists', () => {
    render(<MemoryGraphTabView tab={mockTab} isActive={true} />);

    expect(screen.getByTitle('Zoom In')).toBeInTheDocument();
  });

  it('zoom out button exists', () => {
    render(<MemoryGraphTabView tab={mockTab} isActive={true} />);

    expect(screen.getByTitle('Zoom Out')).toBeInTheDocument();
  });

  it('fit view button exists', () => {
    render(<MemoryGraphTabView tab={mockTab} isActive={true} />);

    expect(screen.getByTitle('Fit View')).toBeInTheDocument();
  });

  it('disables refresh button while loading', () => {
    vi.mocked(useUnifiedMemory).mockReturnValue({
      unifiedItems: [],
      isLoading: true,
      stats: { mcp: 0, quack: 0, total: 0 },
      refresh: mockRefresh,
      createQuackMemory: mockCreateQuackMemory,
      deleteMemory: mockDeleteMemory,
    });

    render(<MemoryGraphTabView tab={mockTab} isActive={true} />);

    const refreshButton = screen.getByTitle('Refresh');
    expect(refreshButton).toBeDisabled();
  });
});

describe('MemoryGraphTabView - Graph Data Conversion', () => {
  const mockRefresh = vi.fn();
  const mockCreateQuackMemory = vi.fn();
  const mockDeleteMemory = vi.fn();

  it('handles mixed MCP and Quack items', () => {
    vi.mocked(useUnifiedMemory).mockReturnValue({
      unifiedItems: [mockMcpItem, mockQuackItem],
      isLoading: false,
      stats: { mcp: 1, quack: 1, total: 2 },
      refresh: mockRefresh,
      createQuackMemory: mockCreateQuackMemory,
      deleteMemory: mockDeleteMemory,
    });

    render(<MemoryGraphTabView tab={mockTab} isActive={true} />);

    // ForceGraph should be rendered with both items
    expect(screen.getByTestId('force-graph')).toBeInTheDocument();
  });

  it('handles items with relations', () => {
    const mcpWithRelations: UnifiedMemoryItem = {
      ...mockMcpItem,
      relations: [{ from: 'TestEntity', to: 'OtherEntity', relationType: 'uses' }],
    };

    vi.mocked(useUnifiedMemory).mockReturnValue({
      unifiedItems: [mcpWithRelations],
      isLoading: false,
      stats: { mcp: 1, quack: 0, total: 1 },
      refresh: mockRefresh,
      createQuackMemory: mockCreateQuackMemory,
      deleteMemory: mockDeleteMemory,
    });

    render(<MemoryGraphTabView tab={mockTab} isActive={true} />);

    expect(screen.getByTestId('force-graph')).toBeInTheDocument();
  });
});
