/**
 * Vercel AI SDK streaming engine for Quack.
 *
 * Handles non-Anthropic providers (OpenAI, Google, OpenRouter) using
 * the Vercel AI SDK's streamText(). Normalizes events to match the
 * Claude Agent SDK event format so the Rust relay and React frontend
 * see no difference.
 */
import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { findModel, createModel, detectApiKeys } from './model-registry.js';

/**
 * Convert Quack conversation messages to Vercel AI SDK format.
 * Quack stores messages in Claude SDK format; we need to map them.
 *
 * @param {Array<{role: string, content: any}>} messages
 * @returns {Array<{role: 'user' | 'assistant' | 'system', content: string}>}
 */
function normalizeMessages(messages) {
  if (!messages || !Array.isArray(messages)) return [];

  return messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => {
      let content = '';
      if (typeof m.content === 'string') {
        content = m.content;
      } else if (Array.isArray(m.content)) {
        // Claude format: [{ type: 'text', text: '...' }]
        content = m.content
          .filter(c => c.type === 'text')
          .map(c => c.text)
          .join('\n');
      }
      return { role: m.role, content };
    })
    .filter(m => m.content.length > 0);
}

/**
 * Generate a unique message ID.
 * @returns {string}
 */
function generateMessageId() {
  return `msg_vercel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Stream a query using Vercel AI SDK.
 * Emits events in the same format as Claude Agent SDK.
 *
 * @param {object} params
 * @param {string} params.modelId — model ID (e.g. 'gpt-4o', 'gemini-2.5-flash')
 * @param {string} params.provider — 'openai' | 'google' | 'openrouter'
 * @param {string} params.apiKey — provider API key
 * @param {Array} params.messages — conversation history
 * @param {string} [params.systemPrompt] — system prompt text
 * @param {AbortController} [params.abortController]
 * @param {(event: object) => void} params.onEvent — event callback
 * @param {(msg: string) => void} [params.log] — logger
 */
export async function streamVercelQuery({
  modelId,
  provider,
  apiKey,
  messages,
  systemPrompt,
  abortController,
  onEvent,
  log = () => {},
}) {
  const msgId = generateMessageId();
  log(`[vercel] Starting stream: model=${modelId} provider=${provider}`);

  // Resolve model from registry or create ad-hoc
  const keys = detectApiKeys({ [provider]: apiKey });
  const entry = findModel(modelId);

  let model;
  if (entry) {
    model = createModel(entry, keys);
    log(`[vercel] Resolved model from registry: ${entry.label}`);
  } else {
    // Ad-hoc model — try to create based on provider
    log(`[vercel] Model ${modelId} not in registry, creating ad-hoc`);
    model = createAdHocModel(modelId, provider, apiKey);
  }

  // Skip system init event — the frontend renders it as a metadata box
  // instead of a streaming placeholder. Jump straight to assistant events.

  const normalizedMessages = normalizeMessages(messages);
  let fullText = '';
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    const result = streamText({
      model,
      system: systemPrompt || undefined,
      messages: normalizedMessages,
      abortSignal: abortController?.signal,
      // maxTokens = max OUTPUT tokens per response (not context window)
      maxTokens: 16384,
    });

    // Collect all text, then emit ONE assistant event at the end.
    // The frontend stores each event in the events[] array and renders them all.
    // Claude SDK uses content_block_delta for streaming (different protocol).
    // For now, we skip streaming animation and show the final text at once.
    // TODO: implement proper streaming via content_block_delta events
    for await (const chunk of result.textStream) {
      if (abortController?.signal?.aborted) break;
      fullText += chunk;
    }

    // Emit single assistant event with complete text
    onEvent({
      type: 'assistant',
      message: {
        id: msgId,
        type: 'message',
        role: 'assistant',
        model: modelId,
        content: [{
          type: 'text',
          text: fullText,
        }],
        usage: null,
        stop_reason: null,
      },
    });

    // Guard: if aborted during stream, don't await usage (could hang)
    if (abortController?.signal?.aborted) {
      log(`[vercel] Stream aborted after text loop, skipping usage`);
      return;
    }

    // Get final usage from the result
    const usage = await result.usage;
    inputTokens = usage?.promptTokens || 0;
    outputTokens = usage?.completionTokens || 0;

    // Emit final result event (matches Claude SDK result format)
    // The frontend reads contextWindow from modelUsage[modelId].contextWindow
    const ctxWindow = entry?.contextWindow || 128000;
    onEvent({
      type: 'result',
      subtype: 'success',
      result: fullText,
      session_id: msgId,
      is_error: false,
      total_cost_usd: 0,
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      },
      model: modelId,
      // Match Claude SDK modelUsage format so StaminaBar picks up contextWindow
      modelUsage: {
        [modelId]: {
          contextWindow: ctxWindow,
          costUSD: 0,
          inputTokens,
          outputTokens,
        },
      },
    });

    log(`[vercel] Stream complete: ${outputTokens} output tokens`);

  } catch (err) {
    if (abortController?.signal?.aborted) {
      log(`[vercel] Stream aborted by user`);
      return;
    }

    const providerLabels = {
      openai: 'OpenAI',
      google: 'Google',
      openrouter: 'OpenRouter',
    };
    const label = providerLabels[provider] || provider;
    const errorMsg = err instanceof Error ? err.message : String(err);

    log(`[vercel] Stream error: ${errorMsg}`);

    onEvent({
      type: 'error',
      error: {
        type: 'provider_error',
        message: `${label}: ${errorMsg}`,
        provider,
        model: modelId,
      },
    });
  }
}

/**
 * Create a model instance for an ID not in the registry.
 * Uses the same imports already available at module level.
 * @param {string} modelId
 * @param {string} provider
 * @param {string} apiKey
 */
function createAdHocModel(modelId, provider, apiKey) {
  if (provider === 'google') {
    const p = createGoogleGenerativeAI({ apiKey });
    return p(modelId);
  }

  if (provider === 'openrouter') {
    const p = createOpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey,
      name: 'openrouter',
    });
    return p(modelId);
  }

  // Default: OpenAI-compatible
  const p = createOpenAI({ apiKey });
  return p(modelId);
}
