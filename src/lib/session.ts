/**
 * Batas waktu sesi saat tidak digunakan (di sisi aplikasi; fitur server Supabase
 * untuk ini hanya ada di paket berbayar).
 * - Waktu aktivitas terakhir disimpan di localStorage agar berlaku lintas tab dan
 *   tetap diperiksa saat aplikasi dibuka kembali setelah ditutup.
 * - Pengurus memegang data sensitif (NIK, No. KK, keuangan) → batas lebih pendek.
 */
import type { Role } from '@/types/models';

const LAST = 'wargaku:last-active';
const LIMIT = 'wargaku:idle-limit';
const MIN = 60_000;
const DAY = 24 * 60 * MIN;

/** Peringatan muncul sekian lama sebelum keluar otomatis. */
export const IDLE_WARN_MS = 60_000;

export const idleLimitMs = (role: Role) => (role === 'warga' ? 7 * DAY : 30 * MIN);
export const idleLabel = (role: Role) => (role === 'warga' ? '7 hari' : '30 menit');

const read = (k: string) => {
  try {
    const v = Number(localStorage.getItem(k));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
};
const write = (k: string, v: number) => {
  try {
    localStorage.setItem(k, String(v));
  } catch {
    /* mode privat / penyimpanan diblokir: batas tetap berjalan selama tab terbuka */
  }
};

export const lastActive = () => read(LAST);
export const markActive = (t = Date.now()) => write(LAST, t);
export const setIdleLimit = (ms: number) => write(LIMIT, ms);

/** true bila sesi tersimpan sudah melewati batas tidak aktif (dipakai saat aplikasi dibuka). */
export function idleExpired(now = Date.now()) {
  const last = read(LAST);
  const limit = read(LIMIT);
  return !!last && !!limit && now - last > limit;
}

export function clearIdle() {
  try {
    localStorage.removeItem(LAST);
    localStorage.removeItem(LIMIT);
  } catch {
    /* abaikan */
  }
}
