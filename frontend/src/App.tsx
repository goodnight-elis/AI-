import { useEffect, useState } from 'react';

import { ChatWindow } from './components/ChatWindow';
import { ModelSwitcher } from './components/ModelSwitcher';
import { ProviderSettings } from './components/ProviderSettings';
import { Sidebar } from './components/Sidebar';
import { useChatStore } from './store/chat';
import { useProviderStore } from './store/provider';

/** 深色模式：跟随系统 + 手动切换，localStorage 记忆 */
function useDarkMode() {
  const [dark, setDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);
  return { dark, toggle: () => setDark((v) => !v) };
}

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { dark, toggle } = useDarkMode();
  const initChat = useChatStore((s) => s.init);
  const loadProviders = useProviderStore((s) => s.loadAll);

  useEffect(() => {
    void initChat();
    void loadProviders();
  }, [initChat, loadProviders]);

  return (
    <div className="flex h-full flex-col bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <header className="flex items-center justify-between border-b border-gray-200 px-4 py-2.5 dark:border-gray-700">
        <h1 className="text-lg font-semibold">AI 对话助手</h1>
        <div className="flex items-center gap-2">
          <ModelSwitcher onOpenSettings={() => setSettingsOpen(true)} />
          <button
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
            onClick={() => setSettingsOpen(true)}
            title="模型设置"
          >
            ⚙ 设置
          </button>
          <button
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
            onClick={toggle}
            title="切换深色/浅色"
          >
            {dark ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <ChatWindow onOpenSettings={() => setSettingsOpen(true)} />
      </div>

      {settingsOpen && <ProviderSettings onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
