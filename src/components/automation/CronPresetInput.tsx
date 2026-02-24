import { useState, useCallback, useEffect } from 'react';
import { CRON_PRESETS, isValidCron, cronToHumanReadable } from '../../services/cronUtils';

interface CronPresetInputProps {
  value: string;
  onChange: (expression: string) => void;
  timeValue?: string;
  onTimeChange?: (time: string) => void;
}

/**
 * CronPresetInput - Select from presets or enter custom cron expression.
 * Shows human-readable preview of the current expression.
 */
export default function CronPresetInput({
  value,
  onChange,
  timeValue = '09:00',
  onTimeChange,
}: CronPresetInputProps) {
  const [isCustom, setIsCustom] = useState(false);
  const [customValue, setCustomValue] = useState(value);

  useEffect(() => {
    const matchesPreset = CRON_PRESETS.some(p => applyTime(p.expression, timeValue) === value);
    if (!matchesPreset && value) {
      setIsCustom(true);
      setCustomValue(value);
    }
  }, []);

  const applyTime = (expression: string, time: string): string => {
    const [hours, minutes] = time.split(':');
    const parts = expression.split(' ');
    parts[0] = String(parseInt(minutes, 10));
    parts[1] = String(parseInt(hours, 10));
    return parts.join(' ');
  };

  const handlePresetClick = useCallback((expression: string) => {
    setIsCustom(false);
    const withTime = applyTime(expression, timeValue);
    onChange(withTime);
  }, [onChange, timeValue]);

  const handleTimeChange = useCallback((newTime: string) => {
    onTimeChange?.(newTime);
    if (!isCustom) {
      const currentPreset = CRON_PRESETS.find(p => {
        const applied = applyTime(p.expression, timeValue);
        return applied === value;
      });
      if (currentPreset) {
        onChange(applyTime(currentPreset.expression, newTime));
      }
    }
  }, [isCustom, value, timeValue, onChange, onTimeChange]);

  const handleCustomChange = useCallback((raw: string) => {
    setCustomValue(raw);
    if (isValidCron(raw)) {
      onChange(raw);
    }
  }, [onChange]);

  const handleCustomToggle = useCallback(() => {
    setIsCustom(true);
    setCustomValue(value);
  }, [value]);

  const preview = cronToHumanReadable(value);
  const valid = isValidCron(value);

  return (
    <div className="cron-preset-input">
      {/* Time picker (for presets) */}
      {!isCustom && (
        <div className="automation-form-field" style={{ marginBottom: '12px' }}>
          <label className="automation-form-label">Time</label>
          <input
            type="time"
            className="automation-form-input"
            value={timeValue}
            onChange={e => handleTimeChange(e.target.value)}
            style={{ maxWidth: '140px' }}
          />
        </div>
      )}

      {/* Preset grid */}
      <div className="cron-preset-grid">
        {CRON_PRESETS.map(preset => {
          const presetWithTime = applyTime(preset.expression, timeValue);
          const isActive = !isCustom && presetWithTime === value;
          return (
            <button
              key={preset.expression}
              type="button"
              className={`cron-preset-btn ${isActive ? 'active' : ''}`}
              onClick={() => handlePresetClick(preset.expression)}
            >
              <span className="cron-preset-label">{preset.label}</span>
              <span className="cron-preset-desc">{preset.description}</span>
            </button>
          );
        })}
      </div>

      {/* Custom toggle + input */}
      <div className="cron-custom-row">
        <button
          type="button"
          className={`cron-preset-btn ${isCustom ? 'active' : ''}`}
          onClick={handleCustomToggle}
          style={{ flex: 'none', padding: '6px 10px' }}
        >
          Custom
        </button>
        {isCustom && (
          <input
            type="text"
            className="automation-form-input"
            value={customValue}
            onChange={e => handleCustomChange(e.target.value)}
            placeholder="0 9 * * 1-5"
            style={{ flex: 1, fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}
          />
        )}
      </div>

      {/* Preview */}
      {value && (
        <div className="cron-preview" style={{ color: valid ? undefined : '#F44336' }}>
          {valid ? preview : 'Invalid cron expression'}
        </div>
      )}
    </div>
  );
}
