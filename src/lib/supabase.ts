import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** false bila .env belum berisi URL & anon key Supabase — aplikasi menampilkan petunjuk konfigurasi. */
export const isSupabaseConfigured = Boolean(url && key);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;

export function sb(): SupabaseClient {
  if (!supabase) throw new Error('Aplikasi belum terhubung ke Supabase. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY.');
  return supabase;
}

/** Terjemahkan galat Supabase/Postgres menjadi kalimat yang dimengerti pengguna. */
export function friendlyError(e: unknown): string {
  const err = e as { message?: string; code?: string; details?: string } | undefined;
  const msg = err?.message ?? (typeof e === 'string' ? e : '');
  const code = err?.code ?? '';
  if (/row-level security|permission denied/i.test(msg)) return 'Anda tidak memiliki izin untuk tindakan ini.';
  if (code === '42501') return msg || 'Anda tidak memiliki izin untuk tindakan ini.';
  if (code === '23505' || /duplicate key/i.test(msg)) return 'Data yang sama sudah ada.';
  if (code === '23503') return 'Data terkait tidak ditemukan atau berbeda RT.';
  if (code === '23514') return 'Data tidak memenuhi aturan validasi.';
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return 'Tidak ada koneksi internet. Periksa jaringan Anda lalu coba lagi.';
  if (/Invalid login credentials/i.test(msg)) return 'Email atau kata sandi salah.';
  if (/Email not confirmed/i.test(msg)) return 'Email belum dikonfirmasi. Buka tautan yang dikirim ke email Anda.';
  if (/JWT expired|session/i.test(msg)) return 'Sesi berakhir. Silakan masuk kembali.';
  return msg || 'Terjadi kesalahan. Coba lagi.';
}

/** Signed URL berumur pendek untuk bucket privat (PRD §5, §7.1). */
export async function signedUrl(bucket: string, path: string, seconds = 60) {
  const { data, error } = await sb().storage.from(bucket).createSignedUrl(path, seconds);
  if (error) throw error;
  return data.signedUrl;
}
