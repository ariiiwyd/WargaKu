import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  userId: string | null;
  login: (userId: string) => void;
  logout: () => void;
}

/**
 * Sesi demo. Pada mode Supabase, sesi dipegang Supabase Auth
 * (lihat services/auth.service.ts) dan userId diisi dari auth.uid().
 */
export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      userId: null,
      login: (userId) => set({ userId }),
      logout: () => set({ userId: null }),
    }),
    { name: 'wargaku-auth' },
  ),
);
