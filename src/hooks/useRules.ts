import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { Rule, RuleScope, RulesResponse, RuleFrontmatter } from '../types';

/**
 * Parse YAML frontmatter from markdown content
 */
function parseFrontmatter(content: string): { frontmatter?: RuleFrontmatter; body: string } {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { body: content };
  }

  const yamlContent = match[1];
  const body = match[2];
  const frontmatter: RuleFrontmatter = {};

  // Parse description
  const descMatch = yamlContent.match(/description:\s*["']?([^"'\n]+)["']?/);
  if (descMatch) {
    frontmatter.description = descMatch[1].trim();
  }

  // Parse globs (array)
  const globsMatch = yamlContent.match(/globs:\s*\n((?:\s*-\s*.+\n?)+)/);
  if (globsMatch) {
    const globLines = globsMatch[1].match(/-\s*["']?([^"'\n]+)["']?/g);
    if (globLines) {
      frontmatter.globs = globLines.map(line => {
        const m = line.match(/-\s*["']?([^"'\n]+)["']?/);
        return m ? m[1].trim() : '';
      }).filter(Boolean);
    }
  }

  // Parse alwaysApply
  const alwaysMatch = yamlContent.match(/alwaysApply:\s*(true|false)/i);
  if (alwaysMatch) {
    frontmatter.alwaysApply = alwaysMatch[1].toLowerCase() === 'true';
  }

  return { frontmatter, body };
}

/**
 * Generate YAML frontmatter string
 */
function generateFrontmatter(params: {
  description?: string;
  globs?: string[];
  alwaysApply?: boolean;
}): string {
  const lines: string[] = ['---'];

  if (params.description) {
    lines.push(`description: "${params.description}"`);
  }

  if (params.globs && params.globs.length > 0) {
    lines.push('globs:');
    params.globs.forEach(glob => {
      lines.push(`  - "${glob}"`);
    });
  }

  if (params.alwaysApply !== undefined) {
    lines.push(`alwaysApply: ${params.alwaysApply}`);
  }

  lines.push('---\n');
  return lines.join('\n');
}

/**
 * Hook for managing Claude Code rules
 */
export function useRules(basePath: string) {
  const [rules, setRules] = useState<RulesResponse>({ project: [], global: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load rules from filesystem
  const loadRules = useCallback(async () => {
    if (!basePath) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await invoke<RulesResponse>('list_rules', { basePath });

      // Parse frontmatter for each rule
      const parseRules = (ruleList: Rule[]): Rule[] => {
        return ruleList.map(rule => {
          const { frontmatter } = parseFrontmatter(rule.content);
          return { ...rule, frontmatter };
        });
      };

      setRules({
        project: parseRules(result.project),
        global: parseRules(result.global)
      });
    } catch (err) {
      console.error('Failed to load rules:', err);
      setError(err instanceof Error ? err.message : 'Failed to load rules');
    } finally {
      setLoading(false);
    }
  }, [basePath]);

  // Create a new rule
  const createRule = useCallback(async (
    name: string,
    content: string,
    scope: RuleScope,
    description?: string,
    globs?: string[],
    alwaysApply?: boolean
  ): Promise<void> => {
    if (!basePath) throw new Error('No base path set');

    // Generate frontmatter if metadata provided
    let fullContent = content;
    if (description || (globs && globs.length > 0) || alwaysApply !== undefined) {
      const frontmatter = generateFrontmatter({ description, globs, alwaysApply });
      fullContent = frontmatter + content;
    }

    await invoke('create_rule', {
      basePath,
      name,
      content: fullContent,
      scope
    });

    await loadRules();
  }, [basePath, loadRules]);

  // Update existing rule
  const updateRule = useCallback(async (
    name: string,
    content: string,
    scope: RuleScope
  ): Promise<void> => {
    if (!basePath) throw new Error('No base path set');

    await invoke('update_rule', {
      basePath,
      name,
      content,
      scope
    });

    await loadRules();
  }, [basePath, loadRules]);

  // Delete rule
  const deleteRule = useCallback(async (
    name: string,
    scope: RuleScope
  ): Promise<void> => {
    if (!basePath) throw new Error('No base path set');

    await invoke('delete_rule', {
      basePath,
      name,
      scope
    });

    await loadRules();
  }, [basePath, loadRules]);

  // Search rules
  const searchRules = useCallback((query: string): Rule[] => {
    const lowerQuery = query.toLowerCase();
    const allRules = [...rules.project, ...rules.global];

    if (!query.trim()) {
      return allRules;
    }

    return allRules.filter(rule =>
      rule.name.toLowerCase().includes(lowerQuery) ||
      rule.frontmatter?.description?.toLowerCase().includes(lowerQuery)
    );
  }, [rules]);

  // Get rule by name
  const getRule = useCallback((name: string): Rule | undefined => {
    const allRules = [...rules.project, ...rules.global];
    return allRules.find(rule => rule.name === name);
  }, [rules]);

  // Load on mount and when basePath changes
  useEffect(() => {
    loadRules();
  }, [loadRules]);

  return {
    rules,
    loading,
    error,
    loadRules,
    createRule,
    updateRule,
    deleteRule,
    searchRules,
    getRule
  };
}
