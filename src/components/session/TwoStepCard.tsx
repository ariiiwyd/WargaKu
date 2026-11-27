import { useCallback, useEffect, useState } from 'react';
import { Plus, ShieldCheck, Smartphone, Trash2 } from 'lucide-react';
import { Sheet, useToast } from '@/motion';
import { Badge, Button, Card, CardHeader, Spinner } from '@/components/ui/primitives';
import { ConfirmDialog } from '@/components/ui/DialogShell';
import { TotpEnroll } from './TotpEnroll';
import { useMe } from '@/hooks/useData';
import { ROLE_LABEL } from '@/app/permissions';
import { friendlyError, supabase } from '@/lib/supabase';
import { dateShort } from '@/lib/format';

type Factor = { id: string; name: string; created: string };

/** Kelola authenticator akun sendiri: aktifkan, tambah perangkat cadangan, hapus. */
export function TwoStepCard() {
  const me = useMe()!;
  const toast = useToast();
  const required = me.role === 'ketua_rt' || me.role === 'bendahara';
  const [factors, setFactors] = useState<Factor[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Factor | null>(null);

  const refresh = useCallback(async () => {
    const { data } = (await supabase?.auth.mfa.listFactors()) ?? { data: null };
    setFactors((data?.totp ?? []).map((f) => ({ id: f.id, name: f.friendly_name || 'Authenticator', created: f.created_at })));
  }, []);
  useEffect(() => void refresh(), [refresh]);

  const lastRequired = required && (factors?.length ?? 0) <= 1;

  return (
    <Card data-card className="lg:col-span-2">
      <CardHeader title="Verifikasi 2 langkah" icon={ShieldCheck} />
      <div className="space-y-4 px-5 pb-5 text-[13.5px] leading-relaxed text-ink-2">
        <p>
          {required
            ? `Wajib untuk ${ROLE_LABEL[me.role]}. Setiap masuk perlu kata sandi dan 6 digit kode dari aplikasi authenticator di HP.`
            : 'Opsional. Bila diaktifkan, setiap masuk perlu kata sandi dan 6 digit kode dari aplikasi authenticator di HP.'}
        </p>
        {!factors ? (
          <div className="flex items-center gap-2 text-muted"><Spinner className="size-4" /> Memuat…</div>
        ) : factors.length ? (
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {factors.map((f) => (
              <li key={f.id} className="flex items-center gap-3 px-3.5 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-soft-ink"><Smartphone className="size-[18px]" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">{f.name}</span>
                  <span className="block text-[12px] text-muted">Dipasang {dateShort(f.created)}</span>
                </span>
                <Button size="sm" variant="ghost" icon={Trash2} disabled={lastRequired} title={lastRequired ? 'Perangkat terakhir tidak bisa dihapus karena verifikasi 2 langkah wajib' : undefined}
                  onClick={() => setRemoving(f)}>Hapus</Button>
              </li>
            ))}
          </ul>
        ) : (
          <Badge tone="gray">Belum aktif</Badge>
        )}
        {factors?.length ? (
          <p className="text-[12.5px] text-muted">Tambahkan perangkat cadangan (mis. tablet atau HP keluarga) agar tetap bisa masuk bila HP utama hilang.</p>
        ) : null}
        <Button variant={factors?.length ? 'secondary' : 'primary'} icon={Plus} disabled={!factors} onClick={() => setAdding(true)}>
          {factors?.length ? 'Tambah perangkat cadangan' : 'Aktifkan verifikasi 2 langkah'}
        </Button>
      </div>

      <Sheet open={adding} onClose={() => setAdding(false)} label="Pasang authenticator">
        <div className="flex h-full flex-col">
          <div className="border-b border-line px-6 py-4">
            <h2 className="text-[18px] font-bold">{factors?.length ? 'Tambah perangkat cadangan' : 'Aktifkan verifikasi 2 langkah'}</h2>
            <p className="text-[13px] text-muted">Kode dari perangkat mana pun yang terdaftar bisa dipakai untuk masuk.</p>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {adding ? (
              <TotpEnroll
                deviceName={factors?.length ? 'Perangkat cadangan' : 'HP utama'}
                onCancel={() => setAdding(false)}
                onDone={() => {
                  setAdding(false);
                  toast('Verifikasi 2 langkah aktif di perangkat ini');
                  void refresh();
                }}
              />
            ) : null}
          </div>
        </div>
      </Sheet>

      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        tone="red"
        icon={Trash2}
        title="Hapus perangkat ini?"
        message={<>Kode dari <b>{removing?.name}</b> tidak bisa dipakai lagi untuk masuk WargaKu.</>}
        confirmLabel="Hapus perangkat"
        onConfirm={async () => {
          if (!removing || !supabase) return;
          const { error } = await supabase.auth.mfa.unenroll({ factorId: removing.id });
          toast(error ? friendlyError(error) : 'Perangkat dihapus', error ? 'error' : 'success');
          if (error) return false;
          setRemoving(null);
          void refresh();
        }}
      />
    </Card>
  );
}
