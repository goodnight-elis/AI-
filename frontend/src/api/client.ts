import type {
  ChatMode,
  Conversation,
  Message,
  Persona,
  Provider,
  ProviderPreset,
  StreamError,
  TestResult,
} from './types';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = String(body.detail);
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

const jsonInit = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const api = {
  // 会话
  listConversations: () => request<Conversation[]>('/api/conversations'),
  createConversation: (title: string, systemPrompt: string) =>
    request<Conversation>('/api/conversations', jsonInit('POST', { title, system_prompt: systemPrompt })),
  deleteConversation: (id: number) => request(`/api/conversations/${id}`, { method: 'DELETE' }),
  listMessages: (id: number) => request<Message[]>(`/api/conversations/${id}/messages`),
  rollback: (id: number, messageId: number) =>
    request(`/api/conversations/${id}/rollback`, jsonInit('POST', { message_id: messageId })),
  exportUrl: (id: number) => `/api/conversations/${id}/export`,

  // 模型配置
  listProviders: () => request<Provider[]>('/api/providers'),
  listPresets: () => request<ProviderPreset[]>('/api/providers/presets'),
  createProvider: (data: { name: string; base_url: string; api_key: string; model: string }) =>
    request<Provider>('/api/providers', jsonInit('POST', data)),
  updateProvider: (
    id: number,
    data: { name?: string; base_url?: string; api_key?: string; model?: string },
  ) => request<Provider>(`/api/providers/${id}`, jsonInit('PUT', data)),
  deleteProvider: (id: number) => request(`/api/providers/${id}`, { method: 'DELETE' }),
  activateProvider: (id: number) => request(`/api/providers/${id}/activate`, { method: 'POST' }),
  testProvider: (id: number) => request<TestResult>(`/api/providers/${id}/test`, { method: 'POST' }),
  testConfig: (data: { name: string; base_url: string; api_key: string; model: string }) =>
    request<TestResult>('/api/providers/test-config', jsonInit('POST', data)),

  // 角色预设
  listPersonas: () => request<Persona[]>('/api/prompts'),
};

export interface StreamHandlers {
  onDelta: (text: string) => void;
  onNotice: (notice: string) => void;
  onError: (error: StreamError) => void;
  onDone: () => void;
}

/**
 * 消费 SSE 流。返回终止状态：
 * - 'done'   正常收到 done 事件
 * - 'closed' 流提前结束（断网/服务端关闭），未收到 done -> 调用方决定是否重连
 * 'error' 事件会通过 handlers.onError 上报并同样返回 'closed'（错误已展示，不再重连由调用方判断）
 */
export async function streamChat(
  conversationId: number,
  userInput: string,
  mode: ChatMode,
  handlers: StreamHandlers,
  signal: AbortSignal,
): Promise<'done' | 'closed'> {
  const res = await fetch('/api/chat/stream', {
    ...jsonInit('POST', { conversation_id: conversationId, user_input: userInput, mode }),
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let sawError = false;
  let sawDone = false;

  const handleBlock = (block: string) => {
    let event = 'message';
    const dataLines: string[] = [];
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
      // ':' 开头为心跳注释行，忽略
    }
    if (!dataLines.length) return;
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(dataLines.join('\n'));
    } catch {
      return;
    }
    if (event === 'delta') {
      if (typeof data.text === 'string' && data.text) handlers.onDelta(data.text);
      if (typeof data.notice === 'string') handlers.onNotice(data.notice);
    } else if (event === 'error') {
      sawError = true;
      handlers.onError(data as unknown as StreamError);
    } else if (event === 'done') {
      sawDone = true;
      handlers.onDone();
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      if (block.trim()) handleBlock(block);
    }
  }
  if (buffer.trim()) handleBlock(buffer);

  // sawError 时同样返回 'closed'：错误已展示，是否重试由调用方决定
  return sawDone && !sawError ? 'done' : 'closed';
}
