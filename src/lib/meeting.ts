import type { Activity, MeetingMode } from '@/types/models';

const MIN = 60_000;

/** Sama dengan public.meeting_is_live di database: 15 menit sebelum mulai s.d. 30 menit setelah selesai, atau selama status "ongoing". */
export function isMeetingLive(a: Activity, now = Date.now()) {
  if (a.meeting_mode === 'offline' || !a.meeting_url || a.status === 'cancelled' || a.status === 'done') return false;
  if (a.status === 'ongoing') return true;
  const start = new Date(a.start_at).getTime();
  const end = a.end_at ? new Date(a.end_at).getTime() : start + 180 * MIN;
  return now >= start - 15 * MIN && now <= end + 30 * MIN;
}

/** Nama layanan dari tautan, untuk label tombol. */
export function meetingProvider(url: string | null | undefined) {
  if (!url) return 'Tautan rapat';
  try {
    const h = new URL(url).hostname;
    if (h === 'meet.google.com') return 'Google Meet';
    if (h === 'zoom.us' || h.endsWith('.zoom.us')) return 'Zoom';
    if (h.endsWith('teams.microsoft.com') || h.endsWith('teams.live.com')) return 'Microsoft Teams';
  } catch {
    /* tautan tidak valid */
  }
  return 'Tautan rapat';
}

export const MEETING_MODE: Record<MeetingMode, string> = {
  offline: 'Tatap muka',
  online: 'Online',
  hybrid: 'Hybrid',
};

/** Validasi tautan rapat: wajib https. */
export function meetingUrlError(url: string) {
  const u = url.trim();
  if (!u) return 'Tempel tautan Google Meet/Zoom';
  if (!/^https:\/\//i.test(u)) return 'Tautan harus diawali https://';
  try {
    new URL(u);
  } catch {
    return 'Format tautan tidak valid';
  }
  return null;
}
