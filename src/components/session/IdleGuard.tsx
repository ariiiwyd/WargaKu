import { useEffect, useId, useState } from 'react';
import { Clock } from 'lucide-react';
import { Modal } from '@/motion';
import { Button } from '@/components/ui/primitives';
import { DialogShell } from '@/components/ui/DialogShell';
import { useMe } from '@/hooks/useData';
import { useAuth } from '@/stores/auth.store';
import { supabase } from '@/lib/supabase';
import { IDLE_WARN_MS, idleLabel, idleLimitMs, lastActive, markActive, setIdleLimit } from '@/lib/session';

// Bukan 'scroll': gulir otomatis (animasi, fokus) tidak boleh dianggap aktivitas pengguna.
const ACTIVITY = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
/** Seberapa sering sesi dicek ke server (menangkap "keluar dari perangkat lain"). */
const SERVER_CHECK_MS = 2 * 60_000;

/**
 * Keluar otomatis bila akun tidak digunakan (30 menit untuk pengurus, 7 hari untuk warga),
 * dengan peringatan 1 menit sebelumnya. Juga mengeluarkan perangkat ini bila sesinya
 * sudah dicabut dari perangkat lain.
 */
export function IdleGuard() {
  const me = useMe();
  const signOut = useAuth((s) => s.signOut);
  const [left, setLeft] = useState<number | null>(null);
  const id = useId();
  const role = me?.role ?? 'warga';
  const limit = idleLimitMs(role);

  useEffect(() => {
    setIdleLimit(limit);
    if (lastActive() === null) markActive();
    let lastWrite = 0;
    let done = false;
    const out = (reason: string) => {
      if (done) return;
      done = true;
      setLeft(null);
      void signOut(reason);
    };
    const bump = () => {
      const now = Date.now();
      if (now - lastWrite > 5_000) (lastWrite = now, markActive(now));
    };
    const tick = () => {
      const remain = (lastActive() ?? Date.now()) + limit - Date.now();
      if (remain <= 0) return out(`Anda keluar otomatis karena tidak ada aktivitas selama ${idleLabel(role)}. Silakan masuk kembali.`);
      setLeft(remain <= IDLE_WARN_MS ? Math.ceil(remain / 1000) : null);
    };
    // Sesi dicabut dari perangkat lain → server menolak; keluarkan perangkat ini juga.
    const checkServer = async () => {
      if (!supabase || document.visibilityState !== 'visible' || !navigator.onLine) return;
      const { error } = await supabase.auth.getUser();
      const status = (error as { status?: number } | null)?.status;
      if (error && (status === 401 || status === 403)) out('Akun Anda sudah dikeluarkan dari perangkat ini. Silakan masuk kembali.');
    };
    const onVisible = () => {
      tick();
      if (document.visibilityState === 'visible') void checkServer();
    };

    tick();
    const t1 = window.setInterval(tick, 1000);
    const t2 = window.setInterval(checkServer, SERVER_CHECK_MS);
    ACTIVITY.forEach((e) => window.addEventListener(e, bump, { passive: true, capture: true }));
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(t1);
      window.clearInterval(t2);
      ACTIVITY.forEach((e) => window.removeEventListener(e, bump, { capture: true }));
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [limit, role, signOut]);

  const stay = () => (markActive(), setLeft(null));

  return (
    <Modal open={left !== null} onClose={stay} labelledBy={id}>
      <DialogShell
        id={id}
        title="Masih menggunakan WargaKu?"
        icon={Clock}
        onClose={stay}
        footer={
          <>
            <Button variant="secondary" onClick={() => void signOut()}>Keluar sekarang</Button>
            <Button onClick={stay} autoFocus>Tetap masuk</Button>
          </>
        }
      >
        <p className="text-[14px] leading-relaxed text-ink-2">
          Demi keamanan data warga, akun akan keluar otomatis dalam{' '}
          <b className="tabular-nums text-ink">{left ?? 0} detik</b> karena tidak ada aktivitas.
        </p>
      </DialogShell>
    </Modal>
  );
}
