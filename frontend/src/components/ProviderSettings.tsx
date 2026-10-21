import { useEffect, useState } from 'react';

import type { Provider, TestResult } from '../api/types';
import { useProviderStore } from '../store/provider';

const emptyForm = { name: '', base_url: '', api_key: '', model: '' };

/**
 * 模型设置弹窗：
 * - 左侧厂商预设一键填充（base_url/模型），用户只需粘 Key
 * - 保存前可调 /test-config 验证连通性
 * - 下方列表支持激活/编辑/测试/删除，Key 脱敏展示
 */
export function ProviderSettings({ onClose }: { onClose: () => void }) {
  const { providers, presets, loadAll, create, update, remove, activate, test, testConfig } =
    useProviderStore();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [rowTest, setRowTest] = useState<Record<number, TestResult | 'ing'>>({});

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const fillPreset = (base_url: string, name: string, model: string) => {
    setForm((f) => ({ ...f, base_url, name, model }));
  };

  const startEdit = (p: Provider) => {
    setEditingId(p.id);
    setForm({ name: p.name, base_url: p.base_url, api_key: p.api_key_masked, model: p.model });
    setTestResult(null);
  };

  const save = async () => {
    if (!form.name.trim() || !form.base_url.trim() || !form.model.trim()) return;
    if (editingId != null) {
      await update(editingId, form);
    } else {
      await create(form);
    }
    setForm(emptyForm);
    setEditingId(null);
    setTestResult(null);
  };

  const runTestConfig = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await testConfig(form);
      setTestResult(r);
    } finally {
      setTesting(false);
    }
  };

  const inputCls =
    'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 dark:border-gray-600 dark:bg-gray-900';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-[92%] max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 dark:border-gray-700">
          <h2 className="text-lg font-semibold">模型配置</h2>
          <button className="text-gray-400 hover:text-gray-600" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid gap-6 md:grid-cols-[200px_1fr]">
            {/* 厂商预设一键填充 */}
            <div>
              <h3 className="mb-2 text-sm font-medium text-gray-500">厂商预设（点击填充）</h3>
              <div className="flex flex-col gap-1">
                {presets.map((p) => (
                  <button
                    key={p.name}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-left text-sm hover:border-blue-400 hover:bg-blue-50 dark:border-gray-600 dark:hover:bg-blue-900/20"
                    onClick={() => fillPreset(p.base_url, p.name, p.default_model)}
                    title={`Key 获取：${p.doc_url}`}
                  >
                    <div className="font-medium">{p.name}</div>
                    <div className="truncate text-xs text-gray-400">{p.default_model}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 表单 */}
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  className={inputCls}
                  placeholder="配置名称，如：我的 DeepSeek"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <input
                  className={inputCls}
                  placeholder="模型名，如 deepseek-chat"
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                />
              </div>
              <input
                className={inputCls}
                placeholder="Base URL（OpenAI 兼容接口地址）"
                value={form.base_url}
                onChange={(e) => setForm({ ...form, base_url: e.target.value })}
              />
              <input
                className={inputCls}
                placeholder="API Key（编辑时保留 **** 即不修改）"
                value={form.api_key}
                type="password"
                onChange={(e) => setForm({ ...form, api_key: e.target.value })}
              />
              <div className="flex items-center gap-2">
                <button
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                  onClick={() => void save()}
                  disabled={!form.name.trim() || !form.base_url.trim() || !form.model.trim()}
                >
                  {editingId != null ? '保存修改' : '新增配置'}
                </button>
                <button
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700 disabled:opacity-50"
                  onClick={() => void runTestConfig()}
                  disabled={testing || !form.base_url.trim() || !form.model.trim()}
                >
                  {testing ? '测试中…' : '测试连通性'}
                </button>
                {editingId != null && (
                  <button
                    className="rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => {
                      setEditingId(null);
                      setForm(emptyForm);
                      setTestResult(null);
                    }}
                  >
                    取消编辑
                  </button>
                )}
              </div>
              {testResult && (
                <div
                  className={`rounded-lg px-3 py-2 text-sm ${
                    testResult.ok
                      ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                      : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                  }`}
                >
                  {testResult.ok ? '✓ 连通性测试成功' : `✗ ${testResult.message}（${testResult.hint}）`}
                </div>
              )}
            </div>
          </div>

          {/* 已有配置列表 */}
          <div className="mt-6">
            <h3 className="mb-2 text-sm font-medium text-gray-500">已保存的配置</h3>
            {providers.length === 0 && <div className="text-sm text-gray-400">暂无配置，可从左侧预设开始</div>}
            <div className="flex flex-col gap-2">
              {providers.map((p) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                    p.is_active
                      ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-medium">
                      {p.is_active && <span className="mr-1 text-blue-500">●</span>}
                      {p.name}
                      <span className="ml-2 text-xs text-gray-400">{p.model}</span>
                    </div>
                    <div className="truncate text-xs text-gray-400">
                      {p.base_url} · Key: {p.api_key_masked || '未设置'}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 text-xs">
                    {!p.is_active && (
                      <button className="rounded px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700" onClick={() => void activate(p.id)}>
                        激活
                      </button>
                    )}
                    <button
                      className="rounded px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                      onClick={() => {
                        setRowTest((m) => ({ ...m, [p.id]: 'ing' }));
                        void test(p.id).then((r) => setRowTest((m) => ({ ...m, [p.id]: r })));
                      }}
                    >
                      测试
                    </button>
                    <button className="rounded px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700" onClick={() => startEdit(p)}>
                      编辑
                    </button>
                    <button
                      className="rounded px-2 py-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"
                      onClick={() => {
                        if (confirm(`删除配置「${p.name}」？`)) void remove(p.id);
                      }}
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {Object.entries(rowTest).map(([id, r]) =>
              typeof r === 'string' ? null : (
                <div
                  key={id}
                  className={`mt-2 rounded-lg px-3 py-2 text-sm ${
                    r.ok
                      ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                      : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                  }`}
                >
                  {r.ok ? '✓ 连通性测试成功' : `✗ ${r.message}（${r.hint}）`}
                </div>
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
