import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EquipBar from '../components/chat/EquipBar';

describe('EquipBar', () => {
  const mockSkills = ['frontend-developer', 'backend-engineer', 'test-engineer'];
  const mockDroids = ['protocol-droid-1', 'protocol-droid-2'];
  const mockCommands = ['commit', 'feature', 'background'];

  it('should render all three buttons', () => {
    render(
      <EquipBar
        skills={mockSkills}
        droids={mockDroids}
        commands={mockCommands}
        onInsertSkill={vi.fn()}
        onInsertDroid={vi.fn()}
        onInsertCommand={vi.fn()}
      />
    );

    expect(screen.getByText('Skills')).toBeInTheDocument();
    expect(screen.getByText('Droids')).toBeInTheDocument();
    expect(screen.getByText('Commands')).toBeInTheDocument();
  });

  it('should open popover when clicking skills button', () => {
    render(
      <EquipBar
        skills={mockSkills}
        droids={mockDroids}
        commands={mockCommands}
        onInsertSkill={vi.fn()}
        onInsertDroid={vi.fn()}
        onInsertCommand={vi.fn()}
      />
    );

    const skillsButton = screen.getByText('Skills');
    fireEvent.click(skillsButton);

    // Should show all skills in popover
    expect(screen.getByText('frontend-developer')).toBeInTheDocument();
    expect(screen.getByText('backend-engineer')).toBeInTheDocument();
    expect(screen.getByText('test-engineer')).toBeInTheDocument();
  });

  it('should call onInsertSkill when clicking a skill item', () => {
    const onInsertSkill = vi.fn();
    render(
      <EquipBar
        skills={mockSkills}
        droids={mockDroids}
        commands={mockCommands}
        onInsertSkill={onInsertSkill}
        onInsertDroid={vi.fn()}
        onInsertCommand={vi.fn()}
      />
    );

    // Open popover
    fireEvent.click(screen.getByText('Skills'));

    // Click a skill
    fireEvent.click(screen.getByText('frontend-developer'));

    expect(onInsertSkill).toHaveBeenCalledWith('frontend-developer');
  });

  it('should call onInsertCommand when clicking a command item', () => {
    const onInsertCommand = vi.fn();
    render(
      <EquipBar
        skills={mockSkills}
        droids={mockDroids}
        commands={mockCommands}
        onInsertSkill={vi.fn()}
        onInsertDroid={vi.fn()}
        onInsertCommand={onInsertCommand}
      />
    );

    // Open popover
    fireEvent.click(screen.getByText('Commands'));

    // Click a command (should show with / prefix)
    fireEvent.click(screen.getByText('/commit'));

    expect(onInsertCommand).toHaveBeenCalledWith('commit');
  });

  it('should disable button when no items available', () => {
    render(
      <EquipBar
        skills={[]}
        droids={mockDroids}
        commands={mockCommands}
        onInsertSkill={vi.fn()}
        onInsertDroid={vi.fn()}
        onInsertCommand={vi.fn()}
      />
    );

    const skillsButton = screen.getByText('Skills').closest('button');
    expect(skillsButton).toBeDisabled();
  });

  it('should close popover when clicking an item', () => {
    render(
      <EquipBar
        skills={mockSkills}
        droids={mockDroids}
        commands={mockCommands}
        onInsertSkill={vi.fn()}
        onInsertDroid={vi.fn()}
        onInsertCommand={vi.fn()}
      />
    );

    // Open popover
    fireEvent.click(screen.getByText('Skills'));
    expect(screen.getByText('frontend-developer')).toBeInTheDocument();

    // Click an item
    fireEvent.click(screen.getByText('frontend-developer'));

    // Popover should close (item no longer visible)
    expect(screen.queryByText('frontend-developer')).not.toBeInTheDocument();
  });
});
