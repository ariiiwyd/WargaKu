import { create } from 'zustand';
import { friendlyError, isSupabaseConfigured, supabase } from '@/lib/supabase';

export type AuthStatus = 'unconfigured' | 'loading' | 'signedOut' | 'signedIn';

interface AuthState {
  status: AuthStatus;
  userId: string | null;
  email: string | null;
  /** true setelah membuka tautan reset/undangan — arahkan ke /atur-sandi */
  recovery: boolean;
  init: () => void;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  sendReset: (email: string) => Promise<string | null>;
  setPassword: (password: string) => Promise<string | null>;
  clearRecovery: () => void;
}

let started = false;

/** Sesi dipegang Supabase Auth; store ini hanya mencerminkannya. */
export const useAuth = create<AuthState>()((set) => ({
  status: isSupabaseConfigured ? 'loading' : 'unconfigured',
  userId: null,
  email: null,
  recovery: typeof window !== 'undefined' && /type=(recovery|invite)/.test(window.location.hash),

  init: () => {
    if (started || !supabase) return;
    started = true;
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      set({ status: u ? 'signedIn' : 'signedOut', userId: u?.id ?? null, email: u?.email ?? null });
    });
    supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user;
      set((s) => ({
        status: u ? 'signedIn' : 'signedOut',
        userId: u?.id ?? null,
        email: u?.email ?? null,
        recovery: event === 'PASSWORD_RECOVERY' ? true : s.recovery,
      }));
    });
  },

  signIn: async (email, password) => {
    if (!supabase) return 'Aplikasi belum terhubung ke Supabase.';
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error ? friendlyError(error) : null;
  },

  signOut: async () => {
    await supabase?.auth.signOut();
    set({ status: 'signedOut', userId: null, email: null });
  },

  sendReset: async (email) => {
    if (!supabase) return 'Aplikasi belum terhubung ke Supabase.';
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/atur-sandi` });
    return error ? friendlyError(error) : null;
  },

  setPassword: async (password) => {
    if (!supabase) return 'Aplikasi belum terhubung ke Supabase.';
    const { error } = await supabase.auth.updateUser({ password });
    if (!error) set({ recovery: false });
    return error ? friendlyError(error) : null;
  },

  clearRecovery: () => set({ recovery: false }),
}));
