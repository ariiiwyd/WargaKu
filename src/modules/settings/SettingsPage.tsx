import { useRef, useState, type FormEvent } from 'react';
import { Building2, History, KeyRound, LogOut, MonitorSmartphone, Monitor, Moon, Palette, RefreshCw, Smartphone, Sun, UserRound } from 'lucide-react';
import { usePageEnter, useToast } from '@/motion';
import { PageHeader } from '@/components/ui/PageHeader';
import { Avatar, Button, Card, CardHeader, Choice, Field, Input } from '@/components/ui/primitives';
import { ConfirmDialog } from '@/components/ui/DialogShell';
import { idleLabel } from '@/lib/session';
import { Tabs } from '@/components/ui/Tabs';
import { useDatabase, useLookups, useMe } from '@/hooks/useData';
import { actions, useDb } from '@/stores/db.store';
import { useUi } from '@/stores/ui.store';
import { can, ROLE_LABEL } from '@/app/permissions';
import { dateTime } from '@/lib/format';
import { useAuth } from '@/stores/auth.store';
import { InstallButton } from '@/components/install/InstallApp';
import type { ThemePref } from '@/types/models';

type TabKey = 'profil' | 'rt' | 'audit' | 'sistem';

export function SettingsPage() {
  const me = useMe()!;
  const ref = useRef<HTMLDivElement>(null);
  usePageEnter(ref);
  const [tab, setTab] = useState<TabKey>('profil');
  const tabs = [
    { value: 'profil' as const, label: me.role === 'warga' ? 'Profil' : 'Profil & tampilan' },
    ...(can(me.role, 'settings.rt') ? [{ value: 'rt' as const, label: 'Identitas RT' }] : []),
    ...(can(me.role, 'audit.view') || can(me.role, 'audit.finance') ? [{ value: 'audit' as const, label: 'Riwayat aktivitas' }] : []),
    { value: 'sistem' as const, label: 'Aplikasi' },
  ];
  return (
    <div ref={ref} className="mx-auto max-w-[980px]">
      <PageHeader title={me.role === 'warga' ? 'Profil' : 'Pengaturan'} description="Atur profil, tampilan, dan identitas lingkungan." />
      <div className="mb-5" data-fade><Tabs label="Bagian pengaturan" value={tab} onChange={setTab} tabs={tabs} /></div>
      {tab === 'profil' ? <Profile /> : null}
      {tab === 'rt' ? <RtIdentity /> : null}
      {tab === 'audit' ? <Audit /> : null}
      {tab === 'sistem' ? <System /> : null}
    </div>
  );
}

function Profile() {
  const db = useDatabase();
  const me = useMe()!;
  const toast = useToast();
  const p = db.profiles.find((x) => x.id === me.userId)!;
  const [f, setF] = useState({ full_name: p.full_name, phone: p.phone });
  const authEmail = useAuth((s) => s.email);
  const theme = useUi((s) => s.theme);
  const setTheme = useUi((s) => s.setTheme);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const r = await actions.updateProfile(f);
    toast(r.ok ? 'Profil disimpan' : r.error, r.ok ? 'success' : 'error');
  };
  return (
    <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
      <Card data-card>
        <CardHeader title="Profil saya" icon={UserRound} />
        <form onSubmit={submit} className="space-y-4 px-5 pb-5">
          <div className="flex items-center gap-4">
            <Avatar name={f.full_name || '?'} size={60} />
            <div><p className="font-bold">{ROLE_LABEL[me.role]}</p><p className="text-[13px] text-muted">RT {db.neighborhood.rt_number} / RW {db.neighborhood.rw_number}</p></div>
          </div>
          <Field label="Nama lengkap" required><Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nomor HP"><Input type="tel" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
            <Field label="Email" hint="Email akun masuk; hubungi Ketua RT untuk mengubahnya"><Input type="email" value={authEmail ?? p.email} disabled /></Field>
          </div>
          <p className="text-[12.5px] text-muted">Kata sandi dikelola oleh Supabase Auth dan tidak disimpan di tabel profil.</p>
          <div className="flex justify-end"><Button type="submit">Simpan profil</Button></div>
        </form>
      </Card>
      <Card data-card>
        <CardHeader title="Tampilan" icon={Palette} />
        <div className="space-y-3 px-5 pb-5">
          <Choice<ThemePref> name="Tema" value={theme} onChange={setTheme} options={[{ value: 'light', label: 'Terang', icon: Sun }, { value: 'dark', label: 'Gelap', icon: Moon }, { value: 'system', label: 'Sistem', icon: Monitor }]} />
          <p className="text-[12.5px] text-muted">Preferensi disimpan per pengguna. "Sistem" mengikuti pengaturan perangkat Anda.</p>
        </div>
      </Card>
    </div>
  );
}

function RtIdentity() {
  const db = useDatabase();
  const toast = useToast();
  const [f, setF] = useState(db.neighborhood);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const r = await actions.updateNeighborhood(f);
    toast(r.ok ? 'Identitas RT disimpan' : r.error, r.ok ? 'success' : 'error');
  };
  return (
    <Card data-card>
      <CardHeader title="Identitas RT" sub="Dipakai di kop surat, rekening iuran, dan laporan" icon={Building2} />
      <form onSubmit={submit} className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
        <Field label="Nama lingkungan" required className="sm:col-span-2"><Input value={f.name} onChange={set('name')} /></Field>
        <Field label="Nomor RT"><Input value={f.rt_number} onChange={set('rt_number')} /></Field>
        <Field label="Nomor RW"><Input value={f.rw_number} onChange={set('rw_number')} /></Field>
        <Field label="Kelurahan"><Input value={f.village} onChange={set('village')} /></Field>
        <Field label="Kecamatan"><Input value={f.district} onChange={set('district')} /></Field>
        <Field label="Kota/Kabupaten"><Input value={f.city} onChange={set('city')} /></Field>
        <Field label="Provinsi"><Input value={f.province} onChange={set('province')} /></Field>
        <Field label="Kode pos"><Input inputMode="numeric" value={f.postal_code} onChange={set('postal_code')} /></Field>
        <Field label="Alamat sekretariat"><Input value={f.address} onChange={set('address')} /></Field>
        <div className="sm:col-span-2 mt-2 border-t border-line pt-4"><p className="text-[14px] font-bold">Rekening kas RT</p><p className="text-[12.5px] text-muted">Ditampilkan ke warga saat membayar iuran.</p></div>
        <Field label="Bank"><Input value={f.bank_name} onChange={set('bank_name')} /></Field>
        <Field label="Atas nama"><Input value={f.bank_account_name} onChange={set('bank_account_name')} /></Field>
        <Field label="Nomor rekening" className="sm:col-span-2"><Input value={f.bank_account_number} onChange={set('bank_account_number')} /></Field>
        <div className="flex justify-end sm:col-span-2"><Button type="submit">Simpan identitas</Button></div>
      </form>
    </Card>
  );
}

function Audit() {
  const db = useDatabase();
  const me = useMe()!;
  const L = useLookups();
  const fin = ['dues_invoices', 'dues_payments', 'cash_transactions', 'dues_types'];
  const rows = db.audit.filter((a) => can(me.role, 'audit.view') || fin.includes(a.table_name)).slice(0, 60);
  return (
    <Card data-card>
      <CardHeader title="Riwayat aktivitas" sub={can(me.role, 'audit.view') ? 'Seluruh aktivitas penting · tidak dapat diubah atau dihapus' : 'Aktivitas keuangan'} icon={History} />
      <ol className="relative mx-5 mb-5 border-l border-line pl-5">
        {rows.map((a) => (
          <li key={a.id} className="relative pb-4 last:pb-0" data-row>
            <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full bg-primary ring-4 ring-card" />
            <p className="text-[13.5px] font-semibold">{a.summary}</p>
            <p className="text-[12px] text-muted">{L.userName(a.user_id)} · <span className="font-mono">{a.table_name}</span> · {dateTime(a.created_at)}</p>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function System() {
  const toast = useToast();
  const me = useMe()!;
  const email = useAuth((s) => s.email);
  const sendReset = useAuth((s) => s.sendReset);
  const signOutOthers = useAuth((s) => s.signOutOthers);
  const load = useDb((s) => s.load);
  const [busy, setBusy] = useState<'' | 'reset' | 'reload'>('');
  const [askOthers, setAskOthers] = useState(false);
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card data-card>
        <CardHeader title="Pasang di layar utama" icon={Smartphone} />
        <div className="space-y-2 px-5 pb-5 text-[13.5px] leading-relaxed text-ink-2">
          <p>Pasang WargaKu di layar utama supaya bisa dibuka seperti aplikasi. Bila tombol di bawah tidak memunculkan dialog, WargaKu akan menampilkan langkah sesuai HP Anda.</p>
          <InstallButton />
          <p className="text-muted">Data keuangan dan dokumen pribadi tidak disimpan untuk offline. Pembayaran dan verifikasi memerlukan koneksi internet.</p>
        </div>
      </Card>
      <Card data-card>
        <CardHeader title="Akun & keamanan" icon={KeyRound} />
        <div className="space-y-3 px-5 pb-5 text-[13.5px] text-ink-2">
          <p>Masuk sebagai <b className="text-ink">{email}</b>. Kata sandi dikelola Supabase Auth dan tidak pernah disimpan di tabel profil.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={KeyRound} loading={busy === 'reset'} onClick={async () => {
              if (!email) return;
              setBusy('reset');
              const err = await sendReset(email);
              setBusy('');
              toast(err ?? 'Tautan ganti kata sandi dikirim ke email Anda', err ? 'error' : 'success');
            }}>Ganti kata sandi</Button>
            <Button variant="ghost" icon={RefreshCw} loading={busy === 'reload'} onClick={async () => {
              setBusy('reload');
              await load({ silent: true });
              setBusy('');
              toast('Data diperbarui');
            }}>Muat ulang data</Button>
          </div>
        </div>
      </Card>
      <Card data-card className="lg:col-span-2">
        <CardHeader title="Sesi & perangkat" icon={MonitorSmartphone} />
        <div className="space-y-3 px-5 pb-5 text-[13.5px] leading-relaxed text-ink-2">
          <p>
            Demi keamanan, akun keluar otomatis bila tidak digunakan selama <b className="text-ink">{idleLabel(me.role)}</b>. Satu menit sebelumnya muncul
            peringatan untuk tetap masuk.
          </p>
          <p>Akun ini bisa dipakai di beberapa perangkat sekaligus. Bila HP hilang atau Anda lupa keluar di perangkat orang lain, keluarkan semua perangkat lain di sini.</p>
          <Button variant="secondary" icon={LogOut} onClick={() => setAskOthers(true)}>Keluar dari perangkat lain</Button>
        </div>
      </Card>
      <ConfirmDialog
        open={askOthers}
        onClose={() => setAskOthers(false)}
        icon={LogOut}
        tone="red"
        title="Keluar dari semua perangkat lain?"
        message="Akun Anda akan keluar di HP, tablet, atau komputer lain dalam beberapa menit. Perangkat yang sedang Anda pakai ini tetap masuk."
        confirmLabel="Keluarkan perangkat lain"
        onConfirm={async () => {
          const err = await signOutOthers();
          toast(err ?? 'Perangkat lain sudah dikeluarkan', err ? 'error' : 'success');
          if (err) return false;
          setAskOthers(false);
        }}
      />
    </div>
  );
}
