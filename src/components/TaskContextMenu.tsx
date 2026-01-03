import { useEffect, useRef } from 'react';
import type { KanbanTask } from '../types';

interface TaskContextMenuProps {
  position: { x: number; y: number };
  task: KanbanTask;
  onMarkDone: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function TaskContextMenu({
  position,
  task,
  onMarkDone,
  onDelete,
  onClose,
}: TaskContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      try {
        if (!menuRef.current) {
          return;
        }

        if (!document.body.contains(menuRef.current)) {
          return;
        }

        if (!event.target || !(event.target instanceof Node)) {
          return;
        }

        if (!menuRef.current.contains(event.target)) {
          onClose();
        }
      } catch (error) {
        console.warn('Error handling click outside:', error);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      try {
        if (event.key === 'Escape') {
          onClose();
        }
      } catch (error) {
        console.warn('Error handling escape:', error);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleMarkDone = () => {
    onMarkDone();
    onClose();
  };

  const handleDelete = () => {
    onDelete();
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      {task.status !== 'done' && (
        <>
          <button
            type="button"
            className="context-menu-item"
            onClick={handleMarkDone}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="3,8 6,11 13,4" />
            </svg>
            <span>Mark as Done</span>
          </button>
          <div className="context-menu-separator" />
        </>
      )}

      <button
        type="button"
        className="context-menu-item context-menu-item-danger"
        onClick={handleDelete}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path d="M6.5 1.75a.25.25 0 01.25-.25h2.5a.25.25 0 01.25.25V3h-3V1.75zm4.5 0V3h2.25a.75.75 0 010 1.5H2.75a.75.75 0 010-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75zM4.496 6.675a.75.75 0 10-1.492.15l.66 6.6A1.75 1.75 0 005.405 15h5.19c.9 0 1.652-.681 1.741-1.576l.66-6.6a.75.75 0 00-1.492-.149l-.66 6.6a.25.25 0 01-.249.225h-5.19a.25.25 0 01-.249-.225l-.66-6.6z" />
        </svg>
        <span>Delete Task</span>
      </button>
    </div>
  );
}
