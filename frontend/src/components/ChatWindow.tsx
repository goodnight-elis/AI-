import { useEffect, useRef, useState } from 'react';

import type { Persona } from '../api/types';
import { useChatStore } from '../store/chat';

interface Props {
  onOpenSettings: () => void;
}

export function ChatWindow({ onOpenSettings }: Props) {
  const {
    currentId,
    messages,
    personas,
    streaming,
    streamText,
    error,
    notice,
    reconnecting,
    reconnectAttempt,
    disconnected,
    conversations,
    send,
    regenerate,
    continueGeneration,
    editResend,
    stop,
    dismissError,
  } = useChatStore();

  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 流式输出时保持滚动到底部
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, streamText, streaming]);

  const doSend = () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');
    void send(text);
  };

  const autoGrow = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(160, el.scrollHeight)}px`;
  };

  const currentConv = conversations.find((c) => c.id === currentId);
  const personaTag: Persona | undefined = currentConv?.system_prompt
    ? personas.find((p) => p.system_prompt === currentConv.system_prompt)
    : undefined;

  const lastMessage = messages[messages.length - 1];
  const keyError = error && (error.code === 'invalid_key' || error.code === 'no_provider' || error.code === 'insufficient_balance');

  return (
    <div className="flex h-full flex-1 flex-col">
      {/* 消息区 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {!currentId && (
          <div className="flex h-full items-center justify-center text-gray-400">
            点击左侧「新建会话」开始对话
          </div>
        )}
        {currentId && messages.length === 0 && !streaming && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-400">
            <span>{personaTag ? `当前角色：${personaTag.name}` : '发送第一条消息开始对话'}</span>
          </div>
        )}
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {messages.map((m, i) => (
            <MessageBubbleWithCheck
              key={m.id}
              message={m}
              isLast={i === messages.length - 1}
              onRegenerate={regenerate}
              onEditResend={editResend}
              disabled={streaming}
            />
          ))}

          {/* 流式中的助手气泡 */}
          {streaming && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-gray-100 px-4 py-2.5 dark:bg-gray-800">
                {streamText ? (
                  <StreamingBody content={streamText} />
                ) : (
                  <span className="text-sm text-gray-400">思考中…</span>
                )}
                <span className="stream-cursor" />
              </div>
            </div>
          )}

          {/* 重连进度提示 */}
          {streaming && reconnecting && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              连接中断，正在自动重连（第 {reconnectAttempt}/3 次），重连成功后将从断点续答…
            </div>
          )}

          {/* 错误卡片 */}
          {error && !streaming && (
            <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm dark:border-red-700 dark:bg-red-900/30">
              <div className="font-medium text-red-700 dark:text-red-300">{error.message}</div>
              <div className="mt-1 text-red-600/80 dark:text-red-400/80">{error.hint}</div>
              <div className="mt-2 flex gap-2">
                {disconnected && (
                  <button
                    className="rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700"
                    onClick={() => void continueGeneration()}
                  >
                    继续生成
                  </button>
                )}
                {lastMessage?.role === 'user' && !disconnected && (
                  <button
                    className="rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700"
                    onClick={() => void regenerate()}
                  >
                    重试
                  </button>
                )}
                {keyError && (
                  <button
                    className="rounded border border-red-400 px-3 py-1 text-xs text-red-600 hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-900/50"
                    onClick={onOpenSettings}
                  >
                    打开设置
                  </button>
                )}
                <button
                  className="rounded px-3 py-1 text-xs text-gray-500 hover:bg-red-100 dark:hover:bg-red-900/50"
                  onClick={dismissError}
                >
                  关闭
                </button>
              </div>
            </div>
          )}

          {/* 上下文截断提示 */}
          {notice && <div className="text-center text-xs text-gray-400">{notice}</div>}
        </div>
      </div>

      {/* 输入区 */}
      <div className="border-t border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <textarea
            ref={textareaRef}
            className="max-h-40 flex-1 resize-none rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-blue-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            placeholder="输入消息，Enter 发送，Shift+Enter 换行"
            value={input}
            rows={1}
            onChange={(e) => {
              setInput(e.target.value);
              autoGrow();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                doSend();
              }
            }}
          />
          {streaming ? (
            <button
              className="rounded-xl bg-gray-600 px-4 py-2 text-sm text-white hover:bg-gray-700"
              onClick={stop}
            >
              停止生成
            </button>
          ) : (
            <button
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-40"
              disabled={!input.trim() || !currentId}
              onClick={doSend}
            >
              发送
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* 拆出以便按最后一条消息判断「重新生成」按钮可见性 */
import { MessageBubble } from './MessageBubble';
import type { Message } from '../api/types';

function MessageBubbleWithCheck({
  message,
  isLast,
  onRegenerate,
  onEditResend,
  disabled,
}: {
  message: Message;
  isLast: boolean;
  onRegenerate: () => Promise<void>;
  onEditResend: (id: number, content: string) => Promise<void>;
  disabled: boolean;
}) {
  return (
    <MessageBubble
      message={message}
      canRegenerate={isLast && message.role === 'assistant'}
      onRegenerate={() => void onRegenerate()}
      onEditResend={(id, content) => void onEditResend(id, content)}
      disabled={disabled}
    />
  );
}

/** 流式气泡内容：纯文本渲染保证性能，结束后由 Markdown 接管 */
function StreamingBody({ content }: { content: string }) {
  return <div className="whitespace-pre-wrap text-[15px]">{content}</div>;
}
