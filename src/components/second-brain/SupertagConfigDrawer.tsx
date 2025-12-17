/**
 * SupertagConfigDrawer
 *
 * Drawer component for editing supertag configuration:
 * - Tag name (rename)
 * - Color (color picker)
 * - Custom properties (text, date, select, entity, image)
 */

import React, { useState, useCallback, useEffect } from 'react';
import { X, Plus, Trash2, Type, Calendar, List, AtSign, Image } from 'lucide-react';
import type {
  SupertagConfig,
  SupertagProperty,
  SupertagPropertyType,
} from '../../services/supertagConfigService';
import {
  COLOR_PALETTE,
  generatePropertyId,
} from '../../services/supertagConfigService';

interface SupertagConfigDrawerProps {
  isOpen: boolean;
  tagName: string;
  initialConfig: SupertagConfig;
  onClose: () => void;
  onSave: (config: SupertagConfig) => Promise<void>;
}

// Property type labels and icons
const PROPERTY_TYPES: { value: SupertagPropertyType; label: string; icon: React.ReactNode }[] = [
  { value: 'text', label: 'Text', icon: <Type size={14} /> },
  { value: 'date', label: 'Date', icon: <Calendar size={14} /> },
  { value: 'select', label: 'Select', icon: <List size={14} /> },
  { value: 'entity', label: 'Entity (@)', icon: <AtSign size={14} /> },
  { value: 'image', label: 'Image', icon: <Image size={14} /> },
];

export const SupertagConfigDrawer: React.FC<SupertagConfigDrawerProps> = ({
  isOpen,
  tagName,
  initialConfig,
  onClose,
  onSave,
}) => {
  const [config, setConfig] = useState<SupertagConfig>(initialConfig);
  const [isSaving, setIsSaving] = useState(false);

  // Reset config when drawer opens with new tag
  useEffect(() => {
    setConfig(initialConfig);
  }, [initialConfig, tagName]);

  // Handle name change
  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setConfig(prev => ({ ...prev, name: e.target.value.toLowerCase() }));
  }, []);

  // Handle color change
  const handleColorChange = useCallback((color: string) => {
    setConfig(prev => ({ ...prev, color }));
  }, []);

  // Add new property
  const handleAddProperty = useCallback(() => {
    const newProperty: SupertagProperty = {
      id: generatePropertyId(),
      name: '',
      type: 'text',
    };
    setConfig(prev => ({
      ...prev,
      properties: [...prev.properties, newProperty],
    }));
  }, []);

  // Update property
  const handleUpdateProperty = useCallback((propertyId: string, updates: Partial<SupertagProperty>) => {
    setConfig(prev => ({
      ...prev,
      properties: prev.properties.map(p =>
        p.id === propertyId ? { ...p, ...updates } : p
      ),
    }));
  }, []);

  // Delete property
  const handleDeleteProperty = useCallback((propertyId: string) => {
    setConfig(prev => ({
      ...prev,
      properties: prev.properties.filter(p => p.id !== propertyId),
    }));
  }, []);

  // Add option to select property
  const handleAddOption = useCallback((propertyId: string) => {
    setConfig(prev => ({
      ...prev,
      properties: prev.properties.map(p => {
        if (p.id === propertyId) {
          const options = p.options || [];
          return {
            ...p,
            options: [...options, { value: `option_${options.length + 1}`, label: '' }],
          };
        }
        return p;
      }),
    }));
  }, []);

  // Update option
  const handleUpdateOption = useCallback((propertyId: string, optionIndex: number, label: string) => {
    setConfig(prev => ({
      ...prev,
      properties: prev.properties.map(p => {
        if (p.id === propertyId && p.options) {
          const newOptions = [...p.options];
          newOptions[optionIndex] = {
            value: label.toLowerCase().replace(/\s+/g, '_'),
            label,
          };
          return { ...p, options: newOptions };
        }
        return p;
      }),
    }));
  }, []);

  // Delete option
  const handleDeleteOption = useCallback((propertyId: string, optionIndex: number) => {
    setConfig(prev => ({
      ...prev,
      properties: prev.properties.map(p => {
        if (p.id === propertyId && p.options) {
          return {
            ...p,
            options: p.options.filter((_, i) => i !== optionIndex),
          };
        }
        return p;
      }),
    }));
  }, []);

  // Save config
  const handleSave = useCallback(async () => {
    if (!config.name.trim()) return;

    setIsSaving(true);
    try {
      await onSave(config);
      onClose();
    } catch (error) {
      console.error('Failed to save supertag config:', error);
    } finally {
      setIsSaving(false);
    }
  }, [config, onSave, onClose]);

  // Handle overlay click
  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div className="supertag-config-overlay" onClick={handleOverlayClick} />

      {/* Drawer */}
      <div className="supertag-config-drawer">
        {/* Header */}
        <div className="supertag-config-header">
          <div className="supertag-config-title">
            <div
              className="supertag-config-indicator"
              style={{ background: config.color }}
            />
            <h3>#{config.name || tagName}</h3>
          </div>
          <button className="supertag-config-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="supertag-config-content">
          {/* Basic Settings */}
          <div className="supertag-config-section">
            <div className="supertag-config-section-title">Basic Settings</div>

            {/* Name */}
            <div className="supertag-form-group">
              <label>Tag Name</label>
              <input
                type="text"
                className="supertag-form-input"
                value={config.name}
                onChange={handleNameChange}
                placeholder="Enter tag name..."
              />
            </div>

            {/* Color */}
            <div className="supertag-form-group">
              <label>Color</label>
              <div className="supertag-color-picker">
                <div className="supertag-color-palette">
                  {COLOR_PALETTE.map(color => (
                    <button
                      key={color}
                      className={`supertag-color-swatch ${config.color === color ? 'selected' : ''}`}
                      style={{ background: color }}
                      onClick={() => handleColorChange(color)}
                      title={color}
                    />
                  ))}
                </div>
                <div className="supertag-color-custom">
                  <input
                    type="text"
                    className="supertag-color-custom-input"
                    value={config.color}
                    onChange={e => handleColorChange(e.target.value)}
                    placeholder="#000000"
                  />
                  <div
                    className="supertag-color-preview"
                    style={{ background: config.color }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Properties */}
          <div className="supertag-config-section">
            <div className="supertag-config-section-title">Properties</div>

            {config.properties.length === 0 ? (
              <div className="supertag-property-empty">
                No properties defined. Add properties to create fields for this tag type.
              </div>
            ) : (
              <div className="supertag-property-list">
                {config.properties.map(property => (
                  <PropertyEditor
                    key={property.id}
                    property={property}
                    onUpdate={updates => handleUpdateProperty(property.id, updates)}
                    onDelete={() => handleDeleteProperty(property.id)}
                    onAddOption={() => handleAddOption(property.id)}
                    onUpdateOption={(index, label) => handleUpdateOption(property.id, index, label)}
                    onDeleteOption={index => handleDeleteOption(property.id, index)}
                  />
                ))}
              </div>
            )}

            <button className="supertag-add-property-btn" onClick={handleAddProperty}>
              <Plus size={14} />
              Add Property
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="supertag-config-footer">
          <button
            className="supertag-config-btn supertag-config-btn-cancel"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="supertag-config-btn supertag-config-btn-save"
            onClick={handleSave}
            disabled={isSaving || !config.name.trim()}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </>
  );
};

// Property Editor Component
interface PropertyEditorProps {
  property: SupertagProperty;
  onUpdate: (updates: Partial<SupertagProperty>) => void;
  onDelete: () => void;
  onAddOption: () => void;
  onUpdateOption: (index: number, label: string) => void;
  onDeleteOption: (index: number) => void;
}

const PropertyEditor: React.FC<PropertyEditorProps> = ({
  property,
  onUpdate,
  onDelete,
  onAddOption,
  onUpdateOption,
  onDeleteOption,
}) => {
  return (
    <div className="supertag-property-item">
      <div className="supertag-property-header">
        <input
          type="text"
          className="supertag-property-name"
          value={property.name}
          onChange={e => onUpdate({ name: e.target.value })}
          placeholder="Property name..."
        />
        <button className="supertag-property-delete" onClick={onDelete}>
          <Trash2 size={14} />
        </button>
      </div>

      <div className="supertag-property-type-row">
        <span className="supertag-property-type-label">Type</span>
        <select
          className="supertag-property-type-select"
          value={property.type}
          onChange={e => onUpdate({
            type: e.target.value as SupertagPropertyType,
            options: e.target.value === 'select' ? [] : undefined,
          })}
        >
          {PROPERTY_TYPES.map(type => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      {/* Options for select type */}
      {property.type === 'select' && (
        <div className="supertag-property-options">
          <span className="supertag-property-options-label">Options</span>
          {property.options?.map((option, index) => (
            <div key={index} className="supertag-property-option-row">
              <input
                type="text"
                className="supertag-property-option-input"
                value={option.label}
                onChange={e => onUpdateOption(index, e.target.value)}
                placeholder={`Option ${index + 1}`}
              />
              <button
                className="supertag-property-option-delete"
                onClick={() => onDeleteOption(index)}
              >
                <X size={12} />
              </button>
            </div>
          ))}
          <button className="supertag-property-option-add" onClick={onAddOption}>
            <Plus size={12} /> Add option
          </button>
        </div>
      )}
    </div>
  );
};

export default SupertagConfigDrawer;
