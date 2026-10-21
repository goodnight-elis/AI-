import { create } from 'zustand';

import { api } from '../api/client';
import type { Provider, ProviderPreset, TestResult } from '../api/types';

interface ProviderState {
  providers: Provider[];
  presets: ProviderPreset[];
  loadAll: () => Promise<void>;
  create: (data: { name: string; base_url: string; api_key: string; model: string }) => Promise<void>;
  update: (id: number, data: Partial<Provider> & { api_key?: string }) => Promise<void>;
  remove: (id: number) => Promise<void>;
  activate: (id: number) => Promise<void>;
  test: (id: number) => Promise<TestResult>;
  testConfig: (data: { name: string; base_url: string; api_key: string; model: string }) => Promise<TestResult>;
}

export const useProviderStore = create<ProviderState>((set, get) => ({
  providers: [],
  presets: [],

  loadAll: async () => {
    const [providers, presets] = await Promise.all([api.listProviders(), api.listPresets()]);
    set({ providers, presets });
  },

  create: async (data) => {
    await api.createProvider(data);
    await get().loadAll();
  },

  update: async (id, data) => {
    await api.updateProvider(id, {
      name: data.name,
      base_url: data.base_url,
      api_key: data.api_key,
      model: data.model,
    });
    await get().loadAll();
  },

  remove: async (id) => {
    await api.deleteProvider(id);
    await get().loadAll();
  },

  activate: async (id) => {
    await api.activateProvider(id);
    await get().loadAll();
  },

  test: async (id) => api.testProvider(id),

  testConfig: async (data) => api.testConfig(data),
}));
