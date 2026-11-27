import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { BookOpenCheck, CalendarPlus, Car, CircleCheckBig, DoorOpen, Flashlight, MoonStar, NotebookPen, Pencil, Plus, ShieldAlert, Siren, UserPlus, Users } from 'lucide-react';
import { Modal, Sheet, usePageEnter, useToast } from '@/motion';
import { PageHeader, Magnetic } from '@/components/ui/PageHeader';
import { Avatar, Badge, Button, Card, CardHeader, Choice, EmptyState, Field, Input, Select, Textarea, cx } from '@/components/ui/primitives';
import { ConfirmDialog, DialogShell } from '@/components/ui/DialogShell';
import { SearchInput } from '@/components/ui/list';
import { Tabs } from '@/components/ui/Tabs';
import { useDatabase, useLookups, useMe } from '@/hooks/useData';
import { useAct } from '@/hooks/useAct';
import { actions } from '@/stores/db.store';
import { can } from '@/app/permissions';
import { DAYS, dateShort, dateTime, relative, time, todayISO } from '@/lib/format';
import type { PatrolTeam, SecurityIncident } from '@/types/models';

type TabKey = 'ronda' | 'kejadian' | 'tamu';

export function SecurityPage() {
  const db = useDatabase();
  const me = useMe()!;
  const ref = useRef<HTMLDivElement>(null);
  usePageEnter(ref);
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as TabKey) || 'ronda';
  const manage = can(me.role, 'security.manage');
  const [incident, setIncident] = useState(false);
  const [guest, setGuest] = useState(false);
  const open = db.incidents.filter((i) => i.status === 'open').length;
  const inside = db.guests.filter((g) => !g.departure_at).length;

  return (
    <div ref={ref}>
      <PageHeader title="Keamanan Lingkungan" description="Jadwal & laporan ronda, catatan kejadian, dan buku tamu lingkungan."
        actions={<>
          <Button variant="secondary" icon={ShieldAlert} onClick={() => setIncident(true)}>Laporkan kejadian</Button>
          {manage ? <Magnetic><Button icon={UserPlus} onClick={() => setGuest(true)}>Catat tamu</Button></Magnetic> : null}
        </>} />
      <div className="mb-5 grid grid-cols-3 gap-3">
        <Mini icon={MoonStar} label="Regu ronda" value={db.patrolTeams.filter((t) => t.is_active).length} />
        <Mini icon={Siren} label="Kejadian terbuka" value={open} alert={open > 0} />
        <Mini icon={DoorOpen} label="Tamu di lingkungan" value={inside} />
      </div>
      <div className="mb-4" data-fade>
        <Tabs label="Bagian keamanan" value={tab} onChange={(v) => setParams({ tab: v }, { replace: true })} tabs={[
          { value: 'ronda', label: 'Jadwal ronda' }, { value: 'kejadian', label: 'Catatan kejadian', count: db.incidents.length }, { value: 'tamu', label: 'Buku tamu', count: db.guests.length },
        ]} />
      </div>
      {tab === 'ronda' ? <Patrol /> : null}
      {tab === 'kejadian' ? <Incidents /> : null}
      {tab === 'tamu' ? <Guests /> : null}
      <IncidentForm open={incident} onClose={() => setIncident(false)} />
      <GuestForm open={guest} onClose={() => setGuest(false)} />
    </div>
  );
}

function Mini({ icon: Icon, label, value, alert }: { icon: typeof Siren; label: string; value: number; alert?: boolean }) {
  return (
    <div data-card className={cx('rounded-[18px] border p-4 shadow-sm', alert ? 'border-danger/30 bg-danger-soft' : 'border-line bg-card')}>
      <Icon className={cx('size-5', alert ? 'text-danger-ink' : 'text-primary')} />
      <p className={cx('mt-2 text-[24px] font-extrabold', alert ? 'text-danger-ink' : 'text-ink')}>{value}</p>
      <p className="text-[12.5px] font-semibold text-muted">{label}</p>
    </div>
  );
}

function Patrol() {
  const db = useDatabase();
  const me = useMe()!;
  const L = useLookups();
  const toast = useToast();
  const today = todayISO();
  const [rep, setRep] = useState<string | null>(null);
  const [status, setStatus] = useState<'aman' | 'ada_kejadian' | 'tidak_terlaksana'>('aman');
  const [text, setText] = useState('');
  const week = db.patrolSchedules.filter((s) => s.patrol_date >= today).slice(0, 7);
  const past = db.patrolSchedules.filter((s) => s.patrol_date < today).slice(-7).reverse();
  const id = useId();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const r = await actions.submitPatrolReport(rep!, status, text);
    if (!r.ok) return toast(r.error, 'error');
    toast('Laporan ronda tersimpan');
    setRep(null);
    setText('');
  };
  const wd = (d: string) => DAYS[new Date(d + 'T12:00:00+07:00').getUTCDay()];

  return (
    <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
      <div className="space-y-5">
        <Card data-card>
          <CardHeader title="7 malam ke depan" sub="Ronda 22.00–04.00 WIB" icon={Flashlight} />
          <ul className="grid gap-2 px-3 pb-3 sm:grid-cols-2">
            {week.map((s) => {
              const t = db.patrolTeams.find((x) => x.id === s.team_id);
              // "Malam ini" hanya untuk jadwal bertanggal hari ini, bukan sekadar jadwal pertama.
              const tonight = s.patrol_date === today;
              return (
                <li key={s.id} data-row className={cx('rounded-2xl p-3.5', tonight ? 'bg-navy text-white' : 'border border-line bg-panel/40')}>
                  <p className={cx('text-[12px] font-semibold', tonight ? 'text-navy-ink' : 'text-muted')}>{tonight ? 'Malam ini' : wd(s.patrol_date)} · {dateShort(s.patrol_date)}</p>
                  <p className="mt-0.5 text-[15px] font-extrabold">{t?.name ?? 'Regu tidak ditemukan'}</p>
                  <div className="mt-2 flex -space-x-2">{(t?.member_ids ?? []).slice(0, 6).map((m) => <Avatar key={m} name={L.resident(m)?.full_name ?? '?'} size={26} className={tonight ? 'ring-2 ring-navy' : 'ring-2 ring-card'} />)}</div>
                </li>
              );
            })}
            {!week.length ? <li className="px-2 py-3 text-[13px] text-muted sm:col-span-2">Belum ada jadwal ronda untuk 7 malam ke depan.</li> : null}
          </ul>
        </Card>
        <Card data-card>
          <CardHeader title="Laporan pelaksanaan" icon={NotebookPen} />
          <ul className="divide-y divide-line">
            {past.map((s) => {
              const r = db.patrolReports.find((x) => x.schedule_id === s.id);
              const t = db.patrolTeams.find((x) => x.id === s.team_id);
              return (
                <li key={s.id} className="flex items-start gap-3 px-5 py-3.5">
                  <span className={cx('mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl', !r ? 'bg-panel-2 text-muted' : r.status === 'aman' ? 'bg-success-soft text-success-ink' : r.status === 'ada_kejadian' ? 'bg-danger-soft text-danger-ink' : 'bg-warn-soft text-warn-ink')}>
                    {r?.status === 'ada_kejadian' ? <Siren className="size-4" /> : <CircleCheckBig className="size-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-bold">{wd(s.patrol_date)}, {dateShort(s.patrol_date)} · {t?.name ?? '—'}</span>
                    <span className="block text-[13px] text-ink-2">{r ? r.report : 'Belum ada laporan'}</span>
                  </span>
                  {!r && can(me.role, 'security.manage') ? <Button size="sm" variant="soft" onClick={() => setRep(s.id)}>Isi laporan</Button> : null}
                </li>
              );
            })}
            {!past.length ? <li className="px-5 py-4 text-[13px] text-muted">Belum ada ronda yang terlaksana.</li> : null}
          </ul>
        </Card>
      </div>
      <TeamsCard />
      <Modal open={!!rep} onClose={() => setRep(null)} labelledBy={id}>
        <form onSubmit={submit}>
          <DialogShell id={id} title="Laporan ronda" icon={NotebookPen} onClose={() => setRep(null)} footer={<><Button type="button" variant="secondary" onClick={() => setRep(null)}>Batal</Button><Button type="submit">Simpan laporan</Button></>}>
            <div className="space-y-4">
              <Field label="Situasi"><Choice name="Situasi" value={status} onChange={setStatus} options={[{ value: 'aman', label: 'Aman' }, { value: 'ada_kejadian', label: 'Ada kejadian' }, { value: 'tidak_terlaksana', label: 'Tidak jalan' }]} /></Field>
              <Field label="Catatan" required><Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Contoh: Keliling 3 kali, situasi aman." /></Field>
            </div>
          </DialogShell>
        </form>
      </Modal>
    </div>
  );
}

function Incidents() {
  const db = useDatabase();
  const me = useMe()!;
  const L = useLookups();
  const act = useAct();
  const sev = { rendah: 'gray', sedang: 'orange', tinggi: 'red' } as const;
  const st = { open: ['Terbuka', 'red'], handled: ['Ditangani', 'orange'], closed: ['Selesai', 'green'] } as const;
  const list = db.incidents.filter((i) => can(me.role, 'security.view') || i.reported_by === me.userId);
  if (!list.length) return <Card><EmptyState icon={Siren} title="Tidak ada catatan kejadian" text="Semoga lingkungan tetap aman." /></Card>;
  return (
    <ul className="grid gap-3 lg:grid-cols-2">
      {list.map((i) => (
        <li key={i.id} data-card>
          <Card className="h-full p-5">
            <div className="flex flex-wrap items-center gap-1.5"><Badge tone={st[i.status][1]} dot>{st[i.status][0]}</Badge><Badge tone={sev[i.severity]}>Tingkat {i.severity}</Badge></div>
            <p className="mt-2 text-[16px] font-bold">{i.title}</p>
            <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{i.description}</p>
            <p className="mt-3 text-[12.5px] text-muted">{i.location} · {dateTime(i.incident_date)} · dilaporkan {L.userName(i.reported_by)}</p>
            {can(me.role, 'security.manage') && i.status !== 'closed' ? (
              <div className="mt-4 flex gap-2">
                {i.status === 'open' ? <Button size="sm" variant="soft" onClick={() => act(actions.setIncidentStatus(i.id, 'handled'), 'Kejadian ditandai sedang ditangani')}>Tandai ditangani</Button> : null}
                <Button size="sm" variant="secondary" onClick={() => act(actions.setIncidentStatus(i.id, 'closed'), 'Kejadian ditutup')}>Tutup kasus</Button>
              </div>
            ) : null}
          </Card>
        </li>
      ))}
    </ul>
  );
}

function Guests() {
  const db = useDatabase();
  const me = useMe()!;
  const act = useAct();
  return (
    <Card data-card className="overflow-hidden">
      <ul className="divide-y divide-line">
        {db.guests.map((g) => (
          <li key={g.id} data-row className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
            <Avatar name={g.visitor_name} size={38} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-bold">{g.visitor_name} <span className="font-normal text-muted">→ {g.destination}</span></span>
              <span className="block truncate text-[12.5px] text-muted">{g.purpose}{g.vehicle_plate ? <> · <Car className="inline size-3.5" /> {g.vehicle_plate}</> : null} · masuk {relative(g.arrival_at)}, {time(g.arrival_at)}</span>
            </span>
            {g.departure_at ? <Badge tone="gray">Keluar {time(g.departure_at)}</Badge> : (
              <span className="flex items-center gap-2"><Badge tone="green" dot>Di dalam</Badge>{can(me.role, 'security.manage') ? <Button size="sm" variant="secondary" onClick={() => act(actions.checkoutGuest(g.id), `${g.visitor_name} tercatat keluar`)}>Catat keluar</Button> : null}</span>
            )}
          </li>
        ))}
      </ul>
      {!db.guests.length ? <EmptyState icon={BookOpenCheck} title="Buku tamu kosong" /> : null}
    </Card>
  );
}

function IncidentForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const id = useId();
  const blank = { title: '', description: '', location: '', severity: 'rendah' as SecurityIncident['severity'], when: '' };
  const [f, setF] = useState(blank);
  const [err, setErr] = useState('');
  useEffect(() => { if (open) (setF({ ...blank, when: new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 16) }), setErr('')); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const r = await actions.reportIncident({ title: f.title, description: f.description, location: f.location, severity: f.severity, incident_date: f.when ? new Date(f.when + ':00+07:00').toISOString() : '' });
    if (!r.ok) return setErr(r.error);
    toast('Kejadian dilaporkan ke Ketua RT & Pengurus');
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} labelledBy={id}>
      <form onSubmit={submit} noValidate>
        <DialogShell id={id} title="Laporkan kejadian" sub="Untuk keadaan darurat, hubungi 110 (Polisi) atau 112 terlebih dahulu." icon={ShieldAlert} tone="red" onClose={onClose}
          footer={<><Button type="button" variant="secondary" onClick={onClose}>Batal</Button><Button type="submit" variant="danger">Kirim laporan</Button></>}>
          <div className="space-y-4">
            <Field label="Judul kejadian" required><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Waktu kejadian" required><Input type="datetime-local" value={f.when} onChange={(e) => setF({ ...f, when: e.target.value })} /></Field>
              <Field label="Lokasi"><Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></Field>
            </div>
            <Field label="Tingkat"><Select value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value as never })}><option value="rendah">Rendah</option><option value="sedang">Sedang</option><option value="tinggi">Tinggi</option></Select></Field>
            <Field label="Kronologi" required><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
            {err ? <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-[13.5px] font-medium text-danger-ink">{err}</p> : null}
          </div>
        </DialogShell>
      </form>
    </Modal>
  );
}

function GuestForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const id = useId();
  const blank = { visitor_name: '', visitor_phone: '', destination: '', purpose: '', vehicle_plate: '' };
  const [f, setF] = useState(blank);
  const [err, setErr] = useState('');
  useEffect(() => { if (open) (setF(blank), setErr('')); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const r = await actions.logGuest(f);
    if (!r.ok) return setErr(r.error);
    toast(`${f.visitor_name} tercatat masuk`);
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} labelledBy={id}>
      <form onSubmit={submit} noValidate>
        <DialogShell id={id} title="Catat tamu" icon={Plus} onClose={onClose} footer={<><Button type="button" variant="secondary" onClick={onClose}>Batal</Button><Button type="submit">Catat masuk</Button></>}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nama tamu" required className="sm:col-span-2"><Input value={f.visitor_name} onChange={(e) => setF({ ...f, visitor_name: e.target.value })} /></Field>
            <Field label="Tujuan (rumah)" required><Input value={f.destination} onChange={(e) => setF({ ...f, destination: e.target.value.toUpperCase() })} placeholder="B-07" /></Field>
            <Field label="No. HP"><Input type="tel" inputMode="tel" value={f.visitor_phone} onChange={(e) => setF({ ...f, visitor_phone: e.target.value })} /></Field>
            <Field label="Keperluan"><Input value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} /></Field>
            <Field label="Plat kendaraan"><Input value={f.vehicle_plate} onChange={(e) => setF({ ...f, vehicle_plate: e.target.value.toUpperCase() })} placeholder="B 1234 XYZ" /></Field>
            {err ? <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-[13.5px] font-medium text-danger-ink sm:col-span-2">{err}</p> : null}
          </div>
        </DialogShell>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ Regu ronda */
const DAY_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function TeamsCard() {
  const db = useDatabase();
  const me = useMe()!;
  const L = useLookups();
  const toast = useToast();
  const manage = can(me.role, 'security.manage');
  const [form, setForm] = useState<PatrolTeam | 'new' | null>(null);
  const [busy, setBusy] = useState(false);
  const teams = db.patrolTeams.filter((t) => t.is_active);
  const today = todayISO();
  const future = db.patrolSchedules.filter((s) => s.patrol_date >= today).map((s) => s.patrol_date).sort();
  const lastDate = future[future.length - 1];

  // Perpanjang 4 minggu, mulai sehari setelah jadwal terakhir (atau hari ini bila belum ada).
  const extend = async () => {
    setBusy(true);
    const from = lastDate ? new Date(new Date(lastDate + 'T12:00:00+07:00').getTime() + 86400000).toISOString().slice(0, 10) : undefined;
    const r = await actions.generatePatrolSchedules(4, from);
    setBusy(false);
    if (!r.ok) return toast(r.error, 'error');
    toast(r.data ? `${r.data} jadwal ronda baru dibuat` : 'Jadwal sudah lengkap untuk periode itu');
  };

  return (
    <Card data-card className="flex flex-col">
      <CardHeader title="Regu & anggota" icon={MoonStar}
        action={manage && teams.length ? <Button size="sm" variant="soft" icon={Plus} onClick={() => setForm('new')}>Tambah regu</Button> : undefined} />
      <ul className="space-y-3 px-4 pb-4">
        {!teams.length ? (
          <li className="rounded-2xl border border-dashed border-line px-4 py-6 text-center">
            <p className="text-[14px] font-semibold text-ink">Belum ada regu ronda</p>
            <p className="mt-1 text-[13px] text-muted">{manage ? 'Buat regu, pilih hari jaga dan anggotanya. Jadwal 4 minggu ke depan dibuat otomatis.' : 'Pengurus akan membuat regu dan jadwal ronda.'}</p>
            {manage ? <Button className="mt-4" icon={Plus} onClick={() => setForm('new')}>Buat regu pertama</Button> : null}
          </li>
        ) : null}
        {teams.map((t) => (
          <li key={t.id} className="rounded-2xl border border-line p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-bold">{t.name}</p>
                <p className="mt-1 flex flex-wrap gap-1">
                  {[...t.weekdays].sort().map((d) => <Badge key={d} tone="blue">{DAYS[d]}</Badge>)}
                </p>
              </div>
              {manage ? <Button size="sm" variant="ghost" icon={Pencil} aria-label={`Ubah ${t.name}`} onClick={() => setForm(t)} /> : null}
            </div>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {t.member_ids.map((m) => {
                const r = L.resident(m);
                return (
                  <li key={m} className={cx('inline-flex items-center gap-1.5 rounded-full py-1 pr-2.5 pl-1 text-[12.5px] font-semibold', m === t.leader_resident_id ? 'bg-primary-soft text-primary-soft-ink' : 'bg-panel text-ink-2')}>
                    <Avatar name={r?.full_name ?? '?'} size={22} />
                    {r ? r.full_name.split(' ').slice(0, 2).join(' ') : 'Warga'}
                    {m === t.leader_resident_id ? ' · Ketua' : ''}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
      {manage && teams.length ? (
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3">
          <p className="text-[12.5px] text-muted">{lastDate ? <>Jadwal tersedia sampai <b className="text-ink">{dateShort(lastDate)}</b></> : 'Belum ada jadwal ke depan.'}</p>
          <Button size="sm" variant="secondary" icon={CalendarPlus} loading={busy} onClick={extend}>{lastDate ? 'Perpanjang 4 minggu' : 'Buat jadwal 4 minggu'}</Button>
        </div>
      ) : null}
      <TeamForm value={form} onClose={() => setForm(null)} />
    </Card>
  );
}

function TeamForm({ value, onClose }: { value: PatrolTeam | 'new' | null; onClose: () => void }) {
  const db = useDatabase();
  const L = useLookups();
  const toast = useToast();
  const editing = value && value !== 'new' ? value : null;
  const [name, setName] = useState('');
  const [days, setDays] = useState<number[]>([]);
  const [members, setMembers] = useState<string[]>([]);
  const [leader, setLeader] = useState('');
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);

  useEffect(() => {
    if (!value) return;
    setErr('');
    setQ('');
    if (value === 'new') {
      setName(`Regu ${db.patrolTeams.filter((t) => t.is_active).length + 1}`);
      setDays([]);
      setMembers([]);
      setLeader('');
    } else {
      setName(value.name);
      setDays(value.weekdays);
      setMembers(value.member_ids);
      setLeader(value.leader_resident_id ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const pool = db.residents
    .filter((r) => r.is_active)
    .map((r) => ({ r, house: L.household(r.household_id)?.house_number ?? '' }))
    .sort((a, b) => a.house.localeCompare(b.house, 'id', { numeric: true }) || a.r.full_name.localeCompare(b.r.full_name));
  const shown = pool.filter(({ r, house }) => !q.trim() || `${r.full_name} ${house}`.toLowerCase().includes(q.toLowerCase()));
  const toggleDay = (d: number) => setDays((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d]));
  const toggleMember = (id: string) => {
    setMembers((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));
    if (leader === id) setLeader('');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await actions.savePatrolTeam({ id: editing?.id, name, weekdays: days, leader: leader || null, members });
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    toast(r.data.created ? `Regu disimpan · ${r.data.created} jadwal ronda dibuat` : 'Regu disimpan');
    onClose();
  };
  const deactivate = async () => {
    const r = await actions.deactivatePatrolTeam(editing!.id);
    if (!r.ok) {
      toast(r.error, 'error');
      return false;
    }
    toast(`${editing!.name} dinonaktifkan`);
    setConfirmOff(false);
    onClose();
    return true;
  };

  return (
    <Sheet open={!!value} onClose={onClose} label={editing ? 'Ubah regu ronda' : 'Tambah regu ronda'} wide>
      <form onSubmit={submit} className="flex h-full flex-col" noValidate>
        <div className="border-b border-line px-6 py-4">
          <h2 className="text-[18px] font-bold">{editing ? 'Ubah regu ronda' : 'Tambah regu ronda'}</h2>
          <p className="text-[13px] text-muted">Jadwal 4 minggu ke depan dibuat otomatis dari hari jaga. Jadwal yang sudah ada laporannya tidak berubah.</p>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <Field label="Nama regu" required htmlFor="tf-name">
            <Input id="tf-name" value={name} onChange={(e) => (setName(e.target.value), setErr(''))} placeholder="Contoh: Regu Melati" />
          </Field>
          <div data-sheet-item>
            <p className="mb-2 text-[13px] font-semibold text-ink-2">Hari jaga <span className="text-danger">*</span></p>
            <div role="group" aria-label="Hari jaga" className="grid grid-cols-7 gap-1.5">
              {DAY_SHORT.map((d, i) => {
                const on = days.includes(i);
                return (
                  <button key={d} type="button" aria-pressed={on} aria-label={DAYS[i]} onClick={() => (toggleDay(i), setErr(''))}
                    className={cx('h-11 rounded-xl border text-[13px] font-semibold transition-colors', on ? 'border-primary bg-primary text-primary-ink' : 'border-line bg-card text-ink-2 hover:border-line-strong')}>
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
          <div data-sheet-item>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[13px] font-semibold text-ink-2">Anggota <span className="text-danger">*</span></p>
              <Badge tone={members.length ? 'blue' : 'gray'}><Users className="size-3" />{members.length} dipilih</Badge>
            </div>
            <SearchInput value={q} onChange={setQ} placeholder="Cari nama atau nomor rumah" />
            <ul className="mt-2 max-h-[260px] divide-y divide-line overflow-y-auto rounded-2xl border border-line">
              {shown.map(({ r, house }) => {
                const on = members.includes(r.id);
                return (
                  <li key={r.id}>
                    <label className={cx('flex cursor-pointer items-center gap-3 px-3.5 py-2.5', on && 'bg-primary-soft/50')}>
                      <input type="checkbox" checked={on} onChange={() => (toggleMember(r.id), setErr(''))} className="size-4 accent-[var(--primary)]" />
                      <Avatar name={r.full_name} size={28} />
                      <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{r.full_name}</span>
                      <span className="text-[12.5px] text-muted">{house}</span>
                    </label>
                  </li>
                );
              })}
              {!shown.length ? (
                <li className="px-4 py-5 text-center text-[13px] text-muted">{pool.length ? 'Tidak ada warga yang cocok.' : 'Belum ada data warga. Tambahkan warga dulu di menu Data Warga.'}</li>
              ) : null}
            </ul>
          </div>
          <Field label="Ketua regu" hint="Opsional. Hanya anggota yang dipilih di atas." htmlFor="tf-leader">
            <Select id="tf-leader" value={leader} onChange={(e) => setLeader(e.target.value)} disabled={!members.length}>
              <option value="">Tanpa ketua regu</option>
              {members.map((m) => <option key={m} value={m}>{L.resident(m)?.full_name ?? 'Warga'}</option>)}
            </Select>
          </Field>
          {err ? <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-[13.5px] font-medium text-danger-ink">{err}</p> : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-6 py-4">
          {editing ? <Button type="button" variant="ghost" className="mr-auto text-danger-ink" onClick={() => setConfirmOff(true)}>Nonaktifkan regu</Button> : null}
          <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
          <Button type="submit" loading={busy}>{editing ? 'Simpan perubahan' : 'Simpan & buat jadwal'}</Button>
        </div>
      </form>
      {editing ? (
        <ConfirmDialog open={confirmOff} onClose={() => setConfirmOff(false)} tone="red" title={`Nonaktifkan ${editing.name}?`} confirmLabel="Nonaktifkan"
          message="Jadwal ronda ke depan untuk regu ini dihapus. Laporan ronda yang sudah ada tetap tersimpan."
          onConfirm={deactivate} />
      ) : null}
    </Sheet>
  );
}
