import './FileStatusBadge.css';

export type FileStatus = 'created' | 'modified' | 'deleted';

interface FileStatusBadgeProps {
  status: FileStatus;
}

/**
 * FileStatusBadge - Visual indicator for file change type
 *
 * Shows a colored badge with label:
 * - NEW (green) for created files
 * - MOD (blue) for modified files
 * - DEL (red) for deleted files
 *
 * Inspired by Cursor's file change tracking UI
 */
export default function FileStatusBadge({ status }: FileStatusBadgeProps) {
  const config: Record<FileStatus, { label: string; className: string }> = {
    created: {
      label: 'NEW',
      className: 'file-status-badge-new'
    },
    modified: {
      label: 'MOD',
      className: 'file-status-badge-mod'
    },
    deleted: {
      label: 'DEL',
      className: 'file-status-badge-del'
    },
  };

  const { label, className } = config[status];

  return (
    <span className={`file-status-badge ${className}`}>
      {label}
    </span>
  );
}
