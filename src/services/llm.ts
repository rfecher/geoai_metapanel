import {
  shouldUseBackup,
  isHybridMode,
  shouldUseBackupInHybridMode,
  getBackupResponseWithFallback,
  recordSuccess,
  recordFailure,
  getBackupMatchConfidence
} from './backup.js';

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

export type ChatResponse = {
  content: string;
  isBackup: boolean; // True if response came from backup/demo system, false if from live LLM
};

export type LLMProvider = 'ollama' | 'lmstudio' | 'openai' | 'custom';

export type LLMConfig = {
  provider: LLMProvider;
  baseUrl: string;
  apiKey?: string; // For OpenAI-compatible APIs that require auth
  defaultModel: string;
};
// Environment helper that works in both Vite (browser) and Node CLI
function getIsDev(): boolean {
  try {
    // Vite/renderer
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && (import.meta as any)?.env && typeof (import.meta as any).env.DEV !== 'undefined') {
      // @ts-ignore
      return Boolean((import.meta as any).env.DEV);
    }
  } catch {}
  try {
    // Node CLI fallback
    // @ts-ignore
    return typeof process !== 'undefined' ? process.env.NODE_ENV !== 'production' : false;
  } catch {}
  return false;
}


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
  mlx: {
    provider: 'openai',
    baseUrl: 'http://127.0.0.1:8080',
    defaultModel: 'mlx-community/Llama-3.2-3B-Instruct-4bit',
  },
};

// Remove MLX-LM channel tags like <|analysis|>, <|final|>, etc. from content
function stripMLXChannelTags(s: string): string {
  return (s || '').replace(/<\|[^>]+?\|>/g, '');
}

// Extract only the persona's spoken dialog from LLM responses that may include analysis/final channel tags
function extractFinalDialog(raw: string): string {
  let s = String(raw ?? '');

  // Remove analysis blocks like: <|channel|>analysis<|message|> ... <|end|>
  s = s.replace(/<\|channel\|>analysis<\|message\|>[\s\S]*?<\|end\|>/g, '');

  // Find the last final segment start: optionally prefixed with <|start|>assistant
  const finalMarker = /(?:<\|start\|>assistant)?<\|channel\|>final<\|message\|>/g;
  let lastIndex = -1;
  let m: RegExpExecArray | null;
  while ((m = finalMarker.exec(s)) !== null) {
    lastIndex = m.index + m[0].length;
  }

  let out = lastIndex !== -1 ? s.slice(lastIndex) : s;

  // Cut at the next tag-like token if present
  const nextTagIdx = out.indexOf('<|');
  if (nextTagIdx !== -1) {
    out = out.slice(0, nextTagIdx);
  }

  // Remove any residual tag tokens like <|...|>
  out = out.replace(/<\|[^>]+?\|>/g, '');

  // Trim and normalize
  out = out.trim();

  // Strip surrounding quotes (some fallbacks may return quoted text)
  if ((out.startsWith('"') && out.endsWith('"')) || (out.startsWith("'") && out.endsWith("'"))) {
    out = out.slice(1, -1).trim();
  }

  return out;
}



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
export async function chatWithLLM(config: LLMConfig, req: ChatRequest): Promise<ChatResponse> {
  const { provider, baseUrl, apiKey } = config;

  // Extract user question for backup/hybrid mode checks
  const userQuestion = req.personaId ? extractUserQuestion(req.messages) : '';

  // Bypass LLM entirely for recognized pre-generated demo questions (always use backup)
  if (req.personaId) {
    const match = getBackupMatchConfidence(userQuestion);
    if (match?.questionId && match.confidence >= 0.75) {
      console.log('🎯 Recognized demo question - using pre-generated response (no LLM)');
      const content = await getBackupResponseWithFallback(userQuestion, req.personaId, false);
      return { content, isBackup: true };
    }
  }


  // Check if backup mode is active (always or auto-enabled)
  if (shouldUseBackup() && req.personaId) {
    console.log('📦 Backup mode active - using pre-generated response');
    const content = await getBackupResponseWithFallback(userQuestion, req.personaId, false);
    return { content, isBackup: true };
  }

  // Check if hybrid mode is active and question matches strongly
  if (isHybridMode() && req.personaId && shouldUseBackupInHybridMode(userQuestion)) {
    console.log('🔀 Hybrid mode: Strong match detected - using pre-generated response');
    const content = await getBackupResponseWithFallback(userQuestion, req.personaId, false);
    return { content, isBackup: true };
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
    return { content: response, isBackup: false };
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
      const content = await getBackupResponseWithFallback(userQuestion, req.personaId, false);
      return { content, isBackup: true };
    }

    // Ultimate fallback if no persona ID
    return { content: '"(Offline fallback) Here is a concise perspective based on my persona."', isBackup: true };
  }
}

/**
 * Streaming chat function that yields partial responses as they arrive
 * Includes automatic backup/fallback support when live models are unavailable
 * Supports hybrid mode: uses pre-generated responses for strong matches, live LLM otherwise
 * @param config LLM configuration
 * @param req Chat request
 * @param onChunk Callback invoked for each chunk of text
 * @returns Promise that resolves with the complete response and metadata


 */
export async function chatWithLLMStreaming(
  config: LLMConfig,
  req: ChatRequest,
  onChunk: (chunk: string) => void
): Promise<ChatResponse> {
  const { provider, baseUrl, apiKey } = config;

  // Extract user question for backup/hybrid mode checks
  const userQuestion = req.personaId ? extractUserQuestion(req.messages) : '';

  // Bypass LLM entirely for recognized pre-generated demo questions (always use backup, streaming)
  if (req.personaId) {
    const match = getBackupMatchConfidence(userQuestion);
    if (match?.questionId && match.confidence >= 0.75) {
      console.log('🎯 Recognized demo question - using pre-generated response (stream, no LLM)');
      const content = await getBackupResponseWithFallback(userQuestion, req.personaId, true, onChunk);
      return { content, isBackup: true };
    }
  }


  // Check if backup mode is active (always or auto-enabled)
  if (shouldUseBackup() && req.personaId) {
    console.log('📦 Backup mode active - using pre-generated response with streaming simulation');
    const content = await getBackupResponseWithFallback(userQuestion, req.personaId, true, onChunk);
    return { content, isBackup: true };
  }

  // Check if hybrid mode is active and question matches strongly
  if (isHybridMode() && req.personaId && shouldUseBackupInHybridMode(userQuestion)) {
    console.log('🔀 Hybrid mode: Strong match detected - using pre-generated response with streaming');
    const content = await getBackupResponseWithFallback(userQuestion, req.personaId, true, onChunk);
    return { content, isBackup: true };
  }

  // If hybrid mode but weak/no match, fall through to live LLM
  if (isHybridMode() && req.personaId) {
    console.log('🔀 Hybrid mode: Weak/no match - using live LLM streaming');
    // Continue to live LLM below
  }

  // Filter streaming chunks to only emit the 'final' dialog channel
  const __streamFilterState = { buffer: '', inFinal: false } as { buffer: string; inFinal: boolean };
  const filteredOnChunk = (chunk: string) => {
    // Accumulate to handle markers that may split across chunks
    __streamFilterState.buffer += chunk;

    if (!__streamFilterState.inFinal) {
      const m = __streamFilterState.buffer.match(/(?:<\|start\|>assistant)?<\|channel\|>final<\|message\|>/);
      if (m && m.index !== undefined) {
        __streamFilterState.inFinal = true;
        const after = __streamFilterState.buffer.slice(m.index + m[0].length);
        const cleaned = after.replace(/<\|[^>]+?\|>/g, '');
        if (cleaned) onChunk(cleaned);
        __streamFilterState.buffer = '';
      }
      return; // still in analysis channel; do not emit
    }

    // Already in final: strip any residual tag tokens and emit
    const cleaned = chunk.replace(/<\|[^>]+?\|>/g, '');
    if (cleaned) onChunk(cleaned);
  };

  try {
    let response: string;
    if (provider === 'ollama') {
      response = await chatWithOllamaStreaming(baseUrl, req, filteredOnChunk);
    } else {
      // LM Studio, OpenAI, and other OpenAI-compatible APIs
      response = await chatWithOpenAICompatibleStreaming(baseUrl, apiKey, req, filteredOnChunk);
    }

    // Record success to reset failure counter
    recordSuccess();
    return { content: response, isBackup: false };
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
      const content = await getBackupResponseWithFallback(userQuestion, req.personaId, true, onChunk);
      return { content, isBackup: true };
    }

    // Ultimate fallback if no persona ID
    const fallback = '"(Offline fallback) Here is a concise perspective based on my persona."';
    onChunk(fallback);
    return { content: fallback, isBackup: true };
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
  return extractFinalDialog(content);
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
  return extractFinalDialog(fullContent);
}

/**
 * OpenAI-compatible chat implementation (works with LM Studio, OpenAI, etc.)
 */
async function chatWithOpenAICompatible(
  baseUrl: string,
  apiKey: string | undefined,
  req: ChatRequest
): Promise<string> {
  // Use Vite dev proxy only in browser; Node CLI should hit provider directly
  let url: string;
  const isDev = getIsDev();
  const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
  const useProxy = isDev && isBrowser;

  if (useProxy && baseUrl.includes('localhost:1234')) {
    // LM Studio - browser dev proxy
    url = '/api/lmstudio/v1/chat/completions';
  } else if (useProxy && baseUrl.includes('localhost:11434')) {
    // Ollama - browser dev proxy
    url = '/api/ollama/v1/chat/completions';
  } else if (useProxy && (baseUrl.includes('localhost:8080') || baseUrl.includes('127.0.0.1:8080'))) {
    // MLX-LM - browser dev proxy
    url = '/api/mlxlm/v1/chat/completions';
  } else {
    // Direct URL for Node CLI or production
    url = `${baseUrl.replace(/\/$/, '')}/v1/chat/completions`;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add authorization header if API key is provided
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  // Sanitize MLX-LM channel tags in messages when targeting MLX
  const isMLX = baseUrl.includes('127.0.0.1:8080') || baseUrl.includes('localhost:8080');
  const messages = isMLX
    ? req.messages.map(m => ({ ...m, content: stripMLXChannelTags(m.content) }))
    : req.messages;

  console.log('🔵 Sending request to:', url, useProxy ? '(via proxy)' : '(direct)');
  console.log('🔵 Original baseUrl:', baseUrl);
  console.log('🔵 Model:', req.model);
  console.log('🔵 Messages:', messages.length, 'messages');
  console.log('🔵 Request body:', JSON.stringify({
    model: req.model,
    messages,
    stream: false,
    ...req.options,
  }, null, 2));

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: req.model,
      messages,
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
  return extractFinalDialog(content);
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
  // Use Vite dev proxy only in browser; Node CLI should hit provider directly
  let url: string;
  const isDev = getIsDev();
  const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
  const useProxy = isDev && isBrowser;

  if (useProxy && baseUrl.includes('localhost:1234')) {
    // LM Studio - browser dev proxy
    url = '/api/lmstudio/v1/chat/completions';
  } else if (useProxy && baseUrl.includes('localhost:11434')) {
    // Ollama - browser dev proxy
    url = '/api/ollama/v1/chat/completions';
  } else if (useProxy && (baseUrl.includes('localhost:8080') || baseUrl.includes('127.0.0.1:8080'))) {
    // MLX-LM - browser dev proxy
    url = '/api/mlxlm/v1/chat/completions';
  } else {
    // Direct URL for Node CLI or production
    url = `${baseUrl.replace(/\/$/, '')}/v1/chat/completions`;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add authorization header if API key is provided
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  // Sanitize MLX-LM channel tags in messages when targeting MLX
  const isMLX = baseUrl.includes('127.0.0.1:8080') || baseUrl.includes('localhost:8080');
  const messages = isMLX
    ? req.messages.map(m => ({ ...m, content: stripMLXChannelTags(m.content) }))
    : req.messages;

  console.log('🔵 Sending streaming request to:', url, useProxy ? '(via proxy)' : '(direct)');

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: req.model,
      messages,
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
  return extractFinalDialog(fullContent);
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
  const isDev = getIsDev();
  const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
  const useProxy = isDev && isBrowser;

  try {
    if (provider === 'ollama') {
      let url: string;
      if (useProxy && baseUrl.includes('localhost:11434')) {
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
      if (useProxy && baseUrl.includes('localhost:1234')) {
        url = '/api/lmstudio/v1/models';
      } else if (useProxy && baseUrl.includes('localhost:11434')) {
        url = '/api/ollama/v1/models';
      } else if (useProxy && (baseUrl.includes('localhost:8080') || baseUrl.includes('127.0.0.1:8080'))) {
        url = '/api/mlxlm/v1/models';
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

