import { useState, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { ChatMessage } from '../types';
import type { ChatMode, AgentOptions, ImageAttachment, AgentResponse, ThinkingMode } from '../types/agent';
import { THINKING_MODES } from '../types/agent';

interface ClaudeCliResponse {
  result: string;
  session_id: string;
  total_cost_usd: number;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens: number;
    cache_creation_input_tokens: number;
  };
}

export function useClaudeChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Agent SDK specific state
  const [mode, setMode] = useState<ChatMode>('cli');
  const [agentOptions, setAgentOptions] = useState<AgentOptions>({
    model: 'claude-sonnet-4-20250514',
    temperature: 1.0,
    thinking_enabled: false,
    thinking_mode: 'auto' as ThinkingMode,
  });
  const [attachedImages, setAttachedImages] = useState<File[]>([]);

  const conversationHistory = useRef<Array<{ role: 'user' | 'assistant'; content: string }>>([]);

  // Check if CLI credentials are available (both CLI and Agent mode use the same credentials now)
  const initialize = useCallback(async () => {
    try {
      // Both CLI and Agent mode now use Claude CLI credentials
      const authenticated = await invoke<boolean>('check_claude_cli_auth');

      if (authenticated) {
        setIsConfigured(true);
        setError(null);
        return true;
      } else {
        setIsConfigured(false);
        setError('Claude CLI credentials not found. Please run "claude login" first.');
        return false;
      }
    } catch (err) {
      console.error('Failed to initialize:', err);
      setIsConfigured(false);
      setError(err instanceof Error ? err.message : 'Initialization failed');
      return false;
    }
  }, [mode]);

  // Convert File to base64 ImageAttachment
  const fileToBase64 = async (file: File): Promise<ImageAttachment> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1]; // Remove data:image/...;base64, prefix
        resolve({
          data: base64,
          media_type: file.type,
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Send message to Claude (CLI or Agent mode)
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    // Ensure we're initialized
    if (!isConfigured) {
      const initialized = await initialize();
      if (!initialized) {
        const errorMessage: ChatMessage = {
          id: `msg-${Date.now()}-error`,
          role: 'assistant',
          content: `Quack quack! 🦆 ${error || 'Not configured'}`,
          timestamp: Date.now(),
          status: 'error',
          error: error || 'Not configured',
        };
        setMessages((prev) => [...prev, errorMessage]);
        return;
      }
    }

    // Create user message
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content,
      timestamp: Date.now(),
      status: 'sending',
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    // Create assistant message placeholder
    const assistantMessageId = `msg-${Date.now()}-assistant`;
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      status: 'streaming',
    };

    setMessages((prev) => [...prev, assistantMessage]);

    try {
      if (mode === 'cli') {
        // CLI Mode
        let prompt = content;
        if (conversationHistory.current.length > 0) {
          const history = conversationHistory.current
            .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
            .join('\n\n');
          prompt = `${history}\n\nUser: ${content}`;
        }

        const response = await invoke<ClaudeCliResponse>('send_message_via_cli', { prompt });

        conversationHistory.current.push(
          { role: 'user', content },
          { role: 'assistant', content: response.result }
        );

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: response.result,
                  status: 'complete' as const,
                }
              : msg
          )
        );
      } else {
        // Agent Mode - uses CLI credentials automatically
        // Convert attached images to base64
        let images: ImageAttachment[] | undefined;
        if (attachedImages.length > 0) {
          images = await Promise.all(attachedImages.map(fileToBase64));
        }

        // Prepend thinking keyword if thinking_mode is set
        let finalPrompt = content;
        const thinkingMode = agentOptions.thinking_mode || 'auto';
        const thinkingConfig = THINKING_MODES[thinkingMode];

        if (thinkingConfig.keyword) {
          finalPrompt = `${thinkingConfig.keyword}\n\n${content}`;
        }

        const response = await invoke<AgentResponse>('send_message_with_agent', {
          prompt: finalPrompt,
          images,
          options: agentOptions,
        });

        conversationHistory.current.push(
          { role: 'user', content },
          { role: 'assistant', content: response.result }
        );

        // If there's thinking, show it
        let fullContent = response.result;
        if (response.thinking) {
          fullContent = `**[Extended Thinking]**\n\n${response.thinking}\n\n---\n\n${response.result}`;
        }

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: fullContent,
                  status: 'complete' as const,
                }
              : msg
          )
        );

        // Clear attached images after sending
        setAttachedImages([]);
      }
    } catch (err) {
      console.error('Error sending message:', err);

      const errorMessage = err instanceof Error ? err.message : 'Unknown error';

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: `Quack! 🦆 I encountered an error: ${errorMessage}`,
                status: 'error' as const,
                error: errorMessage,
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, error, initialize, isConfigured, mode, agentOptions, attachedImages]);

  // Clear conversation
  const clearConversation = useCallback(() => {
    setMessages([]);
    conversationHistory.current = [];
  }, []);

  // Handle mode change
  const handleModeChange = useCallback(async (newMode: ChatMode) => {
    setMode(newMode);
    setIsConfigured(false); // Force re-initialization
    // Clear attached images when switching to CLI mode
    if (newMode === 'cli') {
      setAttachedImages([]);
    }
  }, []);

  // Handle agent options change
  const handleAgentOptionsChange = useCallback((options: AgentOptions) => {
    setAgentOptions(options);
  }, []);

  // Handle image attachment
  const handleImagesAttach = useCallback((files: File[]) => {
    setAttachedImages((prev) => [...prev, ...files]);
  }, []);

  // Handle image removal
  const handleImageRemove = useCallback((index: number) => {
    setAttachedImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return {
    messages,
    isLoading,
    isConfigured,
    error,
    mode,
    agentOptions,
    attachedImages,
    sendMessage,
    clearConversation,
    initialize,
    onModeChange: handleModeChange,
    onAgentOptionsChange: handleAgentOptionsChange,
    onImagesAttach: handleImagesAttach,
    onImageRemove: handleImageRemove,
  };
}
