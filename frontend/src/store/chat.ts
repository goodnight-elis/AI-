import { create } from 'zustand';

import { api, streamChat } from '../api/client';
import type { ChatMode, Conversation, Message, Persona, StreamError } from '../api/types';

const MAX_RECONNECT = 3;

interface ChatState {
  conversations: Conversation[];
  currentId: number | null;
  messages: Message[];
  personas: Persona[];
  search: string;
  streaming: boolean;
  streamText: string;
  error: StreamError | null;
  notice: string | null;
  /** 断线重连中（展示「正在重连 n/3」提示条） */
  reconnecting: boolean;
  reconnectAttempt: number;
  /** 重连耗尽或异常断开（展示「继续生成」兑底按钮） */
  disconnected: boolean;

  init: () => Promise<void>;
  setSearch: (s: string) => void;
  newConversation: (persona?: Persona) => Promise<void>;
  selectConversation: (id: number) => Promise<void>;
  removeConversation: (id: number) => Promise<void>;
  send: (text: string) => Promise<void>;
  regenerate: () => Promise<void>;
  continueGeneration: () => Promise<void>;
  editResend: (messageId: number, content: string) => Promise<void>;
  stop: () => void;
  dismissError: () => void;
}

let controller: AbortController | null = null;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const useChatStore = create<ChatState>((set, get) => {
  /** 拉取消息与会话列表（标题由后端异步总结，延迟再刷一次） */
  const refresh = async () => {
    const { currentId } = get();
    if (currentId == null) return;
    const [messages, conversations] = await Promise.all([
      api.listMessages(currentId),
      api.listConversations(),
    ]);
    set({ messages, conversations });
  };

  /** 核心：发起流式请求，处理断网自动重连（指数退避，最多 3 次，重连带 continue 模式续答） */
  const runStream = async (userInput: string, mode: ChatMode) => {
    const { currentId } = get();
    if (currentId == null) return;

    set({
      streaming: true,
      streamText: '',
      error: null,
      notice: null,
      reconnecting: false,
      reconnectAttempt: 0,
      disconnected: false,
    });

    let curInput = userInput;
    let curMode: ChatMode = mode;
    let aborted = false;

    for (let attempt = 0; attempt <= MAX_RECONNECT; attempt++) {
      if (attempt > 0) {
        set({ reconnecting: true, reconnectAttempt: attempt, streamText: '' });
        await sleep(1000 * 2 ** (attempt - 1)); // 1s / 2s / 4s 指数退避
        // 断点内容已由服务端落库，重连改为续答模式
        curMode = 'continue';
        curInput = '';
        await refresh().catch(() => undefined);
      }

      controller = new AbortController();
      let gotDone = false;
      let streamError: StreamError | null = null;
      try {
        const result = await streamChat(
          currentId,
          curInput,
          curMode,
          {
            onDelta: (text) => set((s) => ({ streamText: s.streamText + text })),
            onNotice: (notice) => set({ notice }),
            onError: (e) => (streamError = e),
            onDone: () => (gotDone = true),
          },
          controller.signal,
        );
        if (result === 'done' && gotDone) {
          set({ streaming: false, streamText: '', reconnecting: false, disconnected: false });
          await refresh();
          // 标题为后台生成，稍后补刷一次会话列表
          setTimeout(() => void refresh().catch(() => undefined), 2500);
          return;
        }
        // 收到结构化错误：不重连，直接展示错误卡片
        if (streamError) {
          set({ streaming: false, streamText: '', reconnecting: false, error: streamError });
          await refresh().catch(() => undefined);
          return;
        }
        // 流结束但没有 done -> 视为断线，进入下一轮重连
      } catch (e) {
        if ((e as Error).name === 'AbortError') {
          aborted = true;
          break;
        }
        // fetch 抛异常（网络不可达）同样走重连逻辑
      } finally {
        controller = null;
      }
    }

    if (aborted) {
      // 用户主动停止：不算断线
      set({ streaming: false, streamText: '', reconnecting: false, disconnected: false });
      await refresh().catch(() => undefined);
      return;
    }

    // 重连耗尽
    set({
      streaming: false,
      reconnecting: false,
      disconnected: true,
      error: {
        code: 'network_error',
        message: '连接已断开',
        hint: '已尝试自动重连 3 次。可点击「继续生成」从断点续答',
      },
    });
    await refresh().catch(() => undefined);
  };

  return {
    conversations: [],
    currentId: null,
    messages: [],
    personas: [],
    search: '',
    streaming: false,
    streamText: '',
    error: null,
    notice: null,
    reconnecting: false,
    reconnectAttempt: 0,
    disconnected: false,

    init: async () => {
      const [conversations, personas] = await Promise.all([api.listConversations(), api.listPersonas()]);
      set({ conversations, personas });
      if (get().currentId == null && conversations.length) {
        await get().selectConversation(conversations[0].id);
      }
    },

    setSearch: (search) => set({ search }),

    newConversation: async (persona) => {
      const conv = await api.createConversation('', persona?.system_prompt ?? '');
      set((s) => ({ conversations: [conv, ...s.conversations], currentId: conv.id, messages: [], streamText: '', error: null, disconnected: false }));
    },

    selectConversation: async (id) => {
      if (get().streaming) get().stop();
      const [messages, conversations] = await Promise.all([api.listMessages(id), api.listConversations()]);
      set({ currentId: id, messages, conversations, streamText: '', error: null, notice: null, disconnected: false, reconnecting: false });
    },

    removeConversation: async (id) => {
      await api.deleteConversation(id);
      const conversations = await api.listConversations();
      const wasCurrent = get().currentId === id;
      set({ conversations });
      if (wasCurrent) {
        if (conversations.length) {
          await get().selectConversation(conversations[0].id);
        } else {
          set({ currentId: null, messages: [] });
        }
      }
    },

    send: async (text) => {
      if (!get().currentId) {
        await get().newConversation();
      }
      await runStream(text, 'chat');
    },

    regenerate: async () => {
      await runStream('', 'regenerate');
    },

    continueGeneration: async () => {
      await runStream('', 'continue');
    },

    editResend: async (messageId, content) => {
      const { currentId } = get();
      if (currentId == null) return;
      await api.rollback(currentId, messageId);
      set((s) => ({ messages: s.messages.filter((m) => m.id < messageId) }));
      await runStream(content, 'chat');
    },

    stop: () => {
      controller?.abort();
    },

    dismissError: () => set({ error: null, disconnected: false }),
  };
});
