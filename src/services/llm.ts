import {
  shouldUseBackup,
  isHybridMode,
  shouldUseBackupInHybridMode,
  getBackupResponseWithFallback,
  recordSuccess,
  recordFailure,
  getBackupMatchConfidence
} from './backup';

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type ChatRequest = {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  options?: Record<string, unknown>;
  personaId?: string; // Optional persona ID for backup responses
};

export type LLMProvider = 'ollama' | 'lmstudio' | 'openai' | 'custom';

export type LLMConfig = {
  provider: LLMProvider;
  baseUrl: string;
  apiKey?: string; // For OpenAI-compatible APIs that require auth
  defaultModel: string;
};

// Preset configurations for common setups
export const LLM_PRESETS: Record<string, LLMConfig> = {
  ollama: {
    provider: 'ollama',
    baseUrl: 'http://localhost:11434',
    defaultModel: 'llama3.1',
  },
  lmstudio: {
    provider: 'lmstudio',
    baseUrl: 'http://localhost:1234',
    defaultModel: 'local-model',
  },
  openai: {
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    defaultModel: 'gpt-4',
  },
};

/**
 * Extract the user's question from the message history
 * Returns the last user message content
 */
function extractUserQuestion(messages: ChatMessage[]): string {
  // Find the last user message
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      return messages[i].content;
    }
  }
  // Fallback if no user message found
  return 'Please share your perspective on this topic.';
}

/**
 * Universal chat function that works with Ollama, LM Studio, and OpenAI-compatible APIs
 * Includes automatic backup/fallback support when live models are unavailable
 * Supports hybrid mode: uses pre-generated responses for strong matches, live LLM otherwise
 */
export async function chatWithLLM(config: LLMConfig, req: ChatRequest): Promise<string> {
  const { provider, baseUrl, apiKey } = config;

  // Extract user question for backup/hybrid mode checks
  const userQuestion = req.personaId ? extractUserQuestion(req.messages) : '';

  // Bypass LLM entirely for recognized pre-generated demo questions (always use backup)
  if (req.personaId) {
    const match = getBackupMatchConfidence(userQuestion);
    if (match?.questionId && match.confidence >= 0.75) {
      console.log('🎯 Recognized demo question - using pre-generated response (no LLM)');
      return await getBackupResponseWithFallback(userQuestion, req.personaId, false);
    }
  }


  // Check if backup mode is active (always or auto-enabled)
  if (shouldUseBackup() && req.personaId) {
    console.log('📦 Backup mode active - using pre-generated response');
    return await getBackupResponseWithFallback(userQuestion, req.personaId, false);
  }

  // Check if hybrid mode is active and question matches strongly
  if (isHybridMode() && req.personaId && shouldUseBackupInHybridMode(userQuestion)) {
    console.log('🔀 Hybrid mode: Strong match detected - using pre-generated response');
    return await getBackupResponseWithFallback(userQuestion, req.personaId, false);
  }

  // If hybrid mode but weak/no match, fall through to live LLM
  if (isHybridMode() && req.personaId) {
    console.log('🔀 Hybrid mode: Weak/no match - using live LLM');
  }

  try {
    let response: string;
    if (provider === 'ollama') {
      response = await chatWithOllama(baseUrl, req);
    } else {
      // LM Studio, OpenAI, and other OpenAI-compatible APIs
      response = await chatWithOpenAICompatible(baseUrl, apiKey, req);
    }

    // Record success to reset failure counter
    recordSuccess();
    return response;
  } catch (e) {
    console.error(`❌ ${provider} error:`, e);
    console.error('Config:', { provider, baseUrl, model: req.model });
    console.error('Full error:', e instanceof Error ? e.message : String(e));

    // Record failure for backup system
    recordFailure();

    // Try to use backup response if persona ID is available
    if (req.personaId) {
      console.log('📦 LLM failed - attempting to use backup response');
      const userQuestion = extractUserQuestion(req.messages);
      return await getBackupResponseWithFallback(userQuestion, req.personaId, false);
    }

    // Ultimate fallback if no persona ID
    return '"(Offline fallback) Here is a concise perspective based on my persona."';
  }
}

/**
 * Streaming chat function that yields partial responses as they arrive
 * Includes automatic backup/fallback support when live models are unavailable
 * Supports hybrid mode: uses pre-generated responses for strong matches, live LLM otherwise
 * @param config LLM configuration
 * @param req Chat request
 * @param onChunk Callback invoked for each chunk of text
 * @returns Promise that resolves with the complete response text


 */
export async function chatWithLLMStreaming(
  config: LLMConfig,
  req: ChatRequest,
  onChunk: (chunk: string) => void
): Promise<string> {
  const { provider, baseUrl, apiKey } = config;

  // Extract user question for backup/hybrid mode checks
  const userQuestion = req.personaId ? extractUserQuestion(req.messages) : '';

  // Bypass LLM entirely for recognized pre-generated demo questions (always use backup, streaming)
  if (req.personaId) {
    const match = getBackupMatchConfidence(userQuestion);
    if (match?.questionId && match.confidence >= 0.75) {
      console.log('🎯 Recognized demo question - using pre-generated response (stream, no LLM)');
      return await getBackupResponseWithFallback(userQuestion, req.personaId, true, onChunk);
    }
  }


  // Check if backup mode is active (always or auto-enabled)
  if (shouldUseBackup() && req.personaId) {
    console.log('📦 Backup mode active - using pre-generated response with streaming simulation');
    return await getBackupResponseWithFallback(userQuestion, req.personaId, true, onChunk);
  }

  // Check if hybrid mode is active and question matches strongly
  if (isHybridMode() && req.personaId && shouldUseBackupInHybridMode(userQuestion)) {
    console.log('🔀 Hybrid mode: Strong match detected - using pre-generated response with streaming');
    return await getBackupResponseWithFallback(userQuestion, req.personaId, true, onChunk);
  }

  // If hybrid mode but weak/no match, fall through to live LLM
  if (isHybridMode() && req.personaId) {
    console.log('🔀 Hybrid mode: Weak/no match - using live LLM streaming');
    // Continue to live LLM below
  }

  try {
    let response: string;
    if (provider === 'ollama') {
      response = await chatWithOllamaStreaming(baseUrl, req, onChunk);
    } else {
      // LM Studio, OpenAI, and other OpenAI-compatible APIs
      response = await chatWithOpenAICompatibleStreaming(baseUrl, apiKey, req, onChunk);
    }

    // Record success to reset failure counter
    recordSuccess();
    return response;
  } catch (e) {
    console.error(`❌ ${provider} streaming error:`, e);
    console.error('Config:', { provider, baseUrl, model: req.model });
    console.error('Full error:', e instanceof Error ? e.message : String(e));

    // Record failure for backup system
    recordFailure();

    // Try to use backup response if persona ID is available
    if (req.personaId) {
      console.log('📦 LLM streaming failed - attempting to use backup response');
      const userQuestion = extractUserQuestion(req.messages);
      return await getBackupResponseWithFallback(userQuestion, req.personaId, true, onChunk);
    }

    // Ultimate fallback if no persona ID
    const fallback = '"(Offline fallback) Here is a concise perspective based on my persona."';
    onChunk(fallback);
    return fallback;
  }
}

/**
 * Ollama-specific chat implementation
 */
async function chatWithOllama(baseUrl: string, req: ChatRequest): Promise<string> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/chat`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...req, stream: false }),
  });
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
  const data = await res.json();
  const content = data?.message?.content ?? '';
  if (typeof content !== 'string' || !content) throw new Error('Empty content');
  return content;
}

/**
 * Ollama-specific streaming chat implementation
 */
async function chatWithOllamaStreaming(
  baseUrl: string,
  req: ChatRequest,
  onChunk: (chunk: string) => void
): Promise<string> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/chat`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...req, stream: true }),
  });

  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
  if (!res.body) throw new Error('No response body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          const content = data?.message?.content ?? '';
          if (content) {
            fullContent += content;
            onChunk(content);
          }
        } catch (e) {
          // Skip invalid JSON lines
          console.warn('Failed to parse Ollama streaming chunk:', line);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!fullContent) throw new Error('Empty streaming content');
  return fullContent;
}

/**
 * OpenAI-compatible chat implementation (works with LM Studio, OpenAI, etc.)
 */
async function chatWithOpenAICompatible(
  baseUrl: string,
  apiKey: string | undefined,
  req: ChatRequest
): Promise<string> {
  // In development, use proxy to avoid CORS issues
  let url: string;
  const isDev = import.meta.env.DEV;

  if (isDev && baseUrl.includes('localhost:1234')) {
    // LM Studio - use proxy
    url = '/api/lmstudio/v1/chat/completions';
  } else if (isDev && baseUrl.includes('localhost:11434')) {
    // Ollama - use proxy
    url = '/api/ollama/v1/chat/completions';
  } else {
    // Production or external API - use direct URL
    url = `${baseUrl.replace(/\/$/, '')}/v1/chat/completions`;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add authorization header if API key is provided
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  console.log('🔵 Sending request to:', url, isDev ? '(via proxy)' : '(direct)');
  console.log('🔵 Original baseUrl:', baseUrl);
  console.log('🔵 Model:', req.model);
  console.log('🔵 Messages:', req.messages.length, 'messages');
  console.log('🔵 Request body:', JSON.stringify({
    model: req.model,
    messages: req.messages,
    stream: false,
    ...req.options,
  }, null, 2));

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: req.model,
      messages: req.messages,
      stream: false,
      ...req.options,
    }),
  });

  console.log('🔵 Response status:', res.status);
  console.log('🔵 Response ok:', res.ok);

  if (!res.ok) {
    const errorText = await res.text();
    console.error('🔴 Error response:', errorText);
    throw new Error(`API HTTP ${res.status}: ${errorText}`);
  }

  const data = await res.json();
  console.log('🔵 Response data:', data);

  const content = data?.choices?.[0]?.message?.content ?? '';
  if (typeof content !== 'string' || !content) {
    console.error('🔴 Empty or invalid content:', { data, content });
    throw new Error('Empty content');
  }

  console.log('✅ Got response:', content.substring(0, 100) + '...');
  return content;
}

/**
 * OpenAI-compatible streaming chat implementation
 */
async function chatWithOpenAICompatibleStreaming(
  baseUrl: string,
  apiKey: string | undefined,
  req: ChatRequest,
  onChunk: (chunk: string) => void
): Promise<string> {
  // In development, use proxy to avoid CORS issues
  let url: string;
  const isDev = import.meta.env.DEV;

  if (isDev && baseUrl.includes('localhost:1234')) {
    // LM Studio - use proxy
    url = '/api/lmstudio/v1/chat/completions';
  } else if (isDev && baseUrl.includes('localhost:11434')) {
    // Ollama - use proxy
    url = '/api/ollama/v1/chat/completions';
  } else {
    // Production or external API - use direct URL
    url = `${baseUrl.replace(/\/$/, '')}/v1/chat/completions`;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add authorization header if API key is provided
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  console.log('🔵 Sending streaming request to:', url, isDev ? '(via proxy)' : '(direct)');

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: req.model,
      messages: req.messages,
      stream: true,
      ...req.options,
    }),
  });

  console.log('🔵 Streaming response status:', res.status);

  if (!res.ok) {
    const errorText = await res.text();
    console.error('🔴 Streaming error response:', errorText);
    throw new Error(`API HTTP ${res.status}: ${errorText}`);
  }

  if (!res.body) throw new Error('No response body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(line => line.trim() && line.startsWith('data: '));

      for (const line of lines) {
        const data = line.replace(/^data: /, '');
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const content = parsed?.choices?.[0]?.delta?.content ?? '';
          if (content) {
            fullContent += content;
            onChunk(content);
          }
        } catch (e) {
          // Skip invalid JSON lines
          console.warn('Failed to parse OpenAI streaming chunk:', data);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!fullContent) {
    console.error('🔴 Empty streaming content');
    throw new Error('Empty streaming content');
  }

  console.log('✅ Got streaming response:', fullContent.substring(0, 100) + '...');
  return fullContent;
}

/**
 * Test connection to an LLM provider
 */
export async function testLLMConnection(config: LLMConfig): Promise<{ success: boolean; error?: string; models?: string[] }> {
  try {
    const models = await listModels(config);
    return { success: true, models };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * List available models from the provider
 */
export async function listModels(config: LLMConfig): Promise<string[]> {
  const { provider, baseUrl, apiKey } = config;
  const isDev = import.meta.env.DEV;

  try {
    if (provider === 'ollama') {
      let url: string;
      if (isDev && baseUrl.includes('localhost:11434')) {
        url = '/api/ollama/api/tags';
      } else {
        url = `${baseUrl.replace(/\/$/, '')}/api/tags`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return (data?.models || []).map((m: any) => m.name);
    } else {
      // OpenAI-compatible endpoint
      let url: string;
      if (isDev && baseUrl.includes('localhost:1234')) {
        url = '/api/lmstudio/v1/models';
      } else if (isDev && baseUrl.includes('localhost:11434')) {
        url = '/api/ollama/v1/models';
      } else {
        url = `${baseUrl.replace(/\/$/, '')}/v1/models`;
      }

      const headers: Record<string, string> = {};
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return (data?.data || []).map((m: any) => m.id);
    }
  } catch (e) {
    console.warn('Failed to list models:', e);
    return [];
  }
}

// Legacy exports for backward compatibility
export const defaultOllamaBaseUrl = LLM_PRESETS.ollama.baseUrl;

