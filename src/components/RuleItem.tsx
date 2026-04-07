import React from 'react';
import type { Rule } from '../types';

interface RuleItemProps {
  rule: Rule;
  onEdit: (rule: Rule) => void;
  onDelete: (rule: Rule) => void;
}

export function RuleItem({ rule, onEdit, onDelete }: RuleItemProps) {
  const hasGlobs = rule.frontmatter?.globs && rule.frontmatter.globs.length > 0;

  const handleDragStart = (e: React.DragEvent) => {
    const data = JSON.stringify({
      type: 'rule',
      name: rule.name,
      scope: rule.scope,
      path: rule.filePath,
    });
    e.dataTransfer.setData('application/quack-rule', data);
    e.dataTransfer.setData('text/plain', data);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div
      className="group flex items-start gap-3 p-3 rounded-lg hover:bg-white/5 transition-all duration-200 cursor-pointer"
      onClick={() => onEdit(rule)}
      title="Click to edit rule"
      draggable
      onDragStart={handleDragStart}
    >
      {/* Rule Icon - Blue gradient background with white icon (matches Quack Store) */}
      <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #60a5fa, #3b82f6)' }}>
        <svg className="w-4 h-4" viewBox="0 0 20 20" style={{ color: 'white' }}>
          <path d="M4 3h8l4 4v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2z" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M5 10l1.5 1.5L9 9M5 14l1.5 1.5L9 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* Rule Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm text-white/90">
            {rule.name}
          </span>
          {rule.frontmatter?.alwaysApply && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-green-500/20 text-green-400">
              Always
            </span>
          )}
          {hasGlobs && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-amber-500/20 text-amber-400">
              Path-scoped
            </span>
          )}
        </div>
        <p className="text-xs text-white/50 line-clamp-2">
          {rule.frontmatter?.description || 'No description'}
        </p>
        {hasGlobs && (
          <div className="flex flex-wrap gap-1 mt-2">
            {rule.frontmatter!.globs!.slice(0, 3).map((glob, i) => (
              <code key={i} className="px-1.5 py-0.5 text-[10px] rounded bg-white/5 text-white/60 font-mono">
                {glob}
              </code>
            ))}
            {rule.frontmatter!.globs!.length > 3 && (
              <span className="px-1.5 py-0.5 text-[10px] text-white/30">
                +{rule.frontmatter!.globs!.length - 3} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(rule);
          }}
          className="px-2 py-1 text-xs font-medium rounded-md bg-white/5 hover:bg-white/10 text-white/70 transition-colors duration-200"
          title="Edit rule"
        >
          Edit
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(rule);
          }}
          className="px-2 py-1 text-xs font-medium rounded-md bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors duration-200"
          title="Delete rule"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
