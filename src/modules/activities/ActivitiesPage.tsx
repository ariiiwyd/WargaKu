import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, CirclePlay, Clock3, MapPin, NotebookPen, Pencil, Radio, Share2, UserCheck, Users, Video,
} from 'lucide-react';
import { Modal, Sheet, usePageEnter, useToast } from '@/motion';
import { PageHeader, Magnetic } from '@/components/ui/PageHeader';
import { Avatar, Badge, Button, Card, Choice, EmptyState, Field, Input, Select, Textarea, cx, type Tone } from '@/components/ui/primitives';
import { ConfirmDialog, DialogShell } from '@/components/ui/DialogShell';
import { Tabs } from '@/components/ui/Tabs';
import { StatusBadge, ACTIVITY } from '@/components/ui/status';
import { useDatabase, useLookups, useMe } from '@/hooks/useData';
import { useAct } from '@/hooks/useAct';
import { useJoinMeeting } from '@/hooks/useJoinMeeting';
import { actions } from '@/stores/db.store';
import { can } from '@/app/permissions';
import { DAYS, MONTHS, dateDay, dateTime, jakartaParts, time } from '@/lib/format';
import { isMeetingLive, meetingProvider, meetingUrlError, MEETING_MODE } from '@/lib/meeting';
import type { Activity, AttendanceStatus, MeetingMode } from '@/types/models';

const CAT: Record<Activity['category'], [string, string]> = {
  kerja_bakti: ['Kerja bakti', 'bg-success'],
  rapat: ['Rapat', 'bg-primary'],
  sosial: ['Sosial', 'bg-warn'],
  keagamaan: ['Keagamaan', 'bg-[#8B5CF6]'],
  olahraga: ['Olahraga', 'bg-[#0EA5E9]'],
  lainnya: ['Lainnya', 'bg-muted'],
};
const ATTENDANCE: Record<AttendanceStatus, [string, Tone]> = {
  registered: ['Terdaftar', 'gray'],
  present: ['Hadir', 'green'],
  present_online: ['Hadir online', 'blue'],
  absent: ['Tidak hadir', 'red'],
  excused: ['Izin', 'gray'],
};
const ymd = (iso: string) => {
  const p = jakartaParts(new Date(iso));
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
};

/** Lencana mode rapat (Online/Hybrid) + "Berlangsung" saat tombol gabung aktif. */
function MeetingBadges({ a }: { a: Activity }) {
  if (a.meeting_mode === 'offline') return null;
  return (
    <>
      <Badge tone="blue"><Video className="size-3" />{MEETING_MODE[a.meeting_mode]}</Badge>
      {isMeetingLive(a) ? <Badge tone="green" dot>Bisa gabung</Badge> : null}
    </>
  );
}

export function ActivitiesPage() {
  const db = useDatabase();
  const me = useMe()!;
  const ref = useRef<HTMLDivElement>(null);
  usePageEnter(ref);
  const manage = can(me.role, 'activities.manage');
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState<Activity | 'new' | null>(null);
  const now = new Date().toISOString();
  const upcoming = db.activities.filter((a) => a.status !== 'done' && a.status !== 'cancelled' && (a.status === 'ongoing' || (a.end_at ?? a.start_at) >= now)).sort((a, b) => a.start_at.localeCompare(b.start_at));
  const past = db.activities.filter((a) => !upcoming.includes(a)).sort((a, b) => b.start_at.localeCompare(a.start_at));
  const list = tab === 'upcoming' ? upcoming : past;

  return (
    <div ref={ref}>
      <PageHeader title="Kegiatan" description="Kalender kegiatan lingkungan: kerja bakti, rapat warga, pengajian, posyandu, dan agenda lainnya. Rapat bisa diikuti online lewat Google Meet atau Zoom."
        actions={manage ? <Magnetic><Button icon={CalendarPlus} onClick={() => setForm('new')}>Buat kegiatan</Button></Magnetic> : null} />
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
                        <span className="flex items-center gap-2"><span className={cx('size-2 shrink-0 rounded-full', CAT[a.category][1])} /><span className="truncate text-[15px] font-bold">{a.title}</span></span>
                        <span className="mt-0.5 flex items-center gap-1 truncate text-[12.5px] text-muted"><Clock3 className="size-3.5" />{DAYS[new Date(ymd(a.start_at) + 'T12:00:00+07:00').getUTCDay()]}, {time(a.start_at)} WIB</span>
                        <span className="flex items-center gap-1 truncate text-[12.5px] text-muted"><MapPin className="size-3.5" />{a.meeting_mode === 'online' ? `Online · ${meetingProvider(a.meeting_url)}` : a.location}</span>
                        {a.meeting_mode !== 'offline' ? <span className="mt-1.5 flex flex-wrap gap-1.5"><MeetingBadges a={a} /></span> : null}
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
      <Detail id={openId} onClose={() => setOpenId(null)} onEdit={(a) => (setOpenId(null), setForm(a))} />
      <ActivityForm value={form} onClose={() => setForm(null)} />
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
                  <button key={a.id} onClick={() => onOpen(a.id)} title={a.meeting_mode !== 'offline' ? `${a.title} (${MEETING_MODE[a.meeting_mode]})` : a.title} className={cx('flex w-full items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-left text-[10.5px] font-semibold text-white', CAT[a.category][1])}>
                    {a.meeting_mode !== 'offline' ? <Video className="size-3 shrink-0" aria-label="Ada rapat online" /> : null}
                    <span className="hidden truncate sm:inline">{a.title}</span><span className="sm:hidden">•</span>
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
        <span className="inline-flex items-center gap-1.5"><Video className="size-3.5" />Bisa diikuti online</span>
      </div>
    </Card>
  );
}

function Detail({ id, onClose, onEdit }: { id: string | null; onClose: () => void; onEdit: (a: Activity) => void }) {
  const db = useDatabase();
  const me = useMe()!;
  const L = useLookups();
  const toast = useToast();
  const act = useAct();
  const join = useJoinMeeting();
  const [shown, setShown] = useState<string | null>(null);
  if (id && id !== shown) setShown(id);
  const a = db.activities.find((x) => x.id === shown);
  const manage = can(me.role, 'activities.manage');
  const parts = db.participants.filter((p) => p.activity_id === a?.id);
  const family = db.residents.filter((r) => r.household_id === me.householdId && r.is_active);
  const present = parts.filter((p) => p.attendance_status === 'present').length;
  const online = parts.filter((p) => p.attendance_status === 'present_online').length;
  // RLS: warga hanya dapat membaca data keluarganya sendiri; peserta lain dihitung tanpa nama.
  const named = parts.filter((p) => L.resident(p.resident_id));
  const hidden = parts.length - named.length;
  const live = a ? isMeetingLive(a) : false;

  const toggle = async (rid: string) => {
    const r = await actions.toggleJoin(a!.id, rid);
    if (!r.ok) return toast(r.error, 'error');
    toast(r.data ? `${L.resident(rid)?.full_name.split(' ')[0]} terdaftar sebagai peserta` : 'Pendaftaran dibatalkan');
  };
  const mark = (rid: string, s: AttendanceStatus) => act(actions.setAttendance(a!.id, rid, s));

  return (
    <Sheet open={!!id} onClose={onClose} label="Detail kegiatan" wide>
      {a ? (
        <div className="flex h-full flex-col">
          <div className="border-b border-line px-6 py-5">
            <div className="flex flex-wrap items-center gap-2"><Badge tone="gray">{CAT[a.category][0]}</Badge><StatusBadge map={ACTIVITY} value={a.status} /><MeetingBadges a={a} /></div>
            <h2 className="mt-2 text-[21px] font-extrabold">{a.title}</h2>
            <p className="mt-1 flex items-center gap-1.5 text-[13.5px] text-ink-2"><Clock3 className="size-4 text-muted" />{dateDay(a.start_at)} · {time(a.start_at)}{a.end_at ? `–${time(a.end_at)}` : ''} WIB</p>
            {a.meeting_mode !== 'online' ? <p className="mt-0.5 flex items-center gap-1.5 text-[13.5px] text-ink-2"><MapPin className="size-4 text-muted" />{a.location}</p> : null}
          </div>
          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
            {a.meeting_mode !== 'offline' && a.status !== 'cancelled' ? (
              <section data-sheet-item className={cx('rounded-2xl border p-4', live ? 'border-primary/40 bg-primary-soft/60' : 'border-line bg-panel/50')}>
                <div className="flex items-start gap-3">
                  <span className={cx('grid size-10 shrink-0 place-items-center rounded-xl', live ? 'bg-primary text-white' : 'bg-card text-primary shadow-sm')}>
                    {live ? <Radio className="size-5" /> : <Video className="size-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14.5px] font-bold text-ink">{a.meeting_mode === 'hybrid' ? 'Bisa hadir langsung atau online' : 'Rapat online'}</p>
                    <p className="text-[13px] text-ink-2">
                      {a.status === 'done'
                        ? 'Rapat sudah selesai.'
                        : live
                          ? `Rapat sudah dibuka di ${meetingProvider(a.meeting_url)}. Kehadiran Anda tercatat otomatis saat bergabung.`
                          : `Tombol gabung aktif 15 menit sebelum rapat dimulai (${time(a.start_at)} WIB).`}
                    </p>
                  </div>
                </div>
                {a.status !== 'done' ? (
                  <Button className="mt-3 w-full sm:w-auto" icon={Video} disabled={!live} onClick={() => join(a)}>
                    Gabung lewat {meetingProvider(a.meeting_url)}
                  </Button>
                ) : null}
              </section>
            ) : null}

            {a.description ? <p className="text-[14.5px] leading-relaxed text-ink-2" data-sheet-item>{a.description}</p> : null}

            {a.status === 'planned' ? (
              <section data-sheet-item>
                <p className="mb-2 text-[13px] font-semibold text-ink-2">{a.meeting_mode === 'online' ? 'Daftarkan keluarga Anda' : 'Ikut serta dari keluarga Anda'}</p>
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
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[13px] font-semibold text-ink-2">Peserta ({parts.length})</p>
                {a.status !== 'planned' && (present || online) ? (
                  <Badge tone="green">{present + online} hadir{online ? ` (${online} online)` : ''}</Badge>
                ) : null}
              </div>
              <ul className="divide-y divide-line rounded-2xl border border-line">
                {named.map((p) => {
                  const r = L.resident(p.resident_id);
                  const [label, tone] = ATTENDANCE[p.attendance_status];
                  return (
                    <li key={p.resident_id} className="flex items-center gap-3 px-3.5 py-2.5">
                      <Avatar name={r?.full_name ?? '?'} size={30} />
                      <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{r?.full_name}<span className="ml-1.5 font-normal text-muted">{L.household(r?.household_id)?.house_number}</span></span>
                      {manage && a.status !== 'planned' ? (
                        <Select value={p.attendance_status} onChange={(e) => mark(p.resident_id, e.target.value as AttendanceStatus)} className="h-8 w-auto text-[12.5px]" aria-label="Kehadiran">
                          {(Object.keys(ATTENDANCE) as AttendanceStatus[]).map((s) => <option key={s} value={s}>{ATTENDANCE[s][0]}</option>)}
                        </Select>
                      ) : (
                        <Badge tone={tone}>{label}</Badge>
                      )}
                    </li>
                  );
                })}
                {hidden > 0 ? <li className="px-4 py-3 text-[13px] text-muted">+{hidden} warga lain terdaftar</li> : null}
                {!parts.length ? <li className="px-4 py-6 text-center text-[13px] text-muted">Belum ada peserta.</li> : null}
              </ul>
            </section>

            <Minutes a={a} manage={manage} />
          </div>
          {manage ? (
            <div className="flex flex-wrap justify-end gap-2 border-t border-line px-6 py-4">
              {a.status === 'planned' ? <Button variant="ghost" icon={Pencil} onClick={() => onEdit(a)}>Ubah</Button> : null}
              {a.status === 'planned' ? <><Button variant="secondary" onClick={() => act(actions.setActivityStatus(a.id, 'cancelled'), 'Kegiatan dibatalkan')}>Batalkan</Button><Button onClick={() => act(actions.setActivityStatus(a.id, 'ongoing'), a.meeting_mode !== 'offline' ? 'Rapat dimulai, warga diberi tahu untuk gabung online' : 'Kegiatan dimulai, silakan catat kehadiran')}>{a.meeting_mode !== 'offline' ? 'Mulai rapat' : 'Mulai & catat kehadiran'}</Button></> : null}
              {a.status === 'ongoing' ? <Button variant="success" onClick={() => act(actions.setActivityStatus(a.id, 'done'), 'Kegiatan ditandai selesai')}>Tandai selesai</Button> : null}
              <Button variant="ghost" onClick={onClose}>Tutup</Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </Sheet>
  );
}

/** Notulen & tautan rekaman: pengurus menulis lalu membagikan; warga membaca. */
function Minutes({ a, manage }: { a: Activity; manage: boolean }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [rec, setRec] = useState('');
  const [err, setErr] = useState('');
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    setEditing(false);
    setErr('');
  }, [a.id]);

  const canWrite = manage && (a.status === 'ongoing' || a.status === 'done');
  if (!a.minutes && !a.recording_url && !canWrite) return null;

  const start = () => {
    setText(a.minutes ?? '');
    setRec(a.recording_url ?? '');
    setErr('');
    setEditing(true);
  };
  const check = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return setErr('Tulis notulen atau keputusan rapat.');
    if (rec.trim() && !/^https:\/\//i.test(rec.trim())) return setErr('Tautan rekaman harus diawali https://');
    setConfirm(true);
  };
  const publish = async () => {
    const r = await actions.publishMinutes(a.id, text, rec);
    if (!r.ok) {
      toast(r.error, 'error');
      return false;
    }
    toast('Notulen dibagikan ke seluruh warga');
    setConfirm(false);
    setEditing(false);
    return true;
  };

  return (
    <section data-sheet-item>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-2"><NotebookPen className="size-4" />Notulen & hasil rapat</p>
        {canWrite && !editing ? <Button size="sm" variant="soft" icon={Pencil} onClick={start}>{a.minutes ? 'Ubah notulen' : 'Tulis notulen'}</Button> : null}
      </div>

      {editing ? (
        <form onSubmit={check} className="space-y-3 rounded-2xl border border-line p-4" noValidate>
          <Field label="Notulen & keputusan" required hint="Tulis poin pembahasan dan keputusan rapat, satu per baris.">
            <Textarea value={text} onChange={(e) => (setText(e.target.value), setErr(''))} className="min-h-[160px]" placeholder={'1. Iuran kebersihan tetap Rp50.000\n2. Kerja bakti berikutnya Minggu, 13 Desember'} />
          </Field>
          <Field label="Tautan rekaman (opsional)" hint="Mis. tautan Google Drive atau YouTube (tidak publik) yang bisa dibuka warga.">
            <Input type="url" inputMode="url" value={rec} onChange={(e) => (setRec(e.target.value), setErr(''))} placeholder="https://drive.google.com/…" />
          </Field>
          {err ? <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-[13.5px] font-medium text-danger-ink">{err}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setEditing(false)}>Batal</Button>
            <Button type="submit" icon={Share2}>Bagikan ke warga</Button>
          </div>
        </form>
      ) : a.minutes || a.recording_url ? (
        <div className="rounded-2xl border border-line bg-panel/40 p-4">
          {a.minutes ? <p className="max-w-[65ch] text-[14.5px] leading-[1.7] whitespace-pre-line text-ink-2">{a.minutes}</p> : null}
          {a.recording_url ? (
            <a href={a.recording_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-[13.5px] font-semibold text-white hover:bg-primary-hover">
              <CirclePlay className="size-[18px]" />Tonton rekaman
            </a>
          ) : null}
          {a.minutes_published_at ? <p className="mt-3 text-[12px] text-muted">Dibagikan {dateTime(a.minutes_published_at)}</p> : null}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-line px-4 py-5 text-center text-[13px] text-muted">Belum ada notulen. Tulis setelah rapat lalu bagikan agar warga yang tidak hadir tetap tahu hasilnya.</p>
      )}

      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} icon={Share2} tone="green" title="Bagikan notulen ke warga?" confirmLabel="Bagikan"
        message={<>Notulen{rec.trim() ? ' dan tautan rekaman' : ''} untuk <b>{a.title}</b> akan bisa dibaca semua warga, dan notifikasi dikirim ke seluruh akun.</>}
        onConfirm={publish} />
    </section>
  );
}

type FormState = { title: string; category: Activity['category']; date: string; start: string; end: string; location: string; description: string; mode: MeetingMode; url: string };
const blankForm: FormState = { title: '', category: 'kerja_bakti', date: '', start: '07:00', end: '10:00', location: '', description: '', mode: 'offline', url: '' };
const toLocal = (iso: string) => {
  const p = jakartaParts(new Date(iso));
  const t = new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' });
  return { date: `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`, time: t };
};

function ActivityForm({ value, onClose }: { value: Activity | 'new' | null; onClose: () => void }) {
  const toast = useToast();
  const id = useId();
  const editing = value && value !== 'new' ? value : null;
  const [f, setF] = useState<FormState>(blankForm);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!value) return;
    setErr('');
    if (value === 'new') return setF(blankForm);
    const s = toLocal(value.start_at);
    setF({
      title: value.title, category: value.category, date: s.date, start: s.time, end: value.end_at ? toLocal(value.end_at).time : '',
      location: value.location, description: value.description, mode: value.meeting_mode, url: value.meeting_url ?? '',
    });
  }, [value]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!f.date) return setErr('Tanggal wajib diisi');
    if (f.mode !== 'offline') {
      const u = meetingUrlError(f.url);
      if (u) return setErr(u);
    }
    const r = await actions.saveActivity({
      id: editing?.id, title: f.title, category: f.category, location: f.mode === 'online' && !f.location.trim() ? 'Online' : f.location,
      description: f.description, start_at: new Date(`${f.date}T${f.start}:00+07:00`).toISOString(),
      end_at: f.end ? new Date(`${f.date}T${f.end}:00+07:00`).toISOString() : null, meeting_mode: f.mode, meeting_url: f.url,
    });
    if (!r.ok) return setErr(r.error);
    toast(editing ? 'Kegiatan diperbarui' : 'Kegiatan dibuat & warga diberi tahu');
    onClose();
  };

  return (
    <Modal open={!!value} onClose={onClose} labelledBy={id}>
      <form onSubmit={submit} noValidate>
        <DialogShell id={id} title={editing ? 'Ubah kegiatan' : 'Buat kegiatan'} icon={editing ? Pencil : CalendarPlus} onClose={onClose}
          footer={<><Button type="button" variant="secondary" onClick={onClose}>Batal</Button><Button type="submit">{editing ? 'Simpan perubahan' : 'Simpan & umumkan'}</Button></>}>
          <div className="space-y-4">
            <Field label="Nama kegiatan" required><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Contoh: Rapat Warga Akhir Tahun" /></Field>
            <Field label="Jenis"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as Activity['category'] })}>{Object.entries(CAT).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Tanggal" required className="col-span-2 sm:col-span-1"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
              <Field label="Mulai"><Input type="time" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></Field>
              <Field label="Selesai"><Input type="time" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></Field>
            </div>
            <Field label="Cara hadir">
              <Choice<MeetingMode> name="Cara hadir" value={f.mode} onChange={(mode) => (setF({ ...f, mode }), setErr(''))}
                options={[{ value: 'offline', label: 'Tatap muka', icon: MapPin }, { value: 'hybrid', label: 'Hybrid', icon: Users }, { value: 'online', label: 'Online', icon: Video }]} />
            </Field>
            {f.mode !== 'offline' ? (
              <Field label="Tautan Google Meet atau Zoom" required hint="Buat rapat di Google Meet (meet.google.com → Rapat baru → Buat rapat untuk nanti) atau Zoom, lalu tempel tautannya di sini.">
                <Input type="url" inputMode="url" value={f.url} onChange={(e) => (setF({ ...f, url: e.target.value }), setErr(''))} placeholder="https://meet.google.com/abc-defg-hij" />
              </Field>
            ) : null}
            {f.mode !== 'online' ? (
              <Field label="Lokasi" required><Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="Balai Warga" /></Field>
            ) : null}
            <Field label="Keterangan"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Agenda rapat, hal yang perlu disiapkan warga…" /></Field>
            {err ? <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-[13.5px] font-medium text-danger-ink">{err}</p> : null}
          </div>
        </DialogShell>
      </form>
    </Modal>
  );
}
