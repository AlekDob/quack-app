import { useState } from 'react';
import { useRules } from '../hooks/useRules';
import type { Rule } from '../types';
import { RulesList } from './RulesList';

interface RulesPanelProps {
  basePath: string;
  onSelectRule?: (ruleName: string, ruleScope: 'global' | 'project', isNew?: boolean, filePath?: string) => void;
}

export function RulesPanel({ basePath, onSelectRule }: RulesPanelProps) {
  const {
    rules,
    loading,
    error,
    deleteRule,
    loadRules
  } = useRules(basePath);

  const [searchQuery, setSearchQuery] = useState('');

  // Filter rules based on search
  const filterRules = (ruleList: Rule[]) => {
    if (!searchQuery.trim()) return ruleList;
    const query = searchQuery.toLowerCase();
    return ruleList.filter(rule =>
      rule.name.toLowerCase().includes(query) ||
      rule.frontmatter?.description?.toLowerCase().includes(query)
    );
  };

  const filteredProject = filterRules(rules.project);
  const filteredGlobal = filterRules(rules.global);

  const handleNewRule = () => {
    // Open new rule tab with default scope 'project'
    if (onSelectRule) {
      onSelectRule('', 'project', true);
    }
  };

  const handleEditRule = (rule: Rule) => {
    // Open rule in tab for editing (pass filePath for IDE opening)
    if (onSelectRule) {
      onSelectRule(rule.name, rule.scope as 'global' | 'project', false, rule.filePath);
    }
  };

  const handleDeleteRule = async (rule: Rule) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete the rule "${rule.name}"?`
    );
    if (!confirmed) return;

    try {
      await deleteRule(rule.name, rule.scope);
    } catch (err) {
      console.error('Failed to delete rule:', err);
      alert('Failed to delete rule. Please try again.');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-white/10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Rules</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={loadRules}
              className="p-1.5 text-white/50 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              title="Refresh"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              onClick={handleNewRule}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors duration-200"
            >
              + New Rule
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search rules..."
            className="w-full px-3 py-2 pl-8 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50"
          />
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-sm text-white/30">Loading rules...</div>
          </div>
        ) : error ? (
          <div className="px-3 py-6 text-center">
            <p className="text-xs text-red-400">{error}</p>
            <button
              onClick={loadRules}
              className="mt-3 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 text-white/70 transition-colors duration-200"
            >
              Retry
            </button>
          </div>
        ) : filteredProject.length === 0 && filteredGlobal.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <p className="text-sm text-white/50 mb-2">No rules found</p>
            <p className="text-xs text-white/30 mb-4">
              Rules are stored in .claude/rules/ and define how Claude behaves for specific files.
            </p>
            <button
              onClick={handleNewRule}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 transition-colors duration-200"
            >
              Create your first rule
            </button>
          </div>
        ) : (
          <RulesList
            projectRules={filteredProject}
            globalRules={filteredGlobal}
            onEditRule={handleEditRule}
            onDeleteRule={handleDeleteRule}
          />
        )}
      </div>
    </div>
  );
}
