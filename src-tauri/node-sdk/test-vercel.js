#!/usr/bin/env node

/**
 * Quick test for Vercel AI SDK multi-provider integration.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... node test-vercel.js openai gpt-4o-mini
 *   GOOGLE_AI_API_KEY=AIza... node test-vercel.js google gemini-2.5-flash
 *   OPENROUTER_API_KEY=sk-or-... node test-vercel.js openrouter openai/gpt-4o-mini
 */

import { streamVercelQuery } from './stream-vercel.js';

const [provider, model] = process.argv.slice(2);

if (!provider || !model) {
  console.log('Usage: OPENAI_API_KEY=sk-... node test-vercel.js <provider> <model>');
  console.log('');
  console.log('Examples:');
  console.log('  OPENAI_API_KEY=sk-... node test-vercel.js openai gpt-4o-mini');
  console.log('  GOOGLE_AI_API_KEY=AIza... node test-vercel.js google gemini-2.5-flash');
  console.log('  OPENROUTER_API_KEY=sk-or-... node test-vercel.js openrouter openai/gpt-4o-mini');
  process.exit(1);
}

const keyMap = { openai: 'OPENAI_API_KEY', google: 'GOOGLE_AI_API_KEY', openrouter: 'OPENROUTER_API_KEY' };
const apiKey = process.env[keyMap[provider]];

if (!apiKey) {
  console.error(`Missing ${keyMap[provider]}. Set it as env var.`);
  process.exit(1);
}

console.log(`\n--- Testing: provider=${provider} model=${model} ---\n`);

let eventCount = 0;
let textLength = 0;

await streamVercelQuery({
  modelId: model,
  provider,
  apiKey,
  messages: [{ role: 'user', content: 'Rispondi in italiano: cosa sei? In massimo 2 frasi.' }],
  systemPrompt: 'Sei un assistente utile. Rispondi brevemente.',
  onEvent: (event) => {
    eventCount++;
    if (event.type === 'assistant' && event.message?.content?.[0]?.text) {
      process.stdout.write(event.message.content[0].text);
      textLength += event.message.content[0].text.length;
    } else if (event.type === 'result') {
      console.log('\n');
      console.log('--- Result ---');
      console.log(`  Input tokens:  ${event.usage?.input_tokens || 0}`);
      console.log(`  Output tokens: ${event.usage?.output_tokens || 0}`);
      console.log(`  Context window: ${event.modelUsage?.[model]?.contextWindow || 'N/A'}`);
    } else if (event.type === 'error') {
      console.error('\n--- ERROR ---');
      console.error(`  ${event.error?.message}`);
    }
  },
  log: (msg) => console.error(`  ${msg}`),
});

console.log(`\nTotal: ${eventCount} events, ${textLength} chars streamed`);
console.log('TEST PASSED');
