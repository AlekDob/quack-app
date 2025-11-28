/**
 * AI-Powered Trigger Generator Hook
 * Uses OpenAI GPT-4o-mini to generate specific, actionable triggers
 * for skills and droids based on their name, description, and specialization.
 *
 * Security Note: API key is stored encrypted in OS keychain via Tauri.
 * Uses dangerouslyAllowBrowser for Tauri desktop context (not web-exposed).
 */

import { useState, useCallback, useRef } from 'react';
import OpenAI from 'openai';
import { invoke } from '@tauri-apps/api/core';
import { generateSmartTrigger as generatePatternTrigger } from '../lib/triggerQuality';

/**
 * Factory function for creating OpenAI client (DRY)
 */
function createOpenAIClient(apiKey: string): OpenAI {
  return new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true, // Safe in Tauri desktop context
  });
}

// System prompt for trigger generation
const SYSTEM_PROMPT = `You are a trigger pattern expert for an AI agent system called Quack.
Your job is to generate SPECIFIC, ACTIONABLE triggers that tell the agent WHEN to use a skill/droid.

A trigger should describe the CONDITIONS under which the skill/droid should be automatically invoked.

RULES FOR GOOD TRIGGERS:
1. Include file patterns when relevant: .ts, .tsx, .js, .jsx, .css, .scss, .md, .json, .env
2. Include folder paths when relevant: /components, /src, /api, /hooks, /lib, /tests, __tests__
3. Include specific keywords to match: "className", "useState", "fetch", "describe", "it", "expect"
4. Include numeric conditions when helpful: "> 10 lines changed", "> 50 lines of code"
5. Be concrete and pattern-matchable, NOT vague

EXAMPLES:
BAD: "When working on frontend" (too vague)
BAD: "When the user asks about testing" (not actionable)
GOOD: "When editing .tsx files in /components folder that contain React hooks (useState, useEffect) or className attributes"
GOOD: "When creating files in __tests__ folder ending with .test.ts or .spec.ts, or after modifying any source file in /src"
GOOD: "When editing files in /api or /services folder that contain 'fetch', 'axios', or HTTP request patterns"

Return ONLY the trigger text, nothing else. No quotes, no explanation.`;

export interface AITriggerGeneratorOptions {
  name: string;
  description: string;
  specialization?: string;
  category?: string;
}

export interface AITriggerResult {
  trigger: string;
  isAIGenerated: boolean;
  model?: string;
}

export interface UseAITriggerGeneratorReturn {
  generateTrigger: (options: AITriggerGeneratorOptions) => Promise<AITriggerResult>;
  isGenerating: boolean;
  error: string | null;
  isAvailable: boolean;
}

/**
 * Hook for generating AI-powered triggers
 * Falls back to pattern-based generation if OpenAI is not available
 */
export function useAITriggerGenerator(): UseAITriggerGeneratorReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  const hasCheckedAvailability = useRef(false);

  // Check if OpenAI API key is available (runs once on mount)
  const checkAvailability = useCallback(async (): Promise<string | null> => {
    try {
      const savedKey = await invoke<string | null>('get_ai_api_key');
      if (savedKey) {
        const decoded = atob(savedKey);
        setIsAvailable(true);
        return decoded;
      }
      setIsAvailable(false);
      return null;
    } catch {
      setIsAvailable(false);
      return null;
    }
  }, []);

  // Check availability on first render
  if (!hasCheckedAvailability.current) {
    hasCheckedAvailability.current = true;
    checkAvailability();
  }

  // Generate trigger using OpenAI
  const generateWithAI = useCallback(async (
    apiKey: string,
    options: AITriggerGeneratorOptions
  ): Promise<string> => {
    console.log('[AITriggerGenerator] generateWithAI called');
    const openai = createOpenAIClient(apiKey);
    const userPrompt = buildUserPrompt(options);
    console.log('[AITriggerGenerator] Calling OpenAI API...');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    console.log('[AITriggerGenerator] OpenAI response received:', response);
    const content = response.choices[0]?.message?.content;
    console.log('[AITriggerGenerator] Extracted content:', content);

    if (!content) {
      throw new Error('No response from OpenAI');
    }

    return content.trim();
  }, []);

  // Main generate function with fallback
  const generateTrigger = useCallback(async (
    options: AITriggerGeneratorOptions
  ): Promise<AITriggerResult> => {
    console.log('[AITriggerGenerator] generateTrigger called with:', options);
    setIsGenerating(true);
    setError(null);

    try {
      // Check for API key
      console.log('[AITriggerGenerator] Checking API key availability...');
      const apiKey = await checkAvailability();
      console.log('[AITriggerGenerator] API key available:', !!apiKey);

      if (apiKey) {
        // Try AI generation
        console.log('[AITriggerGenerator] Starting AI generation...');
        const trigger = await generateWithAI(apiKey, options);
        console.log('[AITriggerGenerator] AI generation complete, trigger:', trigger);
        setIsGenerating(false);
        const result = {
          trigger,
          isAIGenerated: true,
          model: 'gpt-4o-mini',
        };
        console.log('[AITriggerGenerator] Returning result:', result);
        return result;
      } else {
        // Fallback to pattern-based generation
        console.log('[AITriggerGenerator] No API key, using pattern-based fallback');
        const trigger = generatePatternTrigger(
          options.name,
          options.description,
          options.category || 'default'
        );
        setIsGenerating(false);
        return {
          trigger,
          isAIGenerated: false,
        };
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate trigger';
      console.error('[AITriggerGenerator] Error:', errorMessage);
      setError(errorMessage);

      // Fallback to pattern-based on error
      const trigger = generatePatternTrigger(
        options.name,
        options.description,
        options.category || 'default'
      );
      setIsGenerating(false);
      return {
        trigger,
        isAIGenerated: false,
      };
    }
  }, [checkAvailability, generateWithAI]);

  return {
    generateTrigger,
    isGenerating,
    error,
    isAvailable,
  };
}

/**
 * Build user prompt from options
 */
function buildUserPrompt(options: AITriggerGeneratorOptions): string {
  const parts = [
    `Generate a trigger for this ${options.specialization ? 'specialized ' : ''}skill/droid:`,
    '',
    `Name: ${options.name}`,
    `Description: ${options.description}`,
  ];

  if (options.specialization) {
    parts.push(`Specialization: ${options.specialization}`);
  }

  if (options.category) {
    parts.push(`Category: ${options.category}`);
  }

  parts.push('', 'Return ONLY the trigger text.');

  return parts.join('\n');
}

/**
 * Utility to generate multiple triggers in batch
 */
export async function generateTriggersInBatch(
  items: AITriggerGeneratorOptions[],
  apiKey: string | null
): Promise<AITriggerResult[]> {
  const results: AITriggerResult[] = [];

  for (const item of items) {
    if (apiKey) {
      try {
        const openai = createOpenAIClient(apiKey);
        const userPrompt = buildUserPrompt(item);

        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 200,
        });

        const content = response.choices[0]?.message?.content;
        results.push({
          trigger: content?.trim() || generatePatternTrigger(item.name, item.description, item.category || 'default'),
          isAIGenerated: !!content,
          model: 'gpt-4o-mini',
        });
      } catch (err) {
        console.error('[AITriggerGenerator] Batch generation failed for:', item.name, err);
        results.push({
          trigger: generatePatternTrigger(item.name, item.description, item.category || 'default'),
          isAIGenerated: false,
        });
      }
    } else {
      results.push({
        trigger: generatePatternTrigger(item.name, item.description, item.category || 'default'),
        isAIGenerated: false,
      });
    }
  }

  return results;
}
