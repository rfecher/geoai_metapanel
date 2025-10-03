export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type ChatRequest = {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  options?: Record<string, unknown>;
};

export const defaultOllamaBaseUrl = 'http://localhost:11434';

export async function chatWithOllama(baseUrl: string, req: ChatRequest): Promise<string> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/chat`;
  try {
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
  } catch (e) {
    console.warn('Ollama error, using mock:', e);
    return '“(Offline fallback) Here is a concise perspective based on my persona.”';
  }
}

