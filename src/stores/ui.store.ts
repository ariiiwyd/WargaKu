import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ThemePref } from '@/types/models';

interface UiState {
  theme: ThemePref;
  sidebarCollapsed: boolean;
  setTheme: (t: ThemePref) => void;
  toggleSidebar: () => void;
}

const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

export function applyTheme(t: ThemePref) {
  const dark = t === 'dark' || (t === 'system' && !!media?.matches);
  document.documentElement.classList.toggle('dark', dark);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', dark ? '#0F172A' : '#2563EB'));
}

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      theme: 'system',
      sidebarCollapsed: false,
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    { name: 'wargaku-ui' },
  ),
);

media?.addEventListener('change', () => {
  if (useUi.getState().theme === 'system') applyTheme('system');
});
