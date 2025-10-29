import { useMemo } from 'react';
import { getIconForFile, getIconForFolder, getIconForOpenFolder } from 'vscode-icons-js';

interface FileIconProps {
  name: string;
  isDirectory: boolean;
  isOpen?: boolean;
  size?: number;
}

/**
 * FileIcon component - displays VSCode-style icons for files and folders
 * Uses vscode-icons-js library to get the correct icon based on file extension
 */
export default function FileIcon({ name, isDirectory, isOpen = false, size = 16 }: FileIconProps) {
  const iconName = useMemo(() => {
    if (isDirectory) {
      return isOpen ? getIconForOpenFolder(name) : getIconForFolder(name);
    }
    return getIconForFile(name);
  }, [name, isDirectory, isOpen]);

  // VSCode icons are available at: https://cdn.jsdelivr.net/gh/vscode-icons/vscode-icons/icons/
  const iconUrl = `https://cdn.jsdelivr.net/gh/vscode-icons/vscode-icons@latest/icons/${iconName}`;

  return (
    <img
      src={iconUrl}
      alt=""
      width={size}
      height={size}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        display: 'block',
        flexShrink: 0,
      }}
      aria-hidden="true"
    />
  );
}
