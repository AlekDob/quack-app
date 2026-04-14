/**
 * Vercel AI SDK streaming engine for Quack.
 *
 * Handles non-Anthropic providers (OpenAI, Google, OpenRouter) using
 * the Vercel AI SDK. Normalizes events to match the Claude Agent SDK
 * event format so the Rust relay and React frontend see no difference.
 *
 * Supports agentic tool use (file read/write, search, list directory)
 * for models with toolUse: true in the registry.
 *
 * Brain: pattern-vercel-agentic-tools
 */
import { generateText, streamText, stepCountIs } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { findModel, createModel, detectApiKeys } from './model-registry.js';
import { buildVercelTools } from './vercel-tools.js';

// === CONSTANTS ===
const MAX_AGENTIC_STEPS = 10;
const MAX_OUTPUT_TOKENS = 16384;

// === MESSAGE NORMALIZATION ===

/**
 * Convert Quack conversation messages to Vercel AI SDK format.
 * Quack stores messages in Claude SDK format; we need to map them.
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
        content = m.content
          .filter(c => c.type === 'text')
          .map(c => c.text)
          .join('\n');
      }
      return { role: m.role, content };
    })
    .filter(m => m.content.length > 0);
}

/** Generate a unique message ID */
function generateMessageId() {
  return `msg_vercel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// === TOOL NAME/INPUT MAPPING ===
// WHY: Frontend (ChatView.tsx scanMessagesForEdits) looks for Claude SDK tool names
// ('write', 'edit') with input.file_path. Our Vercel tools use different names/fields.

/** Map Vercel tool names to Claude SDK tool names for frontend compat */
function mapToolName(vercelName) {
  const MAP = {
    fileWrite: 'Write',
    fileRead: 'Read',
    listDirectory: 'Glob',
    searchFiles: 'Grep',
  };
  return MAP[vercelName] || vercelName;
}

/** Map Vercel tool args to Claude SDK input format for frontend compat */
function mapToolInput(vercelName, args) {
  if (vercelName === 'fileWrite') {
    return { file_path: args.path, content: args.content };
  }
  if (vercelName === 'fileRead') {
    return { file_path: args.path };
  }
  return args;
}

// === AGENTIC QUERY (with tools) ===

/**
 * Run an agentic query with tool use via generateText().
 * Uses generateText (not streamText) because the SDK handles the
 * tool call loop automatically with stopWhen: stepCountIs(N).
 */
async function runAgenticQuery({
  model, modelId, entry, normalizedMessages,
  systemPrompt, tools, abortController, onEvent, log,
}) {
  const msgId = generateMessageId();
  const toolCalls = [];

  log(`[vercel] Agentic mode: ${Object.keys(tools).length} tools, max ${MAX_AGENTIC_STEPS} steps`);

  let fullText = '';
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    const result = await generateText({
      model,
      system: systemPrompt || undefined,
      messages: normalizedMessages,
      tools,
      maxTokens: MAX_OUTPUT_TOKENS,
      // WHY: maxSteps does NOT exist in Vercel AI SDK v6.
      // Default is stepCountIs(1) = only 1 LLM call = no synthesis after tool.
      // stepCountIs(N) enables multi-step: tool call → execute → model synthesizes.
      stopWhen: stepCountIs(MAX_AGENTIC_STEPS),
      abortSignal: abortController?.signal,
      onStepFinish: (step) => {
        const calls = step.toolCalls || [];
        const results = step.toolResults || [];

        // Emit tool_use + tool_result pairs for each call
        for (let i = 0; i < calls.length; i++) {
          const call = calls[i];
          if (!call?.toolName) continue;
          toolCalls.push(call.toolName);
          log(`[vercel] Tool call: ${call.toolName}`);

          const toolId = `tool_${Date.now()}_${i}`;
          // WHY: Vercel AI SDK v6 uses call.input (not call.args) for tool arguments
          const callArgs = call.input || call.args || {};
          const mappedName = mapToolName(call.toolName);
          const mappedInput = mapToolInput(call.toolName, callArgs);
          log(`[vercel] Tool: ${mappedName} on ${JSON.stringify(mappedInput).slice(0, 100)}`);

          // Emit tool_use event (starts loading spinner in frontend)
          onEvent({
            type: 'assistant',
            message: {
              id: generateMessageId(),
              type: 'message',
              role: 'assistant',
              model: modelId,
              content: [{
                type: 'tool_use',
                id: toolId,
                name: mappedName,
                input: mappedInput,
              }],
              usage: null,
              stop_reason: 'tool_use',
            },
          });

          // Emit tool_result event (stops loading spinner)
          // WHY: Frontend matches tool_result.tool_use_id to tool_use.id
          const toolResult = results[i];
          const resultContent = toolResult?.result
            ? (typeof toolResult.result === 'string' ? toolResult.result : JSON.stringify(toolResult.result))
            : '';

          onEvent({
            type: 'user',
            message: {
              id: generateMessageId(),
              type: 'message',
              role: 'user',
              content: [{
                type: 'tool_result',
                tool_use_id: toolId,
                content: resultContent,
              }],
            },
          });
        }
      },
    });

    fullText = result.text || '';
    const usage = result.usage || {};
    inputTokens = usage.promptTokens || 0;
    outputTokens = usage.completionTokens || 0;

    // WHY: result.text = last step's text only. If the model called tools
    // and stopped without a synthesis step, text is empty.
    // Debug: log result structure to understand what's available
    log(`[vercel] result keys: ${Object.keys(result).join(', ')}`);
    if (result.steps?.length > 0) {
      for (let i = 0; i < result.steps.length; i++) {
        const s = result.steps[i];
        log(`[vercel] step[${i}]: keys=${Object.keys(s).join(',')} text=${(s.text||'').length} toolCalls=${s.toolCalls?.length||0} toolResults=${s.toolResults?.length||0}`);
      }
    }
    // Also check top-level toolResults
    if (result.toolResults?.length > 0) {
      log(`[vercel] top-level toolResults: ${result.toolResults.length}`);
    }

    // Extract tool results if model didn't synthesize
    if (!fullText) {
      const parts = [];
      // Try top-level toolResults first
      const topResults = result.toolResults || [];
      for (const tr of topResults) {
        const val = typeof tr.result === 'string' ? tr.result : JSON.stringify(tr.result, null, 2);
        parts.push(val);
      }
      // Then check each step
      if (parts.length === 0 && result.steps?.length > 0) {
        for (const step of result.steps) {
          if (step.text) parts.push(step.text);
          const stepResults = step.toolResults || [];
          for (const tr of stepResults) {
            const val = typeof tr.result === 'string' ? tr.result : JSON.stringify(tr.result, null, 2);
            parts.push(val);
          }
        }
      }
      if (parts.length > 0) {
        fullText = parts.join('\n\n');
        log(`[vercel] Extracted ${parts.length} tool results, total ${fullText.length} chars`);
      }
    }

    log(`[vercel] generateText returned: text=${fullText.length} chars, tools=${toolCalls.length}, steps=${result.steps?.length || 0}`);
  } catch (agenticErr) {
    // WHY: generateText with tools may fail on some models (e.g. stopWhen not supported).
    // Fallback to chat mode (streamText without tools) so the user gets a response.
    const errMsg = agenticErr instanceof Error ? agenticErr.message : String(agenticErr);
    log(`[vercel] Agentic failed (${errMsg}), falling back to chat mode`);

    const chatResult = streamText({
      model,
      system: systemPrompt || undefined,
      messages: normalizedMessages,
      maxTokens: MAX_OUTPUT_TOKENS,
      abortSignal: abortController?.signal,
    });
    for await (const chunk of chatResult.textStream) {
      if (abortController?.signal?.aborted) break;
      fullText += chunk;
    }
    if (!abortController?.signal?.aborted) {
      const chatUsage = await chatResult.usage;
      inputTokens = chatUsage?.promptTokens || 0;
      outputTokens = chatUsage?.completionTokens || 0;
    }
  }

  // Always emit an assistant event — never leave the frontend with nothing
  if (fullText.length > 0) {
    onEvent({
      type: 'assistant',
      message: {
        id: msgId,
        type: 'message',
        role: 'assistant',
        model: modelId,
        content: [{ type: 'text', text: fullText }],
        usage: null,
        stop_reason: 'end_turn',
      },
    });
  } else {
    // Last resort: emit a message so the UI doesn't show blank
    const fallbackText = toolCalls.length > 0
      ? `[Completed ${toolCalls.length} tool operations]`
      : '[No response from model]';
    onEvent({
      type: 'assistant',
      message: {
        id: msgId,
        type: 'message',
        role: 'assistant',
        model: modelId,
        content: [{ type: 'text', text: fallbackText }],
        usage: null,
        stop_reason: 'end_turn',
      },
    });
  }

  if (abortController?.signal?.aborted) {
    log(`[vercel] Agentic aborted, skipping result event`);
    return;
  }

  emitResultEvent({
    onEvent, msgId, modelId, entry,
    fullText, inputTokens, outputTokens,
  });

  log(`[vercel] Agentic complete: ${toolCalls.length} tool calls, ${outputTokens} output tokens`);
}

// === CHAT-ONLY QUERY (no tools) ===

/**
 * Run a simple text-only query via streamText().
 * For models without tool use or when no project context.
 */
async function runChatQuery({
  model, modelId, entry, normalizedMessages,
  systemPrompt, abortController, onEvent, log,
}) {
  const msgId = generateMessageId();
  let fullText = '';

  const result = streamText({
    model,
    system: systemPrompt || undefined,
    messages: normalizedMessages,
    abortSignal: abortController?.signal,
    maxTokens: MAX_OUTPUT_TOKENS,
  });

  for await (const chunk of result.textStream) {
    if (abortController?.signal?.aborted) break;
    fullText += chunk;
  }

  // Emit assistant message (skip empty text to avoid blank bubbles)
  if (fullText.length > 0) {
    onEvent({
      type: 'assistant',
      message: {
        id: msgId,
        type: 'message',
        role: 'assistant',
        model: modelId,
        content: [{ type: 'text', text: fullText }],
        usage: null,
        stop_reason: null,
      },
    });
  }

  if (abortController?.signal?.aborted) {
    log(`[vercel] Stream aborted after text loop, skipping usage`);
    return;
  }

  const usage = await result.usage;
  emitResultEvent({
    onEvent, msgId, modelId, entry, fullText,
    inputTokens: usage?.promptTokens || 0,
    outputTokens: usage?.completionTokens || 0,
  });

  log(`[vercel] Chat complete: ${usage?.completionTokens || 0} output tokens`);
}

// === SHARED HELPERS ===

/** Emit result event matching Claude SDK format */
function emitResultEvent({
  onEvent, msgId, modelId, entry,
  fullText, inputTokens, outputTokens,
}) {
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
    modelUsage: {
      [modelId]: {
        contextWindow: ctxWindow,
        costUSD: 0,
        inputTokens,
        outputTokens,
      },
    },
  });
}

// === MAIN ENTRY POINT ===

/**
 * Stream a query using Vercel AI SDK.
 * Automatically selects agentic mode (with tools) or chat mode
 * based on model capabilities and project context.
 *
 * @param {object} params
 * @param {string} params.modelId — model ID
 * @param {string} params.provider — 'openai' | 'google' | 'openrouter'
 * @param {string} params.apiKey — provider API key
 * @param {Array} params.messages — conversation history
 * @param {string} [params.systemPrompt] — system prompt text
 * @param {string} [params.cwd] — project root for tool scoping
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
  cwd,
  abortController,
  onEvent,
  log = () => {},
}) {
  log(`[vercel] Starting: model=${modelId} provider=${provider} cwd=${cwd || '(none)'}`);

  // Early exit: missing API key → clear error to user
  if (!apiKey) {
    const providerNames = {
      openai: 'OpenAI', google: 'Google AI', openrouter: 'OpenRouter',
      minimax: 'MiniMax', zai: 'ZAI/GLM',
    };
    const label = providerNames[provider] || provider;
    onEvent({
      type: 'error',
      error: {
        type: 'provider_error',
        message: `API key mancante per ${label}. Vai in Settings > Claude Code e inserisci la ${label} API Key.`,
        provider,
        model: modelId,
      },
    });
    return;
  }

  // Resolve model from registry or create ad-hoc
  const keys = detectApiKeys({ [provider]: apiKey });
  const entry = findModel(modelId);

  let model;
  if (entry) {
    model = createModel(entry, keys);
    log(`[vercel] Resolved model: ${entry.label} (toolUse=${entry.toolUse})`);
  } else {
    log(`[vercel] Model ${modelId} not in registry, creating ad-hoc`);
    model = createAdHocModel(modelId, provider, apiKey);
  }

  const normalizedMessages = normalizeMessages(messages);
  const useTools = entry?.toolUse && cwd;

  try {
    if (useTools) {
      const tools = buildVercelTools(cwd);
      await runAgenticQuery({
        model, modelId, entry, normalizedMessages,
        systemPrompt, tools, abortController, onEvent, log,
      });
    } else {
      await runChatQuery({
        model, modelId, entry, normalizedMessages,
        systemPrompt, abortController, onEvent, log,
      });
    }
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

    log(`[vercel] Error: ${errorMsg}`);
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

// === AD-HOC MODEL CREATION ===

/**
 * Create a model instance for an ID not in the registry.
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

  if (provider === 'minimax') {
    const p = createOpenAI({
      baseURL: 'https://api.minimax.io/v1',
      apiKey,
      name: 'minimax',
    });
    return p.chat(modelId);
  }

  if (provider === 'zai') {
    const p = createOpenAI({
      baseURL: 'https://api.z.ai/api/coding/paas/v4',
      apiKey,
      name: 'zai',
    });
    return p.chat(modelId);
  }

  const p = createOpenAI({ apiKey });
  return p(modelId);
}
