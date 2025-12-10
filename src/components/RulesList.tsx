import { useState } from 'react';
import type { Rule } from '../types';
import { RuleItem } from './RuleItem';

interface RulesListProps {
  projectRules: Rule[];
  globalRules: Rule[];
  onEditRule: (rule: Rule) => void;
  onDeleteRule: (rule: Rule) => void;
}

export function RulesList({
  projectRules,
  globalRules,
  onEditRule,
  onDeleteRule
}: RulesListProps) {
  const [projectExpanded, setProjectExpanded] = useState(true);
  const [globalExpanded, setGlobalExpanded] = useState(true);

  return (
    <div className="flex flex-col gap-4">
      {/* Project Rules Section */}
      {projectRules.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setProjectExpanded(!projectExpanded)}
            className="w-full px-3 py-2 flex items-center gap-2 text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            <span className={`transition-transform ${projectExpanded ? 'rotate-90' : ''}`}>
              <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
                <path d="M2 1l4 3-4 3V1z" />
              </svg>
            </span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <span>Project Rules</span>
            <span className="ml-auto text-xs text-white/40">{projectRules.length}</span>
          </button>
          {projectExpanded && (
            <div className="mt-2 space-y-1">
              {projectRules.map((rule) => (
                <RuleItem
                  key={rule.id}
                  rule={rule}
                  onEdit={onEditRule}
                  onDelete={onDeleteRule}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Global Rules Section */}
      {globalRules.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setGlobalExpanded(!globalExpanded)}
            className="w-full px-3 py-2 flex items-center gap-2 text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            <span className={`transition-transform ${globalExpanded ? 'rotate-90' : ''}`}>
              <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
                <path d="M2 1l4 3-4 3V1z" />
              </svg>
            </span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <circle cx="12" cy="12" r="10" strokeWidth={2} />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 12h20" />
            </svg>
            <span>Global Rules</span>
            <span className="ml-auto text-xs text-white/40">{globalRules.length}</span>
          </button>
          {globalExpanded && (
            <div className="mt-2 space-y-1">
              {globalRules.map((rule) => (
                <RuleItem
                  key={rule.id}
                  rule={rule}
                  onEdit={onEditRule}
                  onDelete={onDeleteRule}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
