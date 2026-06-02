// ─────────────────────────────────────────────────────────────
// Tarjama — Settings Store (persisted to localStorage)
// ─────────────────────────────────────────────────────────────

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CertificationDetails, LLMConfig, LLMProvider } from '../types';
import { getDefaultModel } from '../utils/constants';

// ── State Shape ─────────────────────────────────────────────

interface SettingsState {
  llmConfig: LLMConfig;
  theme: 'dark' | 'light';
  certification: CertificationDetails | null;
}

// ── Actions ─────────────────────────────────────────────────

interface SettingsActions {
  setProvider: (provider: LLMProvider) => void;
  setApiKey: (apiKey: string) => void;
  setModel: (model: string) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  toggleTheme: () => void;
  setCertification: (cert: CertificationDetails | null) => void;
  resetSettings: () => void;
}

// ── Defaults ────────────────────────────────────────────────

const DEFAULT_SETTINGS: SettingsState = {
  llmConfig: {
    provider: 'openai',
    apiKey: '',
    model: 'gpt-4o',
  },
  theme: 'dark',
  certification: null,
};

// ── Store ───────────────────────────────────────────────────

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,

      setProvider: (provider: LLMProvider) =>
        set((state) => ({
          llmConfig: {
            ...state.llmConfig,
            provider,
            model: getDefaultModel(provider),
          },
        })),

      setApiKey: (apiKey: string) =>
        set((state) => ({
          llmConfig: {
            ...state.llmConfig,
            apiKey,
          },
        })),

      setModel: (model: string) =>
        set((state) => ({
          llmConfig: {
            ...state.llmConfig,
            model,
          },
        })),

      setTheme: (theme: 'dark' | 'light') => set({ theme }),

      toggleTheme: () =>
        set((state) => ({
          theme: state.theme === 'dark' ? 'light' : 'dark',
        })),

      setCertification: (cert: CertificationDetails | null) =>
        set({ certification: cert }),

      resetSettings: () => set({ ...DEFAULT_SETTINGS }),
    }),
    {
      name: 'tarjama-settings',
      version: 1,
    },
  ),
);
