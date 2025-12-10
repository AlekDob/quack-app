import { describe, it, expect } from 'vitest';
import type { Rule, RuleScope, RuleFrontmatter, RulesResponse } from '../types';

/**
 * Tests for Rules feature
 * Testing types, frontmatter parsing logic, and rule management
 */

// Helper function to parse YAML frontmatter (mirrors useRules.ts logic)
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

// Helper function to generate frontmatter
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

describe('Rules Types', () => {
  it('should create a valid Rule object', () => {
    const rule: Rule = {
      id: 'project:typescript-style',
      name: 'typescript-style',
      content: '# TypeScript Style Guide\n\nUse strict mode.',
      filePath: '/project/.claude/rules/typescript-style.md',
      scope: 'project',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    expect(rule.id).toBe('project:typescript-style');
    expect(rule.name).toBe('typescript-style');
    expect(rule.scope).toBe('project');
  });

  it('should support global scope', () => {
    const rule: Rule = {
      id: 'global:my-rules',
      name: 'my-rules',
      content: '# My Global Rules',
      filePath: '~/.claude/rules/my-rules.md',
      scope: 'global',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    expect(rule.scope).toBe('global');
  });

  it('should support frontmatter metadata', () => {
    const frontmatter: RuleFrontmatter = {
      description: 'TypeScript coding standards',
      globs: ['src/**/*.ts', 'src/**/*.tsx'],
      alwaysApply: false,
    };

    const rule: Rule = {
      id: 'project:ts-rules',
      name: 'ts-rules',
      content: '# Rules',
      filePath: '/test',
      scope: 'project',
      frontmatter,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    expect(rule.frontmatter?.description).toBe('TypeScript coding standards');
    expect(rule.frontmatter?.globs).toHaveLength(2);
    expect(rule.frontmatter?.alwaysApply).toBe(false);
  });
});

describe('Rules Response', () => {
  it('should group rules by scope', () => {
    const response: RulesResponse = {
      project: [
        {
          id: 'project:a',
          name: 'a',
          content: '',
          filePath: '',
          scope: 'project',
          createdAt: 0,
          updatedAt: 0,
        },
      ],
      global: [
        {
          id: 'global:b',
          name: 'b',
          content: '',
          filePath: '',
          scope: 'global',
          createdAt: 0,
          updatedAt: 0,
        },
      ],
    };

    expect(response.project).toHaveLength(1);
    expect(response.global).toHaveLength(1);
  });
});

describe('Frontmatter Parsing', () => {
  it('should parse description from frontmatter', () => {
    const content = `---
description: "My test description"
---

# Rule Content`;

    const { frontmatter, body } = parseFrontmatter(content);

    expect(frontmatter?.description).toBe('My test description');
    expect(body.trim()).toBe('# Rule Content');
  });

  it('should parse globs array from frontmatter', () => {
    const content = `---
globs:
  - "src/**/*.ts"
  - "lib/**/*.js"
---

Content here`;

    const { frontmatter } = parseFrontmatter(content);

    expect(frontmatter?.globs).toHaveLength(2);
    expect(frontmatter?.globs?.[0]).toBe('src/**/*.ts');
    expect(frontmatter?.globs?.[1]).toBe('lib/**/*.js');
  });

  it('should parse alwaysApply boolean', () => {
    const content = `---
alwaysApply: true
---

Content`;

    const { frontmatter } = parseFrontmatter(content);

    expect(frontmatter?.alwaysApply).toBe(true);
  });

  it('should handle content without frontmatter', () => {
    const content = '# Just a header\n\nSome content';

    const { frontmatter, body } = parseFrontmatter(content);

    expect(frontmatter).toBeUndefined();
    expect(body).toBe(content);
  });

  it('should handle all frontmatter fields together', () => {
    const content = `---
description: "Complete rule"
globs:
  - "**/*.md"
alwaysApply: false
---

# Complete Rule
This is the body.`;

    const { frontmatter, body } = parseFrontmatter(content);

    expect(frontmatter?.description).toBe('Complete rule');
    expect(frontmatter?.globs).toEqual(['**/*.md']);
    expect(frontmatter?.alwaysApply).toBe(false);
    expect(body).toContain('# Complete Rule');
  });
});

describe('Frontmatter Generation', () => {
  it('should generate frontmatter with description', () => {
    const result = generateFrontmatter({ description: 'Test desc' });

    expect(result).toContain('description: "Test desc"');
    expect(result.startsWith('---')).toBe(true);
    expect(result.endsWith('---\n')).toBe(true);
  });

  it('should generate frontmatter with globs array', () => {
    const result = generateFrontmatter({
      globs: ['src/**/*.ts', 'lib/**/*.js'],
    });

    expect(result).toContain('globs:');
    expect(result).toContain('- "src/**/*.ts"');
    expect(result).toContain('- "lib/**/*.js"');
  });

  it('should generate frontmatter with alwaysApply', () => {
    const result = generateFrontmatter({ alwaysApply: true });

    expect(result).toContain('alwaysApply: true');
  });

  it('should generate complete frontmatter', () => {
    const result = generateFrontmatter({
      description: 'Full example',
      globs: ['**/*.md'],
      alwaysApply: false,
    });

    expect(result).toContain('description: "Full example"');
    expect(result).toContain('globs:');
    expect(result).toContain('- "**/*.md"');
    expect(result).toContain('alwaysApply: false');
  });
});

describe('Rule Name Validation', () => {
  it('should allow valid rule names', () => {
    const validNames = [
      'typescript-rules',
      'my_rules',
      'Rules123',
      'test',
      'a-b-c',
      'ABC_xyz',
    ];

    const pattern = /^[a-zA-Z0-9_-]+$/;

    validNames.forEach(name => {
      expect(pattern.test(name)).toBe(true);
    });
  });

  it('should reject invalid rule names', () => {
    const invalidNames = [
      'has spaces',
      'special!char',
      'path/slash',
      'dot.name',
      '',
    ];

    const pattern = /^[a-zA-Z0-9_-]+$/;

    invalidNames.forEach(name => {
      expect(pattern.test(name)).toBe(false);
    });
  });
});

describe('Rule Scope', () => {
  it('should support project scope', () => {
    const scope: RuleScope = 'project';
    expect(scope).toBe('project');
  });

  it('should support global scope', () => {
    const scope: RuleScope = 'global';
    expect(scope).toBe('global');
  });
});

describe('Rules Search/Filter', () => {
  const testRules: Rule[] = [
    {
      id: 'project:typescript',
      name: 'typescript',
      content: '',
      filePath: '',
      scope: 'project',
      frontmatter: { description: 'TypeScript coding standards' },
      createdAt: 0,
      updatedAt: 0,
    },
    {
      id: 'project:react',
      name: 'react',
      content: '',
      filePath: '',
      scope: 'project',
      frontmatter: { description: 'React best practices' },
      createdAt: 0,
      updatedAt: 0,
    },
    {
      id: 'global:security',
      name: 'security',
      content: '',
      filePath: '',
      scope: 'global',
      frontmatter: { description: 'Security guidelines' },
      createdAt: 0,
      updatedAt: 0,
    },
  ];

  it('should filter rules by name', () => {
    const query = 'type';
    const filtered = testRules.filter(rule =>
      rule.name.toLowerCase().includes(query.toLowerCase())
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('typescript');
  });

  it('should filter rules by description', () => {
    const query = 'best practices';
    const filtered = testRules.filter(rule =>
      rule.frontmatter?.description?.toLowerCase().includes(query.toLowerCase())
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('react');
  });

  it('should filter rules by scope', () => {
    const projectRules = testRules.filter(r => r.scope === 'project');
    const globalRules = testRules.filter(r => r.scope === 'global');

    expect(projectRules).toHaveLength(2);
    expect(globalRules).toHaveLength(1);
  });
});
