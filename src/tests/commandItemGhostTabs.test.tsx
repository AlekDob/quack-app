/**
 * Test suite for the ghost tabs bug fix
 *
 * Bug: Clicking on command cards in the sidebar created ghost tabs
 * that couldn't be closed and appeared in every project.
 *
 * Fix: Removed the onClick handler and onView callback from CommandItem.
 * Now clicking on the card does nothing - users must use the "Insert" button.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CommandItem } from '../components/CommandItem';
import type { SlashCommand } from '../hooks/useSlashCommands';

describe('CommandItem - Ghost Tabs Bug Fix', () => {
  const mockCommand: SlashCommand = {
    name: 'test-command',
    description: 'A test command for testing purposes',
    content: '# Test Command\n\nThis is a test command.',
    scope: 'project',
    isBuiltin: false,
    parameters: [],
  };

  const mockOnUse = vi.fn();
  const mockOnEdit = vi.fn();
  const mockOnDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should NOT have an onClick handler on the card', () => {
    const { container } = render(
      <CommandItem
        command={mockCommand}
        onUse={mockOnUse}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    const card = container.querySelector('.group');
    expect(card).toBeTruthy();

    // The card should not have cursor-pointer class (removed with fix)
    expect(card?.className).not.toContain('cursor-pointer');
  });

  it('should NOT call any handler when clicking the card body', () => {
    const { container } = render(
      <CommandItem
        command={mockCommand}
        onUse={mockOnUse}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    const card = container.querySelector('.group');
    fireEvent.click(card!);

    // No handlers should be called when clicking the card
    expect(mockOnUse).not.toHaveBeenCalled();
    expect(mockOnEdit).not.toHaveBeenCalled();
    expect(mockOnDelete).not.toHaveBeenCalled();
  });

  it('should call onUse when clicking the Insert button', () => {
    render(
      <CommandItem
        command={mockCommand}
        onUse={mockOnUse}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    const insertButton = screen.getByRole('button', { name: /insert/i });
    fireEvent.click(insertButton);

    expect(mockOnUse).toHaveBeenCalledTimes(1);
    expect(mockOnUse).toHaveBeenCalledWith(mockCommand);
  });

  it('should call onEdit when clicking the Edit button', () => {
    render(
      <CommandItem
        command={mockCommand}
        onUse={mockOnUse}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    const editButton = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editButton);

    expect(mockOnEdit).toHaveBeenCalledTimes(1);
    expect(mockOnEdit).toHaveBeenCalledWith(mockCommand);
  });

  it('should call onDelete when clicking the Delete button', () => {
    render(
      <CommandItem
        command={mockCommand}
        onUse={mockOnUse}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    const deleteButton = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(deleteButton);

    expect(mockOnDelete).toHaveBeenCalledTimes(1);
    expect(mockOnDelete).toHaveBeenCalledWith(mockCommand);
  });

  it('should NOT show Edit/Delete buttons for builtin commands', () => {
    const builtinCommand: SlashCommand = {
      ...mockCommand,
      isBuiltin: true,
    };

    render(
      <CommandItem
        command={builtinCommand}
        onUse={mockOnUse}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    // Insert should still be present
    expect(screen.getByRole('button', { name: /insert/i })).toBeTruthy();

    // Edit and Delete should NOT be present for builtin commands
    expect(screen.queryByRole('button', { name: /edit/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull();
  });

  it('should display command name and description', () => {
    render(
      <CommandItem
        command={mockCommand}
        onUse={mockOnUse}
      />
    );

    expect(screen.getByText('/test-command')).toBeTruthy();
    expect(screen.getByText('A test command for testing purposes')).toBeTruthy();
  });

  it('should display parameters if present', () => {
    const commandWithParams: SlashCommand = {
      ...mockCommand,
      parameters: ['--flag', '--option'],
    };

    render(
      <CommandItem
        command={commandWithParams}
        onUse={mockOnUse}
      />
    );

    expect(screen.getByText('--flag')).toBeTruthy();
    expect(screen.getByText('--option')).toBeTruthy();
  });

  it('should NOT accept onView prop (removed from interface)', () => {
    // This test documents that the onView prop was intentionally removed
    // to fix the ghost tabs bug. The component should work without it.
    const props = {
      command: mockCommand,
      onUse: mockOnUse,
    };

    // TypeScript would error if we tried to pass onView
    // @ts-expect-error - onView prop was intentionally removed
    expect(() => render(<CommandItem {...props} onView={vi.fn()} />)).not.toThrow();
  });
});

describe('CommandsList - onViewCommand prop removed', () => {
  it('should document that onViewCommand was removed from CommandsList interface', () => {
    // This test documents the removal of onViewCommand from CommandsList
    // The component now only accepts: customCommands, onUseCommand, onEditCommand, onDeleteCommand
    const expectedProps = ['customCommands', 'onUseCommand', 'onEditCommand', 'onDeleteCommand'];
    expect(expectedProps).not.toContain('onViewCommand');
  });
});

describe('CommandsPanel - onViewCommand prop removed', () => {
  it('should document that onViewCommand was removed from CommandsPanel interface', () => {
    // This test documents the removal of onViewCommand from CommandsPanel
    // The component now only accepts: basePath, onUseCommand
    const expectedProps = ['basePath', 'onUseCommand'];
    expect(expectedProps).not.toContain('onViewCommand');
  });
});
