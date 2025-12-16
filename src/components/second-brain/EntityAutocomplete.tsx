import { memo, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { mcpMemoryService } from '../../services/mcpMemoryService';
import type { MCPEntity } from '../../services/mcpMemoryService';

interface EntityAutocompleteProps {
  inputValue: string;
  cursorPosition: number;
  onSelect: (value: string, type: '@' | '#') => void;
  onClose: () => void;
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
}

interface AutocompleteItem {
  value: string;
  label: string;
  type: '@' | '#';
  entityType?: string;
}

// Predefined supertags (entity types) with colors
export const SUPERTAGS = [
  { value: 'fact', label: 'Fact', color: '#10b981' },
  { value: 'task', label: 'Task', color: '#f59e0b' },
  { value: 'note', label: 'Note', color: '#8b5cf6' },
  { value: 'idea', label: 'Idea', color: '#10b981' },
  { value: 'preference', label: 'Preference', color: '#3b82f6' },
  { value: 'decision', label: 'Decision', color: '#8b5cf6' },
  { value: 'pattern', label: 'Pattern', color: '#f97316' },
  { value: 'context', label: 'Context', color: '#6b7280' },
  { value: 'person', label: 'Person', color: '#E84A7F' },
  { value: 'project', label: 'Project', color: '#E84A7F' },
  { value: 'mistake', label: 'Mistake', color: '#ef4444' },
  { value: 'technology', label: 'Technology', color: '#00d9ff' },
  { value: 'tool', label: 'Tool', color: '#00d9ff' },
];

/**
 * Detect if we're in an @ or # trigger context
 */
function detectTrigger(value: string, cursorPos: number): { trigger: '@' | '#' | null; query: string; startIndex: number } {
  // Look backwards from cursor to find @ or #
  let startIndex = cursorPos - 1;

  while (startIndex >= 0) {
    const char = value[startIndex];

    // Found a trigger character
    if (char === '@' || char === '#') {
      const query = value.slice(startIndex + 1, cursorPos);
      // Only trigger if there's no space in the query
      if (!query.includes(' ')) {
        return { trigger: char as '@' | '#', query, startIndex };
      }
      return { trigger: null, query: '', startIndex: -1 };
    }

    // Hit a space - no trigger active
    if (char === ' ') {
      return { trigger: null, query: '', startIndex: -1 };
    }

    startIndex--;
  }

  return { trigger: null, query: '', startIndex: -1 };
}

function EntityAutocomplete({
  inputValue,
  cursorPosition,
  onSelect,
  onClose,
  inputRef,
}: EntityAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  // Detect current trigger and query
  const { trigger, query, startIndex } = useMemo(
    () => detectTrigger(inputValue, cursorPosition),
    [inputValue, cursorPosition]
  );

  // Get filtered items based on trigger type and query
  const items = useMemo((): AutocompleteItem[] => {
    if (!trigger) return [];

    if (trigger === '#') {
      // Filter supertags
      return SUPERTAGS
        .filter(st => st.value.toLowerCase().includes(query.toLowerCase()))
        .map(st => ({
          value: st.value,
          label: st.label,
          type: '#' as const,
        }));
    }

    // For @mentions, search existing entities
    const graph = mcpMemoryService.getKnowledgeGraph();
    if (!graph) return [];

    return graph.entities
      .filter(e => e.name.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 10)
      .map(e => ({
        value: e.name,
        label: e.observations[0] || e.name,
        type: '@' as const,
        entityType: e.entityType,
      }));
  }, [trigger, query]);

  // Reset selection when items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!trigger || items.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => (prev + 1) % items.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => (prev - 1 + items.length) % items.length);
          break;
        case 'Enter':
        case 'Tab':
          e.preventDefault();
          if (items[selectedIndex]) {
            onSelect(items[selectedIndex].value, trigger);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [trigger, items, selectedIndex, onSelect, onClose]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Don't render if no trigger or no items
  if (!trigger || items.length === 0) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      className="entity-autocomplete"
      role="listbox"
    >
      <div className="entity-autocomplete-header">
        {trigger === '#' ? 'Supertags' : 'Entities'}
      </div>
      {items.map((item, index) => (
        <button
          key={`${item.type}-${item.value}`}
          type="button"
          className={`entity-autocomplete-item ${index === selectedIndex ? 'selected' : ''}`}
          onClick={() => onSelect(item.value, trigger)}
          onMouseEnter={() => setSelectedIndex(index)}
          role="option"
          aria-selected={index === selectedIndex}
        >
          <span className={`entity-autocomplete-type ${item.type === '#' ? 'supertag' : 'mention'}`}>
            {item.type}
          </span>
          <span className="entity-autocomplete-label">
            {item.label}
          </span>
          {item.entityType && (
            <span className="entity-autocomplete-entitytype">
              {item.entityType}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export default memo(EntityAutocomplete);

/**
 * Hook for managing autocomplete state
 */
export function useEntityAutocomplete(
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement>
) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursor = e.target.selectionStart || 0;

    setInputValue(value);
    setCursorPosition(cursor);

    // Check if we should open autocomplete
    const { trigger } = detectTrigger(value, cursor);
    setIsOpen(!!trigger);
  }, []);

  const handleSelect = useCallback((value: string, type: '@' | '#') => {
    const { startIndex } = detectTrigger(inputValue, cursorPosition);

    if (startIndex >= 0) {
      // Replace from trigger to cursor with selected value
      const before = inputValue.slice(0, startIndex);
      const after = inputValue.slice(cursorPosition);
      const newValue = `${before}${type}${value} ${after}`;

      setInputValue(newValue);
      setIsOpen(false);

      // Return new value for external handling
      return newValue;
    }

    return inputValue;
  }, [inputValue, cursorPosition]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  return {
    isOpen,
    inputValue,
    setInputValue,
    cursorPosition,
    handleInputChange,
    handleSelect,
    handleClose,
  };
}
