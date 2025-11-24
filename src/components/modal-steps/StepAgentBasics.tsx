/**
 * Step 2: Agent Basics
 * - Agent name
 * - Color selection
 * - Avatar selection (default + custom upload)
 * - Personality configuration (role, technical context, communication style, custom notes)
 */

import { AVAILABLE_AVATARS, getAvatarUrl } from '../../utils/agentAvatars';
import type { StepAgentBasicsProps } from './types';

const COMMUNICATION_STYLES = [
  { id: 'professional', label: 'Professional', description: 'Formal and precise' },
  { id: 'friendly', label: 'Friendly', description: 'Warm and approachable' },
  { id: 'casual', label: 'Casual', description: 'Relaxed and informal' },
  { id: 'technical', label: 'Technical', description: 'Highly detailed and technical' },
  { id: 'sarcastic', label: 'Sarcastic', description: 'Witty and ironic' },
];

export function StepAgentBasics({
  name,
  color,
  avatar,
  availableColors,
  customAvatars,
  customAvatarUrls,
  loadingAvatars,
  uploadingAvatar,
  uploadError,
  personality,
  onNameChange,
  onColorChange,
  onAvatarChange,
  onPersonalityChange,
  onAvatarUpload,
  onDeleteCustomAvatar,
  fileInputRef,
  onNext,
  onBack,
}: StepAgentBasicsProps) {
  const handlePersonalityFieldChange = (field: string, value: string) => {
    onPersonalityChange({
      ...personality,
      [field]: value,
    });
  };

  return (
    <>
      {/* Agent Name */}
      <label className="modal-field">
        <span className="field-label">Agent name</span>
        <input
          type="text"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="e.g. API Server"
          autoFocus
        />
      </label>

      {/* Avatar Selection */}
      <div className="modal-field">
        <span className="field-label">Avatar</span>
        <span className="field-hint">
          {customAvatars.length > 0 ? 'Custom and default avatars ↓' : 'Scroll for more avatars ↓'}
        </span>
        {uploadError && (
          <div className="avatar-upload-error">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            {uploadError}
          </div>
        )}
        <div className="avatar-grid-container">
          <div className="avatar-grid">
            {/* Upload Button */}
            <button
              type="button"
              className="avatar-upload-button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              aria-label="Upload custom avatar"
            >
              {uploadingAvatar ? (
                <div className="avatar-upload-spinner">
                  <svg className="spinner-icon" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" strokeWidth="3" />
                  </svg>
                </div>
              ) : (
                <>
                  <svg className="plus-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  <span className="upload-label">Upload</span>
                </>
              )}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={onAvatarUpload}
              style={{ display: 'none' }}
            />

            {/* Custom Avatars */}
            {customAvatars.map((customAvatar) => (
              <button
                key={customAvatar.id}
                type="button"
                className={`avatar-option custom-avatar ${avatar === customAvatar.id ? 'selected' : ''} ${!customAvatarUrls[customAvatar.id] && loadingAvatars ? 'loading' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (customAvatarUrls[customAvatar.id]) {
                    onAvatarChange(customAvatar.id);
                  }
                }}
                aria-label={`Select custom avatar ${customAvatar.originalName}`}
                disabled={!customAvatarUrls[customAvatar.id] && loadingAvatars}
              >
                {customAvatarUrls[customAvatar.id] ? (
                  <img
                    src={customAvatarUrls[customAvatar.id]}
                    alt={customAvatar.originalName}
                    className="avatar-image"
                  />
                ) : loadingAvatars ? (
                  <div className="avatar-loading-spinner">
                    <svg className="spinner-icon" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" strokeWidth="3" />
                    </svg>
                  </div>
                ) : null}
                {customAvatarUrls[customAvatar.id] && (
                  <button
                    type="button"
                    className="avatar-delete-button"
                    onClick={(e) => onDeleteCustomAvatar(customAvatar.id, e)}
                    aria-label="Delete custom avatar"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                )}
              </button>
            ))}

            {/* Default Avatars */}
            {AVAILABLE_AVATARS.map((avatarName) => (
              <button
                key={avatarName}
                type="button"
                className={`avatar-option ${avatar === avatarName ? 'selected' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onAvatarChange(avatarName);
                }}
                aria-label={`Select ${avatarName} avatar`}
              >
                <img
                  src={getAvatarUrl(avatarName)}
                  alt={avatarName}
                  className="avatar-image"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Color Selection */}
      <div className="modal-field">
        <span className="field-label">Agent color</span>
        <div className="modal-color-grid">
          {availableColors.map((preset) => (
            <button
              key={preset}
              type="button"
              className={`modal-color-swatch ${preset === color ? 'selected' : ''}`}
              style={{ backgroundColor: preset }}
              onClick={() => onColorChange(preset)}
              aria-label={`Select color ${preset}`}
            />
          ))}
          <label className="modal-color-picker">
            <input
              type="color"
              value={color}
              onChange={(event) => onColorChange(event.target.value)}
              aria-label="Choose a custom color"
            />
          </label>
        </div>
      </div>

      <div className="modal-section-divider" />

      {/* Personality Configuration */}
      <div className="personality-section">
        <h3 className="personality-section-title">Agent Personality</h3>

        {/* Role/Mission */}
        <label className="modal-field personality-field">
          <span className="field-label">Role / Mission</span>
          <input
            type="text"
            value={personality.role || ''}
            onChange={(e) => handlePersonalityFieldChange('role', e.target.value)}
            placeholder="e.g. Feature Coordinator, Frontend Developer, API Architect..."
            className="personality-input"
          />
        </label>

        {/* Communication Style */}
        <div className="modal-field personality-field">
          <span className="field-label">Communication Style</span>
          <div className="communication-styles-grid">
            {COMMUNICATION_STYLES.map((style) => (
              <button
                key={style.id}
                type="button"
                className={`communication-style-option ${personality.communicationStyle === style.id ? 'selected' : ''}`}
                onClick={() => handlePersonalityFieldChange('communicationStyle', style.id)}
              >
                <span className="style-label">{style.label}</span>
                <span className="style-description">{style.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Notes */}
        <label className="modal-field personality-field">
          <span className="field-label">Custom Notes</span>
          <span className="field-hint">Additional instructions for this agent</span>
          <textarea
            value={personality.customNotes || ''}
            onChange={(e) => handlePersonalityFieldChange('customNotes', e.target.value)}
            placeholder="Any special instructions, preferences, or guidelines..."
            rows={5}
            className="personality-textarea"
          />
        </label>
      </div>

      {/* Actions */}
      <div className="modal-actions">
        <button type="button" className="secondary" onClick={onBack}>
          ← Back
        </button>
        <button
          type="button"
          className="primary"
          onClick={onNext}
          disabled={!name.trim()}
        >
          Continue →
        </button>
      </div>
    </>
  );
}
