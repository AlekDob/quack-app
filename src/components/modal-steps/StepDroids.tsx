/**
 * Step 4: Droids Selection
 * - Select droids (sub-agents) for delegation
 * - Show empty state if no droids found
 * - Integration with Droid Factory
 */

import { useState, useMemo } from 'react';
import type { DroidMetadata } from './types';

interface StepDroidsProps {
  availableDroids: DroidMetadata[];
  selectedDroids: string[];
  loadingDroids: boolean;
  onDroidToggle: (droidId: string) => void;
  onOpenDroidFactory: () => void;
  onBack: () => void;
  onNext: () => void;
}

export function StepDroids({
  availableDroids,
  selectedDroids,
  loadingDroids,
  onDroidToggle,
  onOpenDroidFactory,
  onBack,
  onNext,
}: StepDroidsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const hasDroids = availableDroids.length > 0;

  console.log('[StepDroids] availableDroids:', availableDroids);
  console.log('[StepDroids] loadingDroids:', loadingDroids);

  // Filter droids based on search query
  const filteredDroids = useMemo(() => {
    if (!searchQuery.trim()) return availableDroids;

    const query = searchQuery.toLowerCase();
    return availableDroids.filter(droid =>
      droid.name.toLowerCase().includes(query) ||
      droid.description.toLowerCase().includes(query) ||
      droid.specialization.toLowerCase().includes(query)
    );
  }, [availableDroids, searchQuery]);

  return (
    <>
      {/* Intro Message */}
      <div className="step-intro-message">
        <svg className="intro-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 16v-4"></path>
          <path d="M12 8h.01"></path>
        </svg>
        <p className="intro-text">
          <strong>Pre-select droids to enable task delegation.</strong> These specialized sub-agents help with complex workflows, but you can always invoke any available droid in chat.
        </p>
      </div>

      {/* Droids Selector */}
      <div className="config-section">
        <div className="config-section-header">
          <svg className="config-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          <div>
            <h3 className="config-section-title">Droids</h3>
            <p className="config-section-subtitle">
              Select specialized sub-agents for task delegation
            </p>
          </div>
        </div>

        {/* Search Bar */}
        {hasDroids && (
          <div className="config-search">
            <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search droids..."
              className="search-input"
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            )}
          </div>
        )}

        {loadingDroids ? (
          <div className="config-loading">
            <span className="spinner"></span>
            Loading droids...
          </div>
        ) : hasDroids ? (
          <>
            {filteredDroids.length === 0 ? (
              <div className="config-empty-state">
                <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.35-4.35"></path>
                </svg>
                <p className="empty-text">No droids match "{searchQuery}"</p>
                <p className="empty-hint">Try a different search term</p>
              </div>
            ) : (
              <div className="config-items-list">
                {filteredDroids.map((droid) => (
                  <label key={droid.id} className="config-item">
                    <input
                      type="checkbox"
                      checked={selectedDroids.includes(droid.id)}
                      onChange={() => onDroidToggle(droid.id)}
                    />
                    <span className="config-checkbox"></span>
                    <img
                      src="/images/droid.jpeg"
                      alt="Droid avatar"
                      className="config-item-avatar"
                    />
                    <div className="config-item-content">
                      <span className="config-item-name">
                        {droid.name}
                        {droid.isGlobal && <span className="global-badge">GLOBAL</span>}
                      </span>
                      <span className="config-item-specialization">{droid.specialization}</span>
                      <span className="config-item-path">{droid.path}</span>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="config-empty-state">
            <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <p className="empty-text">No droids found</p>
            <p className="empty-hint">Create droids with Droid Factory to delegate tasks</p>
          </div>
        )}
      </div>

      {/* Droid Factory CTA (only when no droids) */}
      {!hasDroids && (
        <div className="droid-factory-cta">
          <button
            type="button"
            className="droid-factory-button"
            onClick={onOpenDroidFactory}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="16"></line>
              <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
            Open Droid Factory
          </button>
          <p className="droid-factory-hint">
            Create new droids to add specialized sub-agents to your team
          </p>
        </div>
      )}

      {/* Selection Summary */}
      {selectedDroids.length > 0 && (
        <div className="selection-summary">
          <h4 className="summary-title">Selected Droids ({selectedDroids.length})</h4>
          <ul className="summary-list">
            {selectedDroids.map(id => {
              const droid = availableDroids.find(d => d.id === id);
              return droid ? <li key={id}>{droid.name}</li> : null;
            })}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="modal-actions">
        <button type="button" className="secondary" onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          className="primary"
          onClick={onNext}
        >
          Continue
        </button>
      </div>
    </>
  );
}
