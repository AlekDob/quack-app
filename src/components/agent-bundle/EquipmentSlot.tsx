import React from 'react';

interface EquipmentSlotProps {
  label: string;
  items: string[];
  maxItems?: number;
  onAdd: () => void;
  onRemove: (item: string) => void;
  color?: string;
}

/**
 * Equipment Slot Component
 *
 * Displays a single equipment category (skills, droids, rules, commands)
 * with add/remove functionality and cyberpunk styling.
 */
export function EquipmentSlot({
  label,
  items,
  maxItems = 6,
  onAdd,
  onRemove,
  color = '#00D4FF',
}: EquipmentSlotProps) {
  const isEmpty = items.length === 0;
  const isFull = maxItems && items.length >= maxItems;

  return (
    <div className="equipment-slot">
      <div className="equipment-slot-header">
        <span className="equipment-slot-label" style={{ color }}>
          {label}
        </span>
        <span className="equipment-slot-count">
          {items.length}/{maxItems}
        </span>
      </div>

      <div className="equipment-slot-items">
        {items.map((item) => (
          <div
            key={item}
            className="equipment-item"
            onClick={() => onRemove(item)}
            title={`Click to remove: ${item}`}
          >
            <div className="equipment-item-glow" style={{ backgroundColor: color }} />
            <span className="equipment-item-name">{item}</span>
            <button
              className="equipment-item-remove"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(item);
              }}
              aria-label={`Remove ${item}`}
            >
              ×
            </button>
          </div>
        ))}

        {!isFull && (
          <button
            className="equipment-item equipment-item-add"
            onClick={onAdd}
            aria-label={`Add ${label}`}
          >
            <div className="equipment-item-glow" style={{ backgroundColor: color }} />
            <span className="equipment-item-plus">+</span>
          </button>
        )}
      </div>
    </div>
  );
}
