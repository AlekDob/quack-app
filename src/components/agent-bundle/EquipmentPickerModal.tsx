import React, { useState, useMemo } from 'react';
import './EquipmentPickerModal.css';

export interface EquipmentPickerModalProps {
  open: boolean;
  title: string; // "Select Skills" | "Select Droids" | etc.
  items: string[]; // Available items to pick from
  selectedItems: string[]; // Currently selected items
  maxItems?: number; // Max selectable items
  color?: string; // Category color (cyan for skills, red for droids, etc.)
  onConfirm: (selected: string[]) => void;
  onCancel: () => void;
}

/**
 * Equipment Picker Modal - Clean Modern Style
 *
 * Modal for selecting equipment (skills, droids, rules, commands) in Agent Bundle Editor.
 * Features search/filter, checkboxes, selection counter, and clean dark theme.
 *
 * @example
 * ```tsx
 * <EquipmentPickerModal
 *   open={isOpen}
 *   title="Select Skills"
 *   items={['frontend-developer', 'backend-specialist', 'devops-engineer']}
 *   selectedItems={['frontend-developer']}
 *   maxItems={6}
 *   color="#f28c52"
 *   onConfirm={(selected) => setSelectedSkills(selected)}
 *   onCancel={() => setIsOpen(false)}
 * />
 * ```
 */
export function EquipmentPickerModal({
  open,
  title,
  items,
  selectedItems,
  maxItems = 6,
  color = '#f28c52',
  onConfirm,
  onCancel,
}: EquipmentPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [localSelected, setLocalSelected] = useState<string[]>(selectedItems);

  // Reset local selection when modal opens
  React.useEffect(() => {
    if (open) {
      setLocalSelected(selectedItems);
      setSearchQuery('');
    }
  }, [open, selectedItems]);

  // Filter items based on search query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const query = searchQuery.toLowerCase();
    return items.filter((item) => item.toLowerCase().includes(query));
  }, [items, searchQuery]);

  // Toggle item selection
  const handleToggleItem = (item: string) => {
    if (localSelected.includes(item)) {
      setLocalSelected(localSelected.filter((i) => i !== item));
    } else {
      // Check if we've reached max items
      if (maxItems && localSelected.length >= maxItems) {
        return; // Don't allow selection if max reached
      }
      setLocalSelected([...localSelected, item]);
    }
  };

  // Handle confirm
  const handleConfirm = () => {
    onConfirm(localSelected);
  };

  // Handle cancel
  const handleCancel = () => {
    setLocalSelected(selectedItems); // Reset to original
    onCancel();
  };

  // Check if max items reached
  const isMaxReached = maxItems && localSelected.length >= maxItems;

  if (!open) return null;

  return (
    <div className="equipment-picker-overlay" onClick={handleCancel}>
      <div
        className="equipment-picker-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="picker-header">
          <h2 className="picker-title">{title}</h2>
          <div className="picker-counter">
            <span className="counter-current" style={{ color }}>
              {localSelected.length}
            </span>
            <span className="counter-divider">/</span>
            <span className="counter-max">{maxItems}</span>
            <span className="counter-label">selected</span>
          </div>
        </div>

        {/* Search Input */}
        <div className="picker-search">
          <input
            type="text"
            className="picker-search-input"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
        </div>

        {/* Items List */}
        <div className="picker-items">
          {filteredItems.length === 0 ? (
            <div className="picker-empty">No items found</div>
          ) : (
            filteredItems.map((item) => {
              const isSelected = localSelected.includes(item);
              const isDisabled = !isSelected && isMaxReached;

              return (
                <div
                  key={item}
                  className={`picker-item ${isSelected ? 'selected' : ''} ${
                    isDisabled ? 'disabled' : ''
                  }`}
                  onClick={() => !isDisabled && handleToggleItem(item)}
                >
                  {/* Checkbox */}
                  <div
                    className={`picker-checkbox ${isSelected ? 'checked' : ''}`}
                    style={{
                      borderColor: isSelected ? color : 'rgba(255, 255, 255, 0.2)',
                      backgroundColor: isSelected ? color : 'transparent',
                    }}
                  >
                    {isSelected && <span className="checkbox-check">✓</span>}
                  </div>

                  {/* Item name */}
                  <span className="picker-item-name">{item}</span>
                </div>
              );
            })
          )}
        </div>

        {/* Actions */}
        <div className="picker-actions">
          <button
            className="picker-btn picker-btn-cancel"
            onClick={handleCancel}
          >
            Cancel
          </button>
          <button
            className="picker-btn picker-btn-confirm"
            onClick={handleConfirm}
            style={{ backgroundColor: color }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
