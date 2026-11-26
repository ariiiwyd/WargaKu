import { useCallback } from 'react';
import { useToast } from '@/motion';
import { actions } from '@/stores/db.store';
import type { Activity } from '@/types/models';

/**
 * Gabung rapat online: tautan Meet/Zoom dibuka LANGSUNG saat diklik (agar tidak
 * diblokir sebagai pop-up), lalu kehadiran "Hadir online" dicatat di latar belakang.
 */
export function useJoinMeeting() {
  const toast = useToast();
  return useCallback(
    async (a: Activity) => {
      if (!a.meeting_url) return;
      window.open(a.meeting_url, '_blank', 'noopener,noreferrer');
      const r = await actions.joinOnlineMeeting(a.id);
      if (r.ok) toast('Kehadiran online tercatat');
      else toast(r.error, 'error');
    },
    [toast],
  );
}
