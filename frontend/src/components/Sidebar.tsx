import { useMemo, useState } from 'react';

import { api } from '../api/client';
import { useChatStore } from '../store/chat';
import { NewConversationModal } from './PersonaPicker';

export function Sidebar() {
  const { conversations, currentId, personas, search, setSearch, selectConversation, removeConversation, newConversation } =
    useChatStore();
  const [showNewModal, setShowNewModal] = useState(false);

  const filtered = useMemo(
    () => conversations.filter((c) => (c.title || '新会话').toLowerCase().includes(search.toLowerCase())),
    [conversations, search],
  );

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
      <div className="p-3">
        <button
          className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          onClick={() => setShowNewModal(true)}
        >
          ＋ 新建会话
        </button>
        <input
          className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-400 dark:border-gray-600 dark:bg-gray-800"
          placeholder="搜索会话…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {filtered.length === 0 && (
          <div className="px-3 py-4 text-center text-sm text-gray-400">暂无会话</div>
        )}
        {filtered.map((c) => (
          <div
            key={c.id}
            className={`group mb-1 flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm ${
              c.id === currentId
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200'
                : 'hover:bg-gray-200 dark:hover:bg-gray-800'
            }`}
            onClick={() => void selectConversation(c.id)}
          >
            <span className="min-w-0 flex-1 truncate">
              {c.title || '新会话'}
              {c.system_prompt && <span className="ml-1 text-xs text-gray-400">🎭</span>}
            </span>
            <span className="hidden shrink-0 gap-1 group-hover:flex">
              <a
                href={api.exportUrl(c.id)}
                download
                title="导出 Markdown"
                className="rounded px-1 text-gray-400 hover:text-gray-600"
                onClick={(e) => e.stopPropagation()}
              >
                ⬇
              </a>
              <button
                title="删除会话"
                className="rounded px-1 text-gray-400 hover:text-red-500"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`删除会话「${c.title || '新会话'}」？`)) void removeConversation(c.id);
                }}
              >
                ✕
              </button>
            </span>
          </div>
        ))}
      </div>

      {showNewModal && (
        <NewConversationModal
          personas={personas}
          onClose={() => setShowNewModal(false)}
          onCreate={(persona) => {
            setShowNewModal(false);
            void newConversation(persona ?? undefined);
          }}
        />
      )}
    </aside>
  );
}
