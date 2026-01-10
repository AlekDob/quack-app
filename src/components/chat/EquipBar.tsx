import { useState, useRef } from 'react';
import './EquipBar.css';

interface EquipBarProps {
  skills: string[];
  droids: string[];
  commands: string[];
  onInsertSkill: (skill: string) => void;
  onInsertDroid: (droid: string) => void;
  onInsertCommand: (command: string) => void;
}

type PopoverType = 'skills' | 'droids' | 'commands' | null;

/**
 * EquipBar - Equipment picker for chat footer
 * Shows three buttons (Skills, Droids, Commands) that open popovers on hover
 * to insert @skill:name, @droid:name, or /command into the prompt
 */
export default function EquipBar({
  skills,
  droids,
  commands,
  onInsertSkill,
  onInsertDroid,
  onInsertCommand,
}: EquipBarProps) {
  const [openPopover, setOpenPopover] = useState<PopoverType>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Open popover on hover
  const handleMouseEnter = (type: PopoverType) => {
    // Clear any pending close timeout
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setOpenPopover(type);
  };

  // Close popover on leave with delay
  const handleMouseLeave = () => {
    // Add delay to allow moving to popover
    closeTimeoutRef.current = setTimeout(() => {
      setOpenPopover(null);
      closeTimeoutRef.current = null;
    }, 150);
  };

  const handleItemClick = (type: PopoverType, item: string) => {
    if (type === 'skills') onInsertSkill(item);
    else if (type === 'droids') onInsertDroid(item);
    else if (type === 'commands') onInsertCommand(item);
    setOpenPopover(null);
  };

  return (
    <div className="equip-bar">
      {/* Skills Button */}
      <div
        className="equip-bar-item"
        onMouseEnter={() => handleMouseEnter('skills')}
        onMouseLeave={handleMouseLeave}
      >
        <button
          className={`equip-bar-button ${openPopover === 'skills' ? 'active' : ''}`}
          disabled={skills.length === 0}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
          </svg>
          <span>Skills</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9L12 15L18 9" />
          </svg>
        </button>

        {openPopover === 'skills' && (
          <div className="equip-bar-popover">
            {skills.length === 0 ? (
              <div className="equip-bar-empty">No skills available</div>
            ) : (
              <div className="equip-bar-list">
                {skills.map((skill) => (
                  <button
                    key={skill}
                    className="equip-bar-item-button"
                    onClick={() => handleItemClick('skills', skill)}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                    </svg>
                    <span>{skill}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Droids Button */}
      <div
        className="equip-bar-item"
        onMouseEnter={() => handleMouseEnter('droids')}
        onMouseLeave={handleMouseLeave}
      >
        <button
          className={`equip-bar-button ${openPopover === 'droids' ? 'active' : ''}`}
          disabled={droids.length === 0}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="4" y="8" width="16" height="12" rx="2" />
            <path d="M8 6V4M16 6V4M9 12H15M9 16H15" />
          </svg>
          <span>Droids</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9L12 15L18 9" />
          </svg>
        </button>

        {openPopover === 'droids' && (
          <div className="equip-bar-popover">
            {droids.length === 0 ? (
              <div className="equip-bar-empty">No droids available</div>
            ) : (
              <div className="equip-bar-list">
                {droids.map((droid) => (
                  <button
                    key={droid}
                    className="equip-bar-item-button"
                    onClick={() => handleItemClick('droids', droid)}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="4" y="8" width="16" height="12" rx="2" />
                      <path d="M8 6V4M16 6V4M9 12H15M9 16H15" />
                    </svg>
                    <span>{droid}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Commands Button */}
      <div
        className="equip-bar-item"
        onMouseEnter={() => handleMouseEnter('commands')}
        onMouseLeave={handleMouseLeave}
      >
        <button
          className={`equip-bar-button ${openPopover === 'commands' ? 'active' : ''}`}
          disabled={commands.length === 0}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 17L10 11L4 5M12 19H20" />
          </svg>
          <span>Commands</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9L12 15L18 9" />
          </svg>
        </button>

        {openPopover === 'commands' && (
          <div className="equip-bar-popover">
            {commands.length === 0 ? (
              <div className="equip-bar-empty">No commands available</div>
            ) : (
              <div className="equip-bar-list">
                {commands.map((command) => (
                  <button
                    key={command}
                    className="equip-bar-item-button"
                    onClick={() => handleItemClick('commands', command)}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 17L10 11L4 5M12 19H20" />
                    </svg>
                    <span>/{command}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
