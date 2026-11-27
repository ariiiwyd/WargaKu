import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { KeyRound, ShieldCheck, ShieldOff, UserCog, UserPlus } from 'lucide-react';
import { Modal, usePageEnter, useToast } from '@/motion';
import { PageHeader, Magnetic } from '@/components/ui/PageHeader';
import { Avatar, Badge, Button, Card, Field, Input, Select, cx } from '@/components/ui/primitives';
import { ConfirmDialog, DialogShell } from '@/components/ui/DialogShell';
import { useDatabase, useLookups, useMe } from '@/hooks/useData';
import { actions } from '@/stores/db.store';
import { ROLE_DESC, ROLE_LABEL } from '@/app/permissions';
import { dateTime } from '@/lib/format';
import type { Role } from '@/types/models';

const ROLES: Role[] = ['ketua_rt', 'sekretaris', 'bendahara', 'pengurus', 'warga'];

export function UsersPage() {
  const db = useDatabase();
  const me = useMe()!;
  const L = useLookups();
  const toast = useToast();
  const ref = useRef<HTMLDivElement>(null);
  usePageEnter(ref);
  const [pending, setPending] = useState<{ user: string; role: Role } | null>(null);
  const [toggle, setToggle] = useState<{ user: string; active: boolean } | null>(null);
  const [invite, setInvite] = useState(false);
  const [mfa, setMfa] = useState<Record<string, boolean>>({});
  const [resetMfa, setResetMfa] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    actions.memberMfaStatus().then((m) => live && setMfa(m));
    return () => { live = false; };
  }, [db]);
  const rows = db.memberships.map((m) => ({ m, p: L.profile(m.user_id)!, r: L.resident(m.resident_id) })).sort((a, b) => ROLES.indexOf(a.m.role) - ROLES.indexOf(b.m.role));
  // Perubahan role/aktif dicatat trigger sebagai insert/update pada user_memberships; undangan oleh Edge Function sebagai invite_user.
  const roleAudit = db.audit.filter((a) => a.table_name === 'user_memberships' || a.action === 'invite_user').slice(0, 8);

  return (
    <div ref={ref}>
      <PageHeader title="Pengguna & Role" description="Hanya Ketua RT yang dapat mengubah role. Akun yang dinonaktifkan kehilangan akses, tetapi histori transaksinya tetap tersimpan."
        actions={<Magnetic><Button icon={UserPlus} onClick={() => setInvite(true)}>Buat akun warga</Button></Magnetic>} />
      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Card data-card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {rows.map(({ m, p, r }) => (
              <li key={m.id} data-row className={cx('flex flex-wrap items-center gap-3 px-4 py-4 sm:px-5', !m.is_active && 'opacity-60')}>
                <Avatar name={p.full_name} size={42} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate text-[14.5px] font-bold">{p.full_name}{m.user_id === me.userId ? <Badge tone="blue">Anda</Badge> : null}{!m.is_active ? <Badge tone="gray">Nonaktif</Badge> : null}</p>
                  <p className="truncate text-[12.5px] text-muted">{p.email} · Rumah {L.household(r?.household_id)?.house_number ?? '—'}</p>
                  {mfa[m.user_id] ? (
                    <Badge tone="green" className="mt-1.5">2 langkah aktif</Badge>
                  ) : m.is_active && (m.role === 'ketua_rt' || m.role === 'bendahara') && m.user_id in mfa ? (
                    <Badge tone="orange" className="mt-1.5">2 langkah belum dipasang</Badge>
                  ) : null}
                </div>
                <Select aria-label={`Role ${p.full_name}`} value={m.role} disabled={!m.is_active} onChange={(e) => setPending({ user: m.user_id, role: e.target.value as Role })} className="h-10 w-[150px] text-[13.5px]">
                  {ROLES.map((x) => <option key={x} value={x}>{ROLE_LABEL[x]}</option>)}
                </Select>
                {m.user_id !== me.userId && mfa[m.user_id] ? <Button size="sm" variant="ghost" icon={ShieldOff} onClick={() => setResetMfa(m.user_id)}>Reset 2 langkah</Button> : null}
                {m.user_id !== me.userId ? <Button size="sm" variant={m.is_active ? 'ghost' : 'soft'} onClick={() => setToggle({ user: m.user_id, active: !m.is_active })}>{m.is_active ? 'Nonaktifkan' : 'Aktifkan'}</Button> : null}
              </li>
            ))}
          </ul>
        </Card>
        <div className="space-y-5">
          <Card data-card className="p-5">
            <p className="mb-3 flex items-center gap-2 text-[15px] font-bold"><ShieldCheck className="size-5 text-primary" />Hak akses per role</p>
            <ul className="space-y-2.5">
              {ROLES.map((x) => <li key={x} className="text-[13px]"><b className="text-ink">{ROLE_LABEL[x]}</b> <span className="text-muted">— {ROLE_DESC[x]}</span></li>)}
            </ul>
            <p className="mt-4 rounded-xl bg-panel px-3.5 py-2.5 text-[12.5px] text-muted">Di Supabase, hak akses ditegakkan oleh Row Level Security & RPC, bukan hanya menu yang disembunyikan.</p>
          </Card>
          <Card data-card className="p-5">
            <p className="mb-3 flex items-center gap-2 text-[15px] font-bold"><KeyRound className="size-5 text-primary" />Riwayat perubahan akses</p>
            <ol className="space-y-2.5">
              {roleAudit.map((a) => <li key={a.id} className="text-[13px]"><span className="font-semibold text-ink">{a.summary}</span><span className="block text-[12px] text-muted">{L.userName(a.user_id)} · {dateTime(a.created_at)}</span></li>)}
            </ol>
          </Card>
        </div>
      </div>
      <ConfirmDialog open={!!pending} onClose={() => setPending(null)} icon={UserCog} title="Ubah role pengguna?" confirmLabel="Ubah role"
        message={pending ? <><b>{L.userName(pending.user)}</b> akan menjadi <b>{ROLE_LABEL[pending.role]}</b>. {ROLE_DESC[pending.role]}. Perubahan dicatat di audit log.</> : null}
        onConfirm={async () => { const r = await actions.assignRole(pending!.user, pending!.role); toast(r.ok ? 'Role diperbarui' : r.error, r.ok ? 'success' : 'error'); setPending(null); }} />
      <ConfirmDialog open={!!toggle} onClose={() => setToggle(null)} tone={toggle?.active ? 'green' : 'red'} title={toggle?.active ? 'Aktifkan kembali akun?' : 'Nonaktifkan akun?'} confirmLabel={toggle?.active ? 'Aktifkan' : 'Nonaktifkan'}
        message={toggle?.active ? 'Pengguna dapat masuk kembali dengan role sebelumnya.' : 'Pengguna tidak dapat masuk lagi. Data dan histori transaksinya tidak dihapus.'}
        onConfirm={async () => { const r = await actions.setUserActive(toggle!.user, toggle!.active); toast(r.ok ? 'Status akun diperbarui' : r.error, r.ok ? 'success' : 'error'); setToggle(null); }} />
      <ConfirmDialog open={!!resetMfa} onClose={() => setResetMfa(null)} tone="red" icon={ShieldOff} title="Reset verifikasi 2 langkah?" confirmLabel="Reset"
        message={resetMfa ? <>Gunakan bila <b>{L.userName(resetMfa)}</b> kehilangan HP atau aplikasi authenticator-nya terhapus. Semua authenticator akun ini dihapus{['ketua_rt', 'bendahara'].includes(db.memberships.find((x) => x.user_id === resetMfa)?.role ?? '') ? '; saat masuk berikutnya ia wajib memasang yang baru' : ''}.</> : null}
        onConfirm={async () => { const r = await actions.resetMemberMfa(resetMfa!); toast(r.ok ? 'Verifikasi 2 langkah direset' : r.error, r.ok ? 'success' : 'error'); if (!r.ok) return false; setResetMfa(null); }} />
      <InviteForm open={invite} onClose={() => setInvite(false)} />
    </div>
  );
}

function InviteForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const db = useDatabase();
  const toast = useToast();
  const id = useId();
  const [f, setF] = useState({ resident: '', role: 'warga' as Role, email: '' });
  const [err, setErr] = useState('');
  useEffect(() => { if (open) (setF({ resident: '', role: 'warga', email: '' }), setErr('')); }, [open]);
  const candidates = db.residents.filter((r) => r.is_active && !r.user_id && ['Kepala Keluarga', 'Istri', 'Suami'].includes(r.family_relationship));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const r = await actions.createAccount(f.resident, f.role, f.email);
    if (!r.ok) return setErr(r.error);
    toast(r.data.emailSent ? 'Akun dibuat. Email "Atur kata sandi" dikirim ke warga.' : `Akun dibuat, tetapi email belum terkirim: ${r.data.emailError}`, r.data.emailSent ? 'success' : 'error');
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} labelledBy={id}>
      <form onSubmit={submit} noValidate>
        <DialogShell id={id} title="Buat akun warga" sub="Akun ditautkan ke data warga agar dapat melihat tagihan & surat keluarganya." icon={UserPlus} onClose={onClose}
          footer={<><Button type="button" variant="secondary" onClick={onClose}>Batal</Button><Button type="submit">Buat akun</Button></>}>
          <div className="space-y-4">
            <Field label="Warga" required>
              <Select value={f.resident} onChange={(e) => setF({ ...f, resident: e.target.value })}>
                <option value="">Pilih warga dewasa tanpa akun</option>
                {candidates.map((r) => <option key={r.id} value={r.id}>{db.households.find((h) => h.id === r.household_id)?.house_number} · {r.full_name}</option>)}
              </Select>
            </Field>
            <Field label="Email" required><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="nama@email.com" /></Field>
            <Field label="Role"><Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>{ROLES.filter((r) => r !== 'ketua_rt').map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select></Field>
            {err ? <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-[13.5px] font-medium text-danger-ink">{err}</p> : null}
          </div>
        </DialogShell>
      </form>
    </Modal>
  );
}
