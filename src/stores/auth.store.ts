import { create } from 'zustand';
import { friendlyError, isSupabaseConfigured, supabase } from '@/lib/supabase';
import { clearIdle, idleExpired, markActive } from '@/lib/session';

export type AuthStatus = 'unconfigured' | 'loading' | 'signedOut' | 'signedIn';

interface AuthState {
  status: AuthStatus;
  userId: string | null;
  email: string | null;
  /** true setelah membuka tautan reset/undangan — arahkan ke /atur-sandi */
  recovery: boolean;
  /** Pesan untuk halaman masuk, mis. alasan keluar otomatis */
  notice: string | null;
  init: () => void;
  signIn: (email: string, password: string) => Promise<string | null>;
  /** reason diisi bila keluar bukan atas permintaan pengguna (tampil di halaman masuk) */
  signOut: (reason?: string) => Promise<void>;
  /** Cabut sesi akun ini di semua perangkat lain; perangkat ini tetap masuk. */
  signOutOthers: () => Promise<string | null>;
  clearNotice: () => void;
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
  notice: null,

  init: () => {
    if (started || !supabase) return;
    started = true;
    supabase.auth.getSession().then(async ({ data }) => {
      const u = data.session?.user;
      // Dibuka lagi setelah melewati batas tidak aktif → keluar sebelum data dimuat.
      if (u && idleExpired()) {
        await supabase!.auth.signOut({ scope: 'local' });
        clearIdle();
        set({ status: 'signedOut', userId: null, email: null, notice: 'Anda keluar otomatis karena lama tidak menggunakan aplikasi. Silakan masuk kembali.' });
        return;
      }
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
    if (!error) (markActive(), set({ notice: null }));
    return error ? friendlyError(error) : null;
  },

  signOut: async (reason) => {
    // scope local: hanya perangkat ini; tetap berhasil walau sesi sudah dicabut di server.
    await supabase?.auth.signOut({ scope: 'local' });
    clearIdle();
    set({ status: 'signedOut', userId: null, email: null, notice: reason ?? null });
  },

  signOutOthers: async () => {
    if (!supabase) return 'Aplikasi belum terhubung ke Supabase.';
    const { error } = await supabase.auth.signOut({ scope: 'others' });
    return error ? friendlyError(error) : null;
  },

  clearNotice: () => set({ notice: null }),

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
