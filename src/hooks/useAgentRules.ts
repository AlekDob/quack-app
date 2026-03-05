/**
 * React Hook for Agent Rules
 *
 * Automatically loads and provides active rules for the current agent.
 * This hook is natively set by Quack - zero user configuration required.
 */

import { useState, useEffect, useMemo } from 'react';
import type { Rule, RulesResponse } from '../types';
import { useRules } from './useRules';
import { areRulePathsEqual, normalizeRulePath } from '../utils/rulePathUtils';

export interface AgentRuleInfo {
  name: string;
  description?: string;
  filePath: string;
  scope: 'project' | 'global';
  alwaysApply?: boolean;
  globs?: string[];
}

interface UseAgentRulesResult {
  /** Array of active rules with full metadata */
  activeRules: AgentRuleInfo[];
  /** Loading state */
  loading: boolean;
  /** Error message if rules failed to load */
  error: string | null;
  /** Total count of active rules */
  count: number;
  /** Whether any rules are active */
  hasRules: boolean;
  /** Refresh rules from filesystem */
  refresh: () => Promise<void>;
}

/**
 * Hook to load active rules for an agent
 *
 * @param selectedRules - Array of rule file paths from AgentPersonality.selectedRules
 * @param basePath - Project base path for loading rules
 * @returns Object with active rules, loading state, and metadata
 *
 * @example
 * ```tsx
 * const { activeRules, loading, hasRules } = useAgentRules(
 *   personality.selectedRules,
 *   terminalPath
 * );
 *
 * if (hasRules) {
 *   return <AgentRulesBanner rules={activeRules} />;
 * }
 * ```
 */
export function useAgentRules(
  selectedRules: string[] | undefined,
  basePath: string
): UseAgentRulesResult {
  const { rules, loading: rulesLoading, error: rulesError, loadRules } = useRules(basePath);
  const [error, setError] = useState<string | null>(null);

  // Combine all rules for lookup - store both original and normalized paths
  const allRulesMap = useMemo(() => {
    const map = new Map<string, { rule: Rule; scope: 'project' | 'global' }>();

    rules.project.forEach(rule => {
      // Store with both original path and normalized path for flexible lookup
      map.set(rule.filePath, { rule, scope: 'project' });
      const normalizedPath = normalizeRulePath(rule.filePath);
      if (normalizedPath !== rule.filePath) {
        map.set(normalizedPath, { rule, scope: 'project' });
      }
    });

    rules.global.forEach(rule => {
      map.set(rule.filePath, { rule, scope: 'global' });
      const normalizedPath = normalizeRulePath(rule.filePath);
      if (normalizedPath !== rule.filePath) {
        map.set(normalizedPath, { rule, scope: 'global' });
      }
    });

    return map;
  }, [rules]);

  // Filter and map selected rules to full metadata
  const activeRules = useMemo((): AgentRuleInfo[] => {
    if (!selectedRules || selectedRules.length === 0) {
      return [];
    }

    const result: AgentRuleInfo[] = [];
    const missing: string[] = [];

    for (const rulePath of selectedRules) {
      // Try to find by original path first, then by normalized path
      let found = allRulesMap.get(rulePath);
      if (!found) {
        const normalizedPath = normalizeRulePath(rulePath);
        found = allRulesMap.get(normalizedPath);
      }

      if (found) {
        result.push({
          name: found.rule.name,
          description: found.rule.frontmatter?.description,
          filePath: found.rule.filePath,
          scope: found.scope,
          alwaysApply: found.rule.frontmatter?.alwaysApply,
          globs: found.rule.frontmatter?.globs,
        });
      } else {
        missing.push(rulePath);
      }
    }

    // Log missing rules for debugging
    if (missing.length > 0 && !rulesLoading) {
      console.warn('[useAgentRules] Some selected rules not found:', missing);
      setError(`${missing.length} rule(s) not found`);
    } else {
      setError(null);
    }

    return result;
  }, [selectedRules, allRulesMap, rulesLoading]);

  // Refresh function
  const refresh = async () => {
    await loadRules();
  };

  return {
    activeRules,
    loading: rulesLoading,
    error: error || rulesError,
    count: activeRules.length,
    hasRules: activeRules.length > 0,
    refresh,
  };
}

/**
 * Get a summary string of active rules
 * Useful for displaying in compact UI elements
 */
export function getRulesSummary(rules: AgentRuleInfo[]): string {
  if (rules.length === 0) return 'No rules active';
  if (rules.length === 1) return rules[0].name;
  if (rules.length <= 3) return rules.map(r => r.name).join(', ');
  return `${rules.slice(0, 2).map(r => r.name).join(', ')} +${rules.length - 2} more`;
}
