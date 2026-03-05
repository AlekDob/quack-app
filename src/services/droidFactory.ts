import type { DroidSpec } from '../components/droid-factory/types';

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const VALID_TOOLS = [
  'Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob',
  'WebFetch', 'WebSearch', 'Task'
];

const VALID_MODELS = ['sonnet', 'opus', 'haiku', 'inherit'];

export function validateDroidSpec(spec: DroidSpec): ValidationResult {
  const errors: string[] = [];

  // Name validation
  if (!spec.name || !/^[a-z0-9-]+$/.test(spec.name)) {
    errors.push('Name must be lowercase with hyphens only');
  }

  // Display name validation
  if (!spec.displayName?.trim()) {
    errors.push('Display name is required');
  }

  // Description validation
  if (!spec.description?.trim()) {
    errors.push('Description is required');
  }

  // Tools validation
  if (!spec.tools || spec.tools.length === 0) {
    errors.push('At least one tool is required');
  } else {
    spec.tools.forEach(tool => {
      if (!VALID_TOOLS.includes(tool)) {
        errors.push(`Invalid tool: ${tool}`);
      }
    });
  }

  // Model validation
  if (!VALID_MODELS.includes(spec.model)) {
    errors.push('Invalid model specified');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function generateDroidFile(spec: DroidSpec): string {
  const toolsList = spec.tools.join(', ');

  const frontmatter = `---
name: ${spec.name}
description: "${spec.description}"
tools: ${toolsList}
model: ${spec.model}
---`;

  const systemPrompt = generateSystemPrompt(spec);

  return `${frontmatter}\n\n${systemPrompt}`;
}

function generateSystemPrompt(spec: DroidSpec): string {
  const personalityTraits = {
    professional: 'formal, precise, and detail-oriented',
    friendly: 'casual, approachable, and uses emoji to engage',
    efficient: 'concise, action-focused, with minimal talk',
    creative: 'innovative, thinks outside the box, explores alternatives',
    mentor: 'educational, explains reasoning, teaches while doing',
  };

  return `You are **${spec.displayName}**, a specialized AI agent designed for ${spec.specialization}.

## 🎯 Your Mission

${spec.description}

## 🎨 Personality

You are **${personalityTraits[spec.personality]}**. This shapes how you communicate and approach tasks.

## 🔧 Core Responsibilities

Your primary focus is on ${spec.specialization}. You excel at:
- Analyzing and understanding the task at hand
- Providing clear, actionable solutions
- Maintaining high quality standards
- Communicating effectively with users

## ✅ Best Practices

When working on tasks:
1. **Understand first**: Ask clarifying questions if requirements are unclear
2. **Plan before acting**: Think through the approach before executing
3. **Communicate clearly**: Explain what you're doing and why
4. **Validate results**: Ensure output meets requirements
5. **Provide context**: Help users understand your decisions

## 🚫 Limitations

- Only use the tools you have access to: ${spec.tools.join(', ')}
- Stay focused on your specialization: ${spec.specialization}
- Ask for help when tasks are outside your expertise
- Always validate before making changes

## 💡 Output Format

Provide clear, structured responses:
- Start with a brief summary
- Break down complex tasks into steps
- Show progress as you work
- Conclude with next steps or recommendations

---

**Ready to assist with ${spec.specialization}!**
`;
}
