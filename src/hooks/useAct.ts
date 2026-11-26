import { useCallback } from 'react';
import { useToast } from '@/motion';
import type { Result } from '@/types/models';

/** Jalankan aksi server lalu tampilkan toast sukses atau galat. Mengembalikan true bila berhasil. */
export function useAct() {
  const toast = useToast();
  return useCallback(
    async (p: Promise<Result<unknown>>, success?: string) => {
      const r = await p;
      if (!r.ok) {
        toast(r.error, 'error');
        return false;
      }
      if (success) toast(success);
      return true;
    },
    [toast],
  );
}
