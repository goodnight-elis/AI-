import { useState } from 'react';

import type { Persona } from '../api/types';

interface Props {
  personas: Persona[];
  value: Persona | null;
  onChange: (p: Persona | null) => void;
}

/** 新建会话时的角色预设选择器 */
export function PersonaPicker({ personas, value, onChange }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        className={`rounded-lg border px-3 py-2 text-left text-sm ${
          value === null
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
            : 'border-gray-300 hover:border-blue-400 dark:border-gray-600'
        }`}
        onClick={() => onChange(null)}
      >
        <div className="font-medium">无预设</div>
        <div className="text-xs text-gray-500">不带系统提示词</div>
      </button>
      {personas.map((p) => (
        <button
          key={p.id}
          type="button"
          className={`rounded-lg border px-3 py-2 text-left text-sm ${
            value?.id === p.id
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
              : 'border-gray-300 hover:border-blue-400 dark:border-gray-600'
          }`}
          onClick={() => onChange(p)}
        >
          <div className="font-medium">{p.name}</div>
          <div className="truncate text-xs text-gray-500">{p.description}</div>
        </button>
      ))}
    </div>
  );
}

/** 新建会话弹窗（含角色选择） */
export function NewConversationModal({
  personas,
  onCreate,
  onClose,
}: {
  personas: Persona[];
  onCreate: (persona: Persona | null) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Persona | null>(null);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-[90%] max-w-lg rounded-xl bg-white p-5 shadow-xl dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">新建会话</h2>
          <button className="text-gray-400 hover:text-gray-600" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="mb-2 text-sm text-gray-500">选择角色预设（可跳过）：</p>
        <PersonaPicker personas={personas} value={selected} onChange={setSelected} />
        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded-lg px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700" onClick={onClose}>
            取消
          </button>
          <button
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
            onClick={() => onCreate(selected)}
          >
            创建
          </button>
        </div>
      </div>
    </div>
  );
}
