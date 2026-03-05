/**
 * BackgroundTasksDrawer Component
 *
 * Drawer wrapper for the Background Tasks panel.
 * Provides slide-in animation and overlay.
 *
 * @module BackgroundTasksDrawer
 */

import { useEffect } from 'react';
import BackgroundTasksPanel from './BackgroundTasksPanel';
import './BackgroundTasks.css';

interface BackgroundTasksDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function BackgroundTasksDrawer({
  open,
  onClose,
}: BackgroundTasksDrawerProps) {
  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <div className={`background-tasks-drawer ${open ? 'open' : ''}`}>
      {/* Backdrop */}
      <div
        className="background-tasks-drawer-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="background-tasks-drawer-panel">
        <BackgroundTasksPanel onClose={onClose} />
      </div>
    </div>
  );
}
