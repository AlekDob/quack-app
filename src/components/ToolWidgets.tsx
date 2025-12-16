import React, { useState } from 'react';
import DiffViewer from './DiffViewer';
import TodoWidget from './TodoWidget';
import PlanWidget from './PlanWidget';
import type { ToolDiff, DiffLine, TodoItem } from '../types';

// Helper function to convert old/new strings to ToolDiff
function createDiffFromStrings(oldString: string, newString: string, fileName?: string): ToolDiff {
  const oldLines = oldString.split('\n');
  const newLines = newString.split('\n');
  const lines: DiffLine[] = [];

  // Simple diff algorithm - mark all old lines as removed, all new lines as added
  oldLines.forEach((line) => {
    lines.push({ type: 'removed', content: line });
  });
  newLines.forEach((line) => {
    lines.push({ type: 'added', content: line });
  });

  return { fileName, lines };
}

// Get tool color based on tool type
export const getToolColor = (toolName: string): string => {
  const name = toolName.toLowerCase();
  if (name === 'webfetch' || name === 'websearch') return '#10b981'; // green
  // MCP Memory tools get vibrant rose color
  if (name.startsWith('mcp__memory') || name.startsWith('mcp_memory')) return '#E84A7F'; // vibrant rose
  if (name.startsWith('mcp__') || name.startsWith('mcp_')) return '#f97316'; // orange (other MCP tools)
  if (name === 'task') return '#8b5cf6'; // purple
  if (name === 'bash' || name === 'bashoutput' || name === 'killshell') return '#f59e0b'; // amber
  if (name === 'read' || name === 'glob' || name === 'grep') return '#3b82f6'; // blue
  if (name === 'edit' || name === 'write' || name === 'multiedit' || name === 'notebookedit') return '#ec4899'; // pink
  if (name === 'todowrite') return '#14b8a6'; // teal
  return '#6b7280'; // gray default
};

// Icons for different tools
export const ToolIcon: React.FC<{ name: string }> = ({ name }) => {
  const toolName = name.toLowerCase();

  // Determine color based on tool type
  const isWebTool = toolName === 'webfetch' || toolName === 'websearch';
  const isMcpMemoryTool = toolName.startsWith('mcp__memory') || toolName.startsWith('mcp_memory');
  const isMcpTool = toolName.startsWith('mcp__') || toolName.startsWith('mcp_');
  const iconColor = isWebTool ? '#10b981' : isMcpMemoryTool ? '#E84A7F' : isMcpTool ? '#f97316' : 'currentColor';

  if (toolName === 'read') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill={iconColor}>
        <path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8zM5 12.25v3.25a.25.25 0 00.4.2l1.45-1.087a.25.25 0 01.3 0L8.6 15.7a.25.25 0 00.4-.2v-3.25a.25.25 0 00-.25-.25h-3.5a.25.25 0 00-.25.25z"/>
      </svg>
    );
  }

  if (toolName === 'edit' || toolName === 'multiedit') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill={iconColor}>
        <path d="M11.013 1.427a1.75 1.75 0 012.474 0l1.086 1.086a1.75 1.75 0 010 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 01-.927-.928l.929-3.25a1.75 1.75 0 01.445-.758l8.61-8.61zm1.414 1.06a.25.25 0 00-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 000-.354l-1.086-1.086zM11.189 6.25L9.75 4.81l-6.286 6.287a.25.25 0 00-.064.108l-.558 1.953 1.953-.558a.249.249 0 00.108-.064l6.286-6.286z"/>
      </svg>
    );
  }

  if (toolName === 'bash') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill={iconColor}>
        <path d="M0 2.75C0 1.784.784 1 1.75 1h12.5c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0114.25 15H1.75A1.75 1.75 0 010 13.25V2.75zm1.75-.25a.25.25 0 00-.25.25v10.5c0 .138.112.25.25.25h12.5a.25.25 0 00.25-.25V2.75a.25.25 0 00-.25-.25H1.75zM7.25 8a.75.75 0 01-.22.53l-2.25 2.25a.75.75 0 01-1.06-1.06L5.44 8 3.72 6.28a.75.75 0 111.06-1.06l2.25 2.25c.141.14.22.331.22.53zm1.5 1.5a.75.75 0 000 1.5h3a.75.75 0 000-1.5h-3z"/>
      </svg>
    );
  }

  if (toolName === 'write') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill={iconColor}>
        <path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v12.5A1.75 1.75 0 0114.25 16H1.75A1.75 1.75 0 010 14.25V1.75zm1.75-.25a.25.25 0 00-.25.25v12.5c0 .138.112.25.25.25h12.5a.25.25 0 00.25-.25V1.75a.25.25 0 00-.25-.25H1.75zM3.5 3.75a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5a.75.75 0 01-.75-.75zm.75 2.25a.75.75 0 000 1.5h7.5a.75.75 0 000-1.5h-7.5zM3.5 9.75a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5a.75.75 0 01-.75-.75z"/>
      </svg>
    );
  }

  if (toolName === 'grep') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill={iconColor}>
        <path d="M10.68 11.74a6 6 0 01-7.922-8.982 6 6 0 1110.982 7.922 6.027 6.027 0 01-3.06.06zm.427 1.122a7.5 7.5 0 10-1.41 1.41l3.316 3.316a1 1 0 001.414-1.414l-3.32-3.312z"/>
      </svg>
    );
  }

  if (toolName === 'glob') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill={iconColor}>
        <path d="M1.75 1A1.75 1.75 0 000 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0016 13.25v-8.5A1.75 1.75 0 0014.25 3H7.5a.25.25 0 01-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75z"/>
      </svg>
    );
  }

  if (toolName === 'task') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill={iconColor}>
        <path d="M0 3.75C0 2.784.784 2 1.75 2h12.5c.966 0 1.75.784 1.75 1.75v8.5A1.75 1.75 0 0114.25 14H1.75A1.75 1.75 0 010 12.25v-8.5zm1.75-.25a.25.25 0 00-.25.25v8.5c0 .138.112.25.25.25h12.5a.25.25 0 00.25-.25v-8.5a.25.25 0 00-.25-.25H1.75zM3.5 6.25a.75.75 0 01.75-.75h7a.75.75 0 010 1.5h-7a.75.75 0 01-.75-.75zm.75 2.25a.75.75 0 000 1.5h4a.75.75 0 000-1.5h-4z"/>
      </svg>
    );
  }

  if (toolName === 'notebookedit') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill={iconColor}>
        <path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v12.5A1.75 1.75 0 0114.25 16H1.75A1.75 1.75 0 010 14.25V1.75zm1.75-.25a.25.25 0 00-.25.25v12.5c0 .138.112.25.25.25H9.5v-13H1.75zm12.5 13H11v-13h3.25a.25.25 0 01.25.25v12.5a.25.25 0 01-.25.25z"/>
      </svg>
    );
  }

  if (toolName === 'webfetch' || toolName === 'websearch') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={iconColor} strokeWidth="1.5">
        <circle cx="8" cy="8" r="6.5" />
        <path d="M8 1.5a6.5 6.5 0 0 1 0 13M8 1.5a6.5 6.5 0 0 0 0 13M1.5 8h13" strokeLinecap="round" />
        <path d="M3 5h10M3 11h10" strokeLinecap="round" opacity="0.5" />
      </svg>
    );
  }

  if (toolName === 'todowrite') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill={iconColor}>
        <path d="M2.5 1.75a.25.25 0 01.25-.25h8.5a.25.25 0 01.25.25v7.736a.75.75 0 101.5 0V1.75A1.75 1.75 0 0011.25 0h-8.5A1.75 1.75 0 001 1.75v11.5c0 .966.784 1.75 1.75 1.75h3.17a.75.75 0 000-1.5H2.75a.25.25 0 01-.25-.25V1.75zM4.75 4a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-4.5zM5 6.75A.75.75 0 014.75 6h-.5a.75.75 0 000 1.5h.5A.75.75 0 015 6.75zm-.75 3.75a.75.75 0 000 1.5h.5a.75.75 0 000-1.5h-.5zm8.53 2.72a.75.75 0 10-1.06-1.06l-2.97 2.97-1.22-1.22a.75.75 0 00-1.06 1.06l1.75 1.75a.75.75 0 001.06 0l3.5-3.5z"/>
      </svg>
    );
  }

  if (toolName === 'exitplanmode') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill={iconColor}>
        <path d="M2.75 1A1.75 1.75 0 001 2.75v10.5c0 .966.784 1.75 1.75 1.75h10.5A1.75 1.75 0 0015 13.25V2.75A1.75 1.75 0 0013.25 1H2.75zM2.5 2.75a.25.25 0 01.25-.25h10.5a.25.25 0 01.25.25v10.5a.25.25 0 01-.25.25H2.75a.25.25 0 01-.25-.25V2.75zm3.28 5.53l2.5 2.5a.75.75 0 001.06 0l2.5-2.5a.75.75 0 10-1.06-1.06L9.75 8.25V4.5a.75.75 0 00-1.5 0v3.75L7.22 7.22a.75.75 0 00-1.06 1.06z"/>
      </svg>
    );
  }

  if (toolName === 'bashoutput') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill={iconColor}>
        <path d="M0 2.75C0 1.784.784 1 1.75 1h12.5c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0114.25 15H1.75A1.75 1.75 0 010 13.25V2.75zm1.75-.25a.25.25 0 00-.25.25v10.5c0 .138.112.25.25.25h12.5a.25.25 0 00.25-.25V2.75a.25.25 0 00-.25-.25H1.75zM7.25 8a.75.75 0 01-.22.53l-2.25 2.25a.75.75 0 01-1.06-1.06L5.44 8 3.72 6.28a.75.75 0 111.06-1.06l2.25 2.25c.141.14.22.331.22.53zm1.5 1.5a.75.75 0 000 1.5h3a.75.75 0 000-1.5h-3z"/>
      </svg>
    );
  }

  if (toolName === 'killshell') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill={iconColor}>
        <path d="M4.47.22A.75.75 0 015 0h6a.75.75 0 01.53.22l4.25 4.25c.141.14.22.331.22.53v6a.75.75 0 01-.22.53l-4.25 4.25A.75.75 0 0111 16H5a.75.75 0 01-.53-.22L.22 11.53A.75.75 0 010 11V5a.75.75 0 01.22-.53L4.47.22zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5H5.31zM8 4a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 018 4zm0 8a1 1 0 100-2 1 1 0 000 2z"/>
      </svg>
    );
  }

  if (toolName === 'slashcommand') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill={iconColor}>
        <path d="M9.504.43a1.516 1.516 0 012.437 1.713L5.683 15.502a1.516 1.516 0 01-2.437-1.713L9.504.43z"/>
      </svg>
    );
  }

  if (toolName.includes('listmcpresourcestool') || toolName.includes('readmcpresourcetool')) {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill={iconColor}>
        <path d="M1.75 1A1.75 1.75 0 000 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0016 13.25v-10.5A1.75 1.75 0 0014.25 1H1.75zM1.5 2.75a.25.25 0 01.25-.25h12.5a.25.25 0 01.25.25v10.5a.25.25 0 01-.25.25H1.75a.25.25 0 01-.25-.25V2.75zM3.5 5a.75.75 0 000 1.5h9a.75.75 0 000-1.5h-9zm0 3a.75.75 0 000 1.5h5a.75.75 0 000-1.5h-5z"/>
      </svg>
    );
  }

  // MCP Memory tools - brain icon
  if (isMcpMemoryTool) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/>
        <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/>
        <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>
        <path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/>
        <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/>
        <path d="M3.477 10.896a4 4 0 0 1 .585-.396"/>
        <path d="M19.938 10.5a4 4 0 0 1 .585.396"/>
        <path d="M6 18a4 4 0 0 1-1.967-.516"/>
        <path d="M19.967 17.484A4 4 0 0 1 18 18"/>
      </svg>
    );
  }

  // MCP tools - generic icon for MCP operations
  if (isMcpTool) {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={iconColor} strokeWidth="1.5">
        <circle cx="8" cy="8" r="6.5" />
        <path d="M8 5v6M5 8h6" strokeLinecap="round" />
      </svg>
    );
  }

  // Default terminal icon
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill={iconColor}>
      <path d="M0 2.75C0 1.784.784 1 1.75 1h12.5c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0114.25 15H1.75A1.75 1.75 0 010 13.25V2.75zm1.75-.25a.25.25 0 00-.25.25v10.5c0 .138.112.25.25.25h12.5a.25.25 0 00.25-.25V2.75a.25.25 0 00-.25-.25H1.75z"/>
    </svg>
  );
};

// SystemInitialized widget
export const SystemInitializedWidget: React.FC<{
  sessionId?: string;
  model?: string;
  cwd?: string;
  tools?: string[];
  defaultExpanded?: boolean;
}> = ({ sessionId, model, cwd, tools, defaultExpanded = true }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="system-init-widget">
      <div className="system-init-header" onClick={() => setIsExpanded(!isExpanded)}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="system-icon">
          <path d="M8 0a8 8 0 110 16A8 8 0 018 0zM1.5 8a6.5 6.5 0 1113 0 6.5 6.5 0 01-13 0z"/>
          <path d="M8 3.5a.5.5 0 01.5.5v4a.5.5 0 01-1 0V4a.5.5 0 01.5-.5z"/>
        </svg>
        <span className="system-init-title">System Initialized</span>
        <svg
          className={`tool-widget-chevron ${isExpanded ? 'expanded' : ''}`}
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path d="M12.78 6.22a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06 0L3.22 7.28a.75.75 0 011.06-1.06L8 9.94l3.72-3.72a.75.75 0 011.06 0z"/>
        </svg>
      </div>
      {isExpanded && (<div className="system-init-content">
        {sessionId && (
          <div className="system-init-row">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0a8 8 0 110 16A8 8 0 018 0z"/>
            </svg>
            <span className="system-init-label">Session ID:</span>
            <code className="system-init-value">{sessionId}</code>
          </div>
        )}
        {model && (
          <div className="system-init-row">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M0 2.75C0 1.784.784 1 1.75 1h12.5c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0114.25 15H1.75A1.75 1.75 0 010 13.25V2.75z"/>
            </svg>
            <span className="system-init-label">Model:</span>
            <code className="system-init-value">{model}</code>
          </div>
        )}
        {cwd && (
          <div className="system-init-row">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M1.75 1A1.75 1.75 0 000 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0016 13.25v-8.5A1.75 1.75 0 0014.25 3h-6.5a.25.25 0 01-.2-.1l-.9-1.2c-.3-.4-.77-.63-1.25-.63h-3.4z"/>
            </svg>
            <span className="system-init-label">Working Directory:</span>
            <code className="system-init-value">{cwd}</code>
          </div>
        )}
        {tools && tools.length > 0 && (
          <div className="system-init-row">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M5.433 2.304A4.494 4.494 0 003.5 6c0 1.598.832 3.002 2.09 3.802.518.328.929.923.902 1.64v.008l-.164 3.337a.75.75 0 11-1.498-.073l.163-3.33c.002-.085-.05-.216-.207-.316A5.996 5.996 0 012 6a5.994 5.994 0 012.567-4.92 1.48 1.48 0 01.524-.3c.446-.113.848.026 1.1.306.407.453.462 1.128.29 1.595a4.96 4.96 0 01-1.048 1.623zm7.134 0A4.494 4.494 0 0114.5 6c0 1.598-.832 3.002-2.09 3.802-.518.328-.929.923-.902 1.64v.008l.164 3.337a.75.75 0 101.498-.073l-.163-3.33c-.002-.085.05-.216.207-.316A5.996 5.996 0 0014 6a5.994 5.994 0 00-2.567-4.92 1.48 1.48 0 00-.524-.3c-.446-.113-.848.026-1.1.306-.407.453-.462 1.128-.29 1.595a4.96 4.96 0 001.048 1.623z"/>
            </svg>
            <span className="system-init-label">Available Tools ({tools.length})</span>
          </div>
        )}
        {tools && tools.length > 0 && (
          <div className="system-init-tools">
            {tools.map((tool, i) => {
              const toolNameLower = tool.toLowerCase();
              const isWebTool = toolNameLower === 'webfetch' || toolNameLower === 'websearch';
              const isMcpMemoryTool = toolNameLower.startsWith('mcp__memory') || toolNameLower.startsWith('mcp_memory');
              const isMcpTool = toolNameLower.startsWith('mcp__') || toolNameLower.startsWith('mcp_');
              const textColor = isWebTool ? '#10b981' : isMcpMemoryTool ? '#E84A7F' : isMcpTool ? '#f97316' : undefined;

              return (
                <span key={i} className="system-init-tool-badge" style={{ color: textColor }}>
                  <ToolIcon name={tool} />
                  {tool}
                </span>
              );
            })}
          </div>
        )}
      </div>
      )}
    </div>
  );
};

// Edit widget
export const EditWidget: React.FC<{
  file_path: string;
  old_string: string;
  new_string: string;
  result?: any;
  onFilePathClick?: (path: string) => void;
}> = ({ file_path, old_string, new_string, result, onFilePathClick }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="tool-widget edit-widget">
      <div className="tool-widget-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="tool-widget-title">
          <ToolIcon name="edit" />
          <span>Edit</span>
          {result && !result.is_error && (
            <svg className="tool-widget-status-success" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
            </svg>
          )}
          {result?.is_error && (
            <svg className="tool-widget-status-error" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/>
            </svg>
          )}
          {!result && (
            <div className="tool-widget-loading">
              <div className="spinner"></div>
            </div>
          )}
        </div>
        <button
          className="tool-widget-file-link"
          onClick={(e) => {
            e.stopPropagation();
            if (onFilePathClick) {
              onFilePathClick(file_path);
            }
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9z"/>
          </svg>
          {file_path.split('/').pop() || file_path}
        </button>
        <svg
          className={`tool-widget-chevron ${isExpanded ? 'expanded' : ''}`}
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path d="M12.78 6.22a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06 0L3.22 7.28a.75.75 0 011.06-1.06L8 9.94l3.72-3.72a.75.75 0 011.06 0z"/>
        </svg>
      </div>
      {isExpanded && (
        <div className="tool-widget-content">
          <DiffViewer diff={createDiffFromStrings(old_string, new_string, file_path)} />
          {result?.is_error && result.content && (
            <div className="tool-widget-error">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4.47.22A.75.75 0 015 0h6a.75.75 0 01.53.22l4.25 4.25c.141.14.22.331.22.53v6a.75.75 0 01-.22.53l-4.25 4.25A.75.75 0 0111 16H5a.75.75 0 01-.53-.22L.22 11.53A.75.75 0 010 11V5a.75.75 0 01.22-.53L4.47.22z"/>
              </svg>
              {result.content}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Write widget
export const WriteWidget: React.FC<{
  filePath: string;
  content: string;
  result?: any;
  onFilePathClick?: (path: string) => void;
}> = ({ filePath, content, result, onFilePathClick }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Count lines
  const lineCount = content.split('\n').length;

  return (
    <div className="tool-widget write-widget">
      <div className="tool-widget-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="tool-widget-title">
          <ToolIcon name="write" />
          <span>Write</span>
          <span className="tool-widget-meta">({lineCount} lines)</span>
          {result && !result.is_error && (
            <svg className="tool-widget-status-success" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
            </svg>
          )}
          {result?.is_error && (
            <svg className="tool-widget-status-error" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/>
            </svg>
          )}
          {!result && (
            <div className="tool-widget-loading">
              <div className="spinner"></div>
            </div>
          )}
        </div>
        <button
          className="tool-widget-file-link"
          onClick={(e) => {
            e.stopPropagation();
            if (onFilePathClick) {
              onFilePathClick(filePath);
            }
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9z"/>
          </svg>
          {filePath.split('/').pop() || filePath}
        </button>
        <svg
          className={`tool-widget-chevron ${isExpanded ? 'expanded' : ''}`}
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path d="M12.78 6.22a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06 0L3.22 7.28a.75.75 0 011.06-1.06L8 9.94l3.72-3.72a.75.75 0 011.06 0z"/>
        </svg>
      </div>
      {isExpanded && (
        <div className="tool-widget-content">
          <pre className="tool-widget-code">{content}</pre>
          {result?.is_error && result.content && (
            <div className="tool-widget-error">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4.47.22A.75.75 0 015 0h6a.75.75 0 01.53.22l4.25 4.25c.141.14.22.331.22.53v6a.75.75 0 01-.22.53l-4.25 4.25A.75.75 0 0111 16H5a.75.75 0 01-.53-.22L.22 11.53A.75.75 0 010 11V5a.75.75 0 01.22-.53L4.47.22z"/>
              </svg>
              {result.content}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Bash widget
export const BashWidget: React.FC<{
  command: string;
  description?: string;
  result?: any;
}> = ({ command, description, result }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="tool-widget bash-widget">
      <div className="tool-widget-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="tool-widget-title">
          <ToolIcon name="bash" />
          <span>Bash</span>
          {description && <span className="tool-widget-meta">{description}</span>}
          {result && !result.is_error && (
            <svg className="tool-widget-status-success" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
            </svg>
          )}
          {result?.is_error && (
            <svg className="tool-widget-status-error" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/>
            </svg>
          )}
          {!result && (
            <div className="tool-widget-loading">
              <div className="spinner"></div>
            </div>
          )}
        </div>
        <code className="tool-widget-command">{command}</code>
        <svg
          className={`tool-widget-chevron ${isExpanded ? 'expanded' : ''}`}
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path d="M12.78 6.22a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06 0L3.22 7.28a.75.75 0 011.06-1.06L8 9.94l3.72-3.72a.75.75 0 011.06 0z"/>
        </svg>
      </div>
      {isExpanded && result && (
        <div className="tool-widget-content">
          {result.content && (
            <pre className="tool-widget-output">{result.content}</pre>
          )}
          {result.is_error && result.content && (
            <div className="tool-widget-error">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4.47.22A.75.75 0 015 0h6a.75.75 0 01.53.22l4.25 4.25c.141.14.22.331.22.53v6a.75.75 0 01-.22.53l-4.25 4.25A.75.75 0 0111 16H5a.75.75 0 01-.53-.22L.22 11.53A.75.75 0 010 11V5a.75.75 0 01.22-.53L4.47.22z"/>
              </svg>
              {result.content}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Read widget
export const ReadWidget: React.FC<{
  filePath: string;
  result?: any;
  onFilePathClick?: (path: string) => void;
}> = ({ filePath, result, onFilePathClick }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="tool-widget read-widget">
      <div className="tool-widget-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="tool-widget-title">
          <ToolIcon name="read" />
          <span>Read</span>
          {result && !result.is_error && (
            <svg className="tool-widget-status-success" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
            </svg>
          )}
          {result?.is_error && (
            <svg className="tool-widget-status-error" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/>
            </svg>
          )}
          {!result && (
            <div className="tool-widget-loading">
              <div className="spinner"></div>
            </div>
          )}
        </div>
        <button
          className="tool-widget-file-link"
          onClick={(e) => {
            e.stopPropagation();
            if (onFilePathClick) {
              onFilePathClick(filePath);
            }
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9z"/>
          </svg>
          {filePath.split('/').pop() || filePath}
        </button>
        <svg
          className={`tool-widget-chevron ${isExpanded ? 'expanded' : ''}`}
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path d="M12.78 6.22a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06 0L3.22 7.28a.75.75 0 011.06-1.06L8 9.94l3.72-3.72a.75.75 0 011.06 0z"/>
        </svg>
      </div>
      {isExpanded && result && result.content && (
        <div className="tool-widget-content">
          <pre className="tool-widget-output">{result.content}</pre>
        </div>
      )}
    </div>
  );
};

// Grep widget
export const GrepWidget: React.FC<{
  pattern: string;
  path?: string;
  result?: any;
}> = ({ pattern, path, result }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Count matches if result exists
  const matchCount = result?.content ? result.content.split('\n').filter((line: string) => line.trim()).length : 0;

  return (
    <div className="tool-widget grep-widget">
      <div className="tool-widget-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="tool-widget-title">
          <ToolIcon name="grep" />
          <span>Grep</span>
          <code className="tool-widget-pattern">{pattern}</code>
          {result && matchCount > 0 && (
            <span className="tool-widget-meta">({matchCount} matches)</span>
          )}
          {result && !result.is_error && (
            <svg className="tool-widget-status-success" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
            </svg>
          )}
          {result?.is_error && (
            <svg className="tool-widget-status-error" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/>
            </svg>
          )}
          {!result && (
            <div className="tool-widget-loading">
              <div className="spinner"></div>
            </div>
          )}
        </div>
        {path && <span className="tool-widget-path">{path}</span>}
        <svg
          className={`tool-widget-chevron ${isExpanded ? 'expanded' : ''}`}
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path d="M12.78 6.22a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06 0L3.22 7.28a.75.75 0 011.06-1.06L8 9.94l3.72-3.72a.75.75 0 011.06 0z"/>
        </svg>
      </div>
      {isExpanded && result && result.content && (
        <div className="tool-widget-content">
          <pre className="tool-widget-output">{result.content}</pre>
        </div>
      )}
    </div>
  );
};

// TodoWrite widget
export const TodoWriteWidget: React.FC<{
  todos: TodoItem[];
  defaultExpanded?: boolean;
}> = ({ todos, defaultExpanded = true }) => {
  return <TodoWidget todos={todos} defaultExpanded={defaultExpanded} />;
};

// ExitPlanMode widget
export const ExitPlanModeWidget: React.FC<{
  plan: string;
  defaultExpanded?: boolean;
  workingDirectory?: string;
}> = ({ plan, defaultExpanded = true, workingDirectory }) => {
  return <PlanWidget plan={plan} defaultExpanded={defaultExpanded} workingDirectory={workingDirectory} />;
};
