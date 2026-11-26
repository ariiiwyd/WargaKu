import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, Clock3, MapPin, UserCheck, Users } from 'lucide-react';
import { Modal, Sheet, usePageEnter, useToast } from '@/motion';
import { PageHeader, Magnetic } from '@/components/ui/PageHeader';
import { Avatar, Badge, Button, Card, EmptyState, Field, Input, Select, Textarea, cx } from '@/components/ui/primitives';
import { DialogShell } from '@/components/ui/DialogShell';
import { Tabs } from '@/components/ui/Tabs';
import { StatusBadge, ACTIVITY } from '@/components/ui/status';
import { useDatabase, useLookups, useMe } from '@/hooks/useData';
import { actions } from '@/stores/db.store';
import { can } from '@/app/permissions';
import { DAYS, MONTHS, dateDay, jakartaParts, time } from '@/lib/format';
import type { Activity, AttendanceStatus } from '@/types/models';

const CAT: Record<Activity['category'], [string, string]> = {
  kerja_bakti: ['Kerja bakti', 'bg-success'],
  rapat: ['Rapat', 'bg-primary'],
  sosial: ['Sosial', 'bg-warn'],
  keagamaan: ['Keagamaan', 'bg-[#8B5CF6]'],
  olahraga: ['Olahraga', 'bg-[#0EA5E9]'],
  lainnya: ['Lainnya', 'bg-muted'],
};
const ymd = (iso: string) => {
  const p = jakartaParts(new Date(iso));
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
};

export function ActivitiesPage() {
  const db = useDatabase();
  const me = useMe()!;
  const ref = useRef<HTMLDivElement>(null);
  usePageEnter(ref);
  const manage = can(me.role, 'activities.manage');
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [openId, setOpenId] = useState<string | null>(null);
  const [create, setCreate] = useState(false);
  const now = new Date().toISOString();
  const upcoming = db.activities.filter((a) => a.status !== 'done' && a.status !== 'cancelled' && (a.end_at ?? a.start_at) >= now).sort((a, b) => a.start_at.localeCompare(b.start_at));
  const past = db.activities.filter((a) => !upcoming.includes(a)).sort((a, b) => b.start_at.localeCompare(a.start_at));
  const list = tab === 'upcoming' ? upcoming : past;

  return (
    <div ref={ref}>
      <PageHeader title="Kegiatan" description="Kalender kegiatan lingkungan: kerja bakti, rapat warga, pengajian, posyandu, dan agenda lainnya."
        actions={manage ? <Magnetic><Button icon={CalendarPlus} onClick={() => setCreate(true)}>Buat kegiatan</Button></Magnetic> : null} />
      <div className="grid gap-5 xl:grid-cols-[1.1fr_1fr]">
        <Calendar onOpen={setOpenId} />
        <div>
          <div className="mb-3" data-fade>
            <Tabs label="Waktu kegiatan" value={tab} onChange={setTab} tabs={[{ value: 'upcoming', label: 'Akan datang', count: upcoming.length }, { value: 'past', label: 'Sudah lewat', count: past.length }]} />
          </div>
          {list.length ? (
            <ul className="space-y-3">
              {list.map((a) => {
                const n = db.participants.filter((p) => p.activity_id === a.id).length;
                const d = new Date(a.start_at);
                return (
                  <li key={a.id} data-card>
                    <button onClick={() => setOpenId(a.id)} className="card-lift flex w-full items-center gap-4 rounded-[18px] border border-line bg-card p-4 text-left shadow-sm hover:border-primary/40">
                      <span className="grid w-14 shrink-0 place-items-center rounded-2xl bg-primary-soft py-2 leading-none text-primary-soft-ink">
                        <span className="text-[11px] font-bold uppercase">{d.toLocaleDateString('id-ID', { month: 'short', timeZone: 'Asia/Jakarta' })}</span>
                        <span className="mt-1 text-[22px] font-extrabold">{d.toLocaleDateString('id-ID', { day: 'numeric', timeZone: 'Asia/Jakarta' })}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2"><span className={cx('size-2 rounded-full', CAT[a.category][1])} /><span className="truncate text-[15px] font-bold">{a.title}</span></span>
                        <span className="mt-0.5 flex items-center gap-1 truncate text-[12.5px] text-muted"><Clock3 className="size-3.5" />{DAYS[new Date(ymd(a.start_at) + 'T12:00:00+07:00').getUTCDay()]}, {time(a.start_at)} WIB</span>
                        <span className="flex items-center gap-1 truncate text-[12.5px] text-muted"><MapPin className="size-3.5" />{a.location}</span>
                      </span>
                      <span className="flex flex-col items-end gap-1.5">
                        <StatusBadge map={ACTIVITY} value={a.status} />
                        <span className="inline-flex items-center gap-1 text-[12px] text-muted"><Users className="size-3.5" />{n}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Card><EmptyState icon={CalendarDays} title="Belum ada kegiatan" text="Agenda baru akan muncul di sini." /></Card>
          )}
        </div>
      </div>
      <Detail id={openId} onClose={() => setOpenId(null)} />
      <CreateForm open={create} onClose={() => setCreate(false)} />
    </div>
  );
}

function Calendar({ onOpen }: { onOpen: (id: string) => void }) {
  const db = useDatabase();
  const t = jakartaParts();
  const [ym, setYm] = useState({ y: t.year, m: t.month });
  const first = new Date(Date.UTC(ym.y, ym.m - 1, 1));
  const startDow = first.getUTCDay();
  const days = new Date(Date.UTC(ym.y, ym.m, 0)).getUTCDate();
  const cells = Array.from({ length: Math.ceil((startDow + days) / 7) * 7 }, (_, i) => i - startDow + 1);
  const byDay = useMemo(() => {
    const m = new Map<string, Activity[]>();
    db.activities.forEach((a) => {
      const k = ymd(a.start_at);
      m.set(k, [...(m.get(k) ?? []), a]);
    });
    return m;
  }, [db]);
  const shift = (d: number) => setYm(({ y, m }) => (m + d < 1 ? { y: y - 1, m: 12 } : m + d > 12 ? { y: y + 1, m: 1 } : { y, m: m + d }));
  const todayKey = `${t.year}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')}`;

  return (
    <Card data-card className="p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[17px] font-extrabold">{MONTHS[ym.m - 1]} {ym.y}</p>
        <div className="flex gap-1">
          <button onClick={() => shift(-1)} aria-label="Bulan sebelumnya" className="grid size-9 place-items-center rounded-lg border border-line hover:bg-panel"><ChevronLeft className="size-4" /></button>
          <button onClick={() => setYm({ y: t.year, m: t.month })} className="h-9 rounded-lg border border-line px-3 text-[13px] font-semibold hover:bg-panel">Hari ini</button>
          <button onClick={() => shift(1)} aria-label="Bulan berikutnya" className="grid size-9 place-items-center rounded-lg border border-line hover:bg-panel"><ChevronRight className="size-4" /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11.5px] font-semibold text-muted">
        {DAYS.map((d) => <div key={d} className="py-1">{d.slice(0, 3)}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          const valid = d >= 1 && d <= days;
          const key = `${ym.y}-${String(ym.m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const acts = valid ? byDay.get(key) ?? [] : [];
          return (
            <div key={i} className={cx('min-h-[64px] rounded-xl p-1.5 text-left sm:min-h-[84px]', valid ? 'bg-panel/50' : '', key === todayKey && valid ? 'ring-2 ring-primary' : '')}>
              {valid ? <span className={cx('text-[12.5px] font-bold', key === todayKey ? 'text-primary' : 'text-ink-2')}>{d}</span> : null}
              <div className="mt-1 space-y-1">
                {acts.slice(0, 2).map((a) => (
                  <button key={a.id} onClick={() => onOpen(a.id)} title={a.title} className={cx('block w-full truncate rounded-md px-1.5 py-0.5 text-left text-[10.5px] font-semibold text-white', CAT[a.category][1])}>
                    <span className="hidden sm:inline">{a.title}</span><span className="sm:hidden">•</span>
                  </button>
                ))}
                {acts.length > 2 ? <span className="block text-[10.5px] text-muted">+{acts.length - 2}</span> : null}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-[12px] text-muted">
        {Object.values(CAT).map(([l, c]) => <span key={l} className="inline-flex items-center gap-1.5"><span className={cx('size-2.5 rounded-sm', c)} />{l}</span>)}
      </div>
    </Card>
  );
}

function Detail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const db = useDatabase();
  const me = useMe()!;
  const L = useLookups();
  const toast = useToast();
  const [shown, setShown] = useState<string | null>(null);
  if (id && id !== shown) setShown(id);
  const a = db.activities.find((x) => x.id === shown);
  const manage = can(me.role, 'activities.manage');
  const parts = db.participants.filter((p) => p.activity_id === a?.id);
  const family = db.residents.filter((r) => r.household_id === me.householdId && r.is_active);
  const present = parts.filter((p) => p.attendance_status === 'present').length;

  const toggle = (rid: string) => {
    const r = actions.toggleJoin(a!.id, rid);
    if (!r.ok) return toast(r.error, 'error');
    toast(r.data ? `${L.resident(rid)?.full_name.split(' ')[0]} terdaftar sebagai peserta` : 'Pendaftaran dibatalkan');
  };
  const mark = (rid: string, s: AttendanceStatus) => actions.setAttendance(a!.id, rid, s);

  return (
    <Sheet open={!!id} onClose={onClose} label="Detail kegiatan" wide>
      {a ? (
        <div className="flex h-full flex-col">
          <div className="border-b border-line px-6 py-5">
            <div className="flex items-center gap-2"><Badge tone="gray">{CAT[a.category][0]}</Badge><StatusBadge map={ACTIVITY} value={a.status} /></div>
            <h2 className="mt-2 text-[21px] font-extrabold">{a.title}</h2>
            <p className="mt-1 flex items-center gap-1.5 text-[13.5px] text-ink-2"><Clock3 className="size-4 text-muted" />{dateDay(a.start_at)} · {time(a.start_at)}{a.end_at ? `–${time(a.end_at)}` : ''} WIB</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[13.5px] text-ink-2"><MapPin className="size-4 text-muted" />{a.location}</p>
          </div>
          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
            {a.description ? <p className="text-[14.5px] leading-relaxed text-ink-2" data-sheet-item>{a.description}</p> : null}

            {a.status === 'planned' ? (
              <section data-sheet-item>
                <p className="mb-2 text-[13px] font-semibold text-ink-2">Ikut serta dari keluarga Anda</p>
                <div className="flex flex-wrap gap-2">
                  {family.map((r) => {
                    const on = parts.some((p) => p.resident_id === r.id);
                    return (
                      <button key={r.id} onClick={() => toggle(r.id)} aria-pressed={on} className={cx('inline-flex h-10 items-center gap-2 rounded-full border pr-3.5 pl-1.5 text-[13px] font-semibold', on ? 'border-primary bg-primary-soft text-primary-soft-ink' : 'border-line text-ink-2 hover:bg-panel')}>
                        <Avatar name={r.full_name} size={28} />{r.full_name.split(' ')[0]}{on ? <UserCheck className="size-4" /> : null}
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : null}

            <section data-sheet-item>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[13px] font-semibold text-ink-2">Peserta ({parts.length})</p>
                {a.status === 'done' ? <Badge tone="green">{present} hadir</Badge> : null}
              </div>
              <ul className="divide-y divide-line rounded-2xl border border-line">
                {parts.map((p) => {
                  const r = L.resident(p.resident_id);
                  return (
                    <li key={p.resident_id} className="flex items-center gap-3 px-3.5 py-2.5">
                      <Avatar name={r?.full_name ?? '?'} size={30} />
                      <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{r?.full_name}<span className="ml-1.5 font-normal text-muted">{L.household(r?.household_id)?.house_number}</span></span>
                      {manage && a.status !== 'planned' ? (
                        <Select value={p.attendance_status} onChange={(e) => mark(p.resident_id, e.target.value as AttendanceStatus)} className="h-8 w-auto text-[12.5px]" aria-label="Kehadiran">
                          <option value="registered">Terdaftar</option><option value="present">Hadir</option><option value="absent">Tidak hadir</option><option value="excused">Izin</option>
                        </Select>
                      ) : (
                        <Badge tone={p.attendance_status === 'present' ? 'green' : p.attendance_status === 'absent' ? 'red' : 'gray'}>{{ registered: 'Terdaftar', present: 'Hadir', absent: 'Tidak hadir', excused: 'Izin' }[p.attendance_status]}</Badge>
                      )}
                    </li>
                  );
                })}
                {!parts.length ? <li className="px-4 py-6 text-center text-[13px] text-muted">Belum ada peserta.</li> : null}
              </ul>
            </section>
          </div>
          {manage ? (
            <div className="flex flex-wrap justify-end gap-2 border-t border-line px-6 py-4">
              {a.status === 'planned' ? <><Button variant="secondary" onClick={() => (actions.setActivityStatus(a.id, 'cancelled'), toast('Kegiatan dibatalkan'))}>Batalkan</Button><Button onClick={() => (actions.setActivityStatus(a.id, 'ongoing'), toast('Kegiatan dimulai, silakan catat kehadiran'))}>Mulai & catat kehadiran</Button></> : null}
              {a.status === 'ongoing' ? <Button variant="success" onClick={() => (actions.setActivityStatus(a.id, 'done'), toast('Kegiatan ditandai selesai'))}>Tandai selesai</Button> : null}
              <Button variant="ghost" onClick={onClose}>Tutup</Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </Sheet>
  );
}

function CreateForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const id = useId();
  const [f, setF] = useState({ title: '', category: 'kerja_bakti' as Activity['category'], date: '', start: '07:00', end: '10:00', location: '', description: '' });
  const [err, setErr] = useState('');
  useEffect(() => { if (open) (setF({ title: '', category: 'kerja_bakti', date: '', start: '07:00', end: '10:00', location: '', description: '' }), setErr('')); }, [open]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!f.date) return setErr('Tanggal wajib diisi');
    const r = actions.saveActivity({ title: f.title, category: f.category, location: f.location, description: f.description, start_at: new Date(`${f.date}T${f.start}:00+07:00`).toISOString(), end_at: f.end ? new Date(`${f.date}T${f.end}:00+07:00`).toISOString() : null });
    if (!r.ok) return setErr(r.error);
    toast('Kegiatan dibuat & warga diberi tahu');
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} labelledBy={id}>
      <form onSubmit={submit} noValidate>
        <DialogShell id={id} title="Buat kegiatan" icon={CalendarPlus} onClose={onClose} footer={<><Button type="button" variant="secondary" onClick={onClose}>Batal</Button><Button type="submit">Simpan & umumkan</Button></>}>
          <div className="space-y-4">
            <Field label="Nama kegiatan" required><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Contoh: Kerja Bakti Bulanan" /></Field>
            <Field label="Jenis"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as Activity['category'] })}>{Object.entries(CAT).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Tanggal" required className="col-span-2 sm:col-span-1"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
              <Field label="Mulai"><Input type="time" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></Field>
              <Field label="Selesai"><Input type="time" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></Field>
            </div>
            <Field label="Lokasi" required><Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="Balai Warga" /></Field>
            <Field label="Keterangan"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
            {err ? <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-[13.5px] font-medium text-danger-ink">{err}</p> : null}
          </div>
        </DialogShell>
      </form>
    </Modal>
  );
}
