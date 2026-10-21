import { useEffect, useRef, useState } from 'react';

import { useProviderStore } from '../store/provider';

/** 顶栏模型切换下拉：展示所有 Provider（名称+模型），点击即切换激活 */
export function ModelSwitcher({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { providers, activate } = useProviderStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = providers.find((p) => p.is_active);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
        onClick={() => setOpen((v) => !v)}
      >
        <span className={active ? '' : 'text-amber-500'}>
          {active ? `${active.name} · ${active.model}` : '⚠ 未配置模型'}
        </span>
        <span className="text-xs text-gray-400">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-1 w-64 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
          {providers.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-400">暂无模型配置</div>
          )}
          {providers.map((p) => (
            <button
              key={p.id}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => {
                void activate(p.id);
                setOpen(false);
              }}
            >
              <span className="truncate">
                {p.name}
                <span className="ml-1 text-xs text-gray-400">{p.model}</span>
              </span>
              {p.is_active && <span className="text-blue-500">✓</span>}
            </button>
          ))}
          <div className="border-t border-gray-200 dark:border-gray-700">
            <button
              className="w-full px-3 py-2 text-left text-sm text-blue-600 hover:bg-gray-100 dark:text-blue-400 dark:hover:bg-gray-700"
              onClick={() => {
                setOpen(false);
                onOpenSettings();
              }}
            >
              ⚙ 管理模型配置…
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
