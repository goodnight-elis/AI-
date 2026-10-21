import { useState } from 'react';

import type { Message } from '../api/types';
import { MarkdownRenderer } from './MarkdownRenderer';

interface Props {
  message: Message;
  /** 是否允许「重新生成」（仅最后一条助手消息） */
  canRegenerate: boolean;
  onRegenerate: () => void;
  onEditResend: (messageId: number, content: string) => void;
  disabled: boolean;
}

export function MessageBubble({ message, canRegenerate, onRegenerate, onEditResend, disabled }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const copy = () => {
    void navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const actionBtn =
    'rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700';

  if (editing) {
    return (
      <div className="flex flex-col items-end gap-1">
        <textarea
          className="w-full max-w-[80%] rounded-lg border border-blue-400 bg-white p-3 text-sm outline-none dark:bg-gray-800 dark:text-gray-100"
          value={draft}
          rows={Math.min(8, draft.split('\n').length + 1)}
          onChange={(e) => setDraft(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={disabled || !draft.trim()}
            onClick={() => {
              setEditing(false);
              onEditResend(message.id, draft);
            }}
          >
            保存并重发
          </button>
          <button
            className="rounded bg-gray-200 px-3 py-1 text-xs dark:bg-gray-700 dark:text-gray-200"
            onClick={() => {
              setEditing(false);
              setDraft(message.content);
            }}
          >
            取消
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`group flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] ${isUser ? 'order-1' : ''}`}>
        <div
          className={
            isUser
              ? 'whitespace-pre-wrap rounded-2xl rounded-br-sm bg-blue-600 px-4 py-2.5 text-sm text-white'
              : 'rounded-2xl rounded-bl-sm bg-gray-100 px-4 py-2.5 dark:bg-gray-800'
          }
        >
          {isUser ? message.content : <MarkdownRenderer content={message.content} />}
        </div>
        <div className={`mt-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 ${isUser ? 'justify-end' : ''}`}>
          <button className={actionBtn} onClick={copy}>
            {copied ? '已复制' : '复制'}
          </button>
          {isUser && (
            <button className={actionBtn} disabled={disabled} onClick={() => setEditing(true)}>
              编辑
            </button>
          )}
          {!isUser && canRegenerate && (
            <button className={actionBtn} disabled={disabled} onClick={onRegenerate}>
              重新生成
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
