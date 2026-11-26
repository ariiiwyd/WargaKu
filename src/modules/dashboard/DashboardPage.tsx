import { useMemo, useRef, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight, BookUser, CalendarDays, ChevronRight, CircleCheckBig, Clock3, FileSignature, FileText, HandCoins, Megaphone,
  MessageSquareWarning, ShieldCheck, Siren, Users, Wallet, type LucideIcon,
} from 'lucide-react';
import { CountUp, Meter, SplitTitle, usePageEnter } from '@/motion';
import { Badge, Card, CardHeader, cx } from '@/components/ui/primitives';
import { NeighborhoodScene } from '@/components/ui/Scene';
import { LiveMeetingCard } from '@/components/meeting/LiveMeetingCard';
import { CashFlowChart, Legend } from '@/components/charts/CashFlowChart';
import { useChartColors } from '@/components/charts/useChartColors';
import { StatusBadge, REQUEST, COMPLAINT, INVOICE } from '@/components/ui/status';
import { cashByMonth, cashSummary, useDatabase, useLookups, useMe } from '@/hooks/useData';
import { can, roleWithRt } from '@/app/permissions';
import { dateDay, greeting, jakartaParts, MONTHS, period, relative, rupiah, time, todayISO } from '@/lib/format';
import type { Actor } from '@/stores/db.store';
import type { Database } from '@/types/models';

export function DashboardPage() {
  const me = useMe()!;
  return me.role === 'warga' ? <ResidentHome me={me} /> : <AdminDashboard me={me} />;
}

function honorific(db: Database, me: Actor) {
  const r = db.residents.find((x) => x.id === me.residentId);
  const first = me.name.split(' ')[0];
  return `${r?.gender === 'P' ? 'Bu' : 'Pak'} ${first}`;
}

/* ================================================================== ADMIN */
function AdminDashboard({ me }: { me: Actor }) {
  const db = useDatabase();
  const L = useLookups();
  const ref = useRef<HTMLDivElement>(null);
  const c = useChartColors();
  usePageEnter(ref);

  const { year, month } = jakartaParts();
  const stats = useMemo(() => {
    const active = db.residents.filter((r) => r.is_active);
    const newThisMonth = active.filter((r) => r.created_at.slice(0, 7) === `${year}-${String(month).padStart(2, '0')}`).length;
    const openLetters = db.letters.filter((l) => ['submitted', 'review', 'revision'].includes(l.status));
    const upcoming = db.activities.filter((a) => a.status === 'planned' && a.start_at >= new Date().toISOString()).sort((a, b) => a.start_at.localeCompare(b.start_at));
    const monthInv = db.invoices.filter((i) => i.period_month === month && i.period_year === year && i.status !== 'cancelled');
    const collected = monthInv.reduce((s, i) => s + i.paid_amount, 0);
    const target = monthInv.reduce((s, i) => s + i.amount, 0);
    return { active, newThisMonth, openLetters, upcoming, collected, target, paidHH: monthInv.filter((i) => i.status === 'paid').length, totalHH: monthInv.length, ...cashSummary(db) };
  }, [db, year, month]);

  const tasks = useMemo(() => {
    const t: { icon: LucideIcon; tone: string; title: string; text: string; to: string; count: number }[] = [];
    const pendingPay = db.payments.filter((p) => p.status === 'pending').length;
    if (can(me.role, 'payments.verify') && pendingPay) t.push({ icon: HandCoins, tone: 'bg-warn-soft text-warn-ink', title: 'Verifikasi pembayaran', text: 'Bukti transfer menunggu diperiksa', to: '/iuran?tab=verifikasi', count: pendingPay });
    const toSign = db.letters.filter((l) => l.status === 'review').length;
    if (can(me.role, 'letters.approve') && toSign) t.push({ icon: FileSignature, tone: 'bg-violet-soft text-violet-ink', title: 'Tanda tangani surat', text: 'Sudah diperiksa Sekretaris', to: '/surat?tab=review', count: toSign });
    const toReview = db.letters.filter((l) => l.status === 'submitted').length;
    if (me.role === 'sekretaris' && toReview) t.push({ icon: FileText, tone: 'bg-primary-soft text-primary-soft-ink', title: 'Periksa permohonan surat', text: 'Cek kelengkapan berkas', to: '/surat?tab=submitted', count: toReview });
    const toAssign = db.complaints.filter((x) => x.status === 'submitted').length;
    if (can(me.role, 'complaints.assign') && toAssign) t.push({ icon: MessageSquareWarning, tone: 'bg-danger-soft text-danger-ink', title: 'Tugaskan pengaduan', text: 'Pengaduan baru belum ada petugas', to: '/pengaduan', count: toAssign });
    const mine = db.complaints.filter((x) => x.assigned_to === me.userId && ['assigned', 'in_progress'].includes(x.status)).length;
    if (me.role === 'pengurus' && mine) t.push({ icon: MessageSquareWarning, tone: 'bg-danger-soft text-danger-ink', title: 'Tindak lanjuti pengaduan', text: 'Ditugaskan kepada Anda', to: '/pengaduan', count: mine });
    const drafts = db.announcements.filter((a) => a.status === 'draft').length;
    if (can(me.role, 'announcements.publish') && drafts) t.push({ icon: Megaphone, tone: 'bg-primary-soft text-primary-soft-ink', title: 'Publikasikan pengumuman', text: 'Draft menunggu persetujuan', to: '/pengumuman', count: drafts });
    const openInc = db.incidents.filter((i) => i.status === 'open').length;
    if (can(me.role, 'security.manage') && openInc) t.push({ icon: Siren, tone: 'bg-danger-soft text-danger-ink', title: 'Kejadian keamanan terbuka', text: 'Perlu ditangani regu ronda', to: '/keamanan?tab=kejadian', count: openInc });
    return t;
  }, [db, me]);

  const tonight = db.patrolSchedules.find((s) => s.patrol_date === todayISO());
  const tonightTeam = db.patrolTeams.find((t) => t.id === tonight?.team_id);
  const flow = cashByMonth(db, 6);
  const announcements = db.announcements.filter((a) => a.status === 'published').sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned) || (b.published_at ?? '').localeCompare(a.published_at ?? '')).slice(0, 3);
  const feed = db.audit.slice(0, 5);

  return (
    <div ref={ref}>
      <LiveMeetingCard />
      <Hero
        title={`${greeting()}, ${honorific(db, me)}`}
        sub={`${roleWithRt(me.role, db.neighborhood.rt_number)} · ${dateDay(new Date())}`}
        chips={[
          tasks.length ? `${tasks.reduce((s, t) => s + t.count, 0)} hal menunggu tindakan Anda` : 'Semua pekerjaan beres hari ini',
          tonightTeam ? `Ronda malam ini: ${tonightTeam.name}` : '',
        ]}
      />

      {/* Stat row */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat icon={Users} tone="blue" label="Total warga aktif" to={can(me.role, 'residents.view') ? '/warga' : undefined}
          value={<CountUp value={stats.active.length} />} foot={`${new Set(stats.active.map((r) => r.household_id)).size} keluarga`} />
        <Stat icon={FileText} tone="violet" label="Surat dalam proses" to="/surat" value={<CountUp value={stats.openLetters.length} />}
          foot={`${db.letters.filter((l) => l.status === 'submitted').length} baru diajukan`} />
        <Stat icon={Wallet} tone="green" label="Saldo kas RT" to={can(me.role, 'cash.view') ? '/iuran?tab=kas' : undefined}
          value={<CountUp value={stats.balance} format={(n) => rupiah(n)} />} foot="Dihitung dari buku kas" />
        <Stat icon={CalendarDays} tone="orange" label="Kegiatan mendatang" to="/kegiatan" value={<CountUp value={stats.upcoming.length} />}
          foot={stats.upcoming[0] ? `Terdekat: ${stats.upcoming[0].title}` : 'Belum ada agenda'} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        {/* Tugas */}
        <Card data-card>
          <CardHeader title="Perlu tindakan Anda" sub="Antrean sesuai peran Anda" icon={Clock3} />
          {tasks.length ? (
            <ul className="grid gap-2 px-3 pb-3 sm:grid-cols-2">
              {tasks.map((t) => (
                <li key={t.title} data-row>
                  <Link to={t.to} className="group card-lift flex items-center gap-3 rounded-2xl border border-line bg-panel/40 p-3.5 hover:border-primary/40 hover:bg-card">
                    <span className={cx('grid size-11 shrink-0 place-items-center rounded-xl', t.tone)}>
                      <t.icon className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-bold text-ink">{t.title}</span>
                      <span className="block truncate text-[12.5px] text-muted">{t.text}</span>
                    </span>
                    <span className="grid h-7 min-w-7 place-items-center rounded-full bg-ink px-2 text-[12.5px] font-bold text-card">{t.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-center gap-3 px-5 pb-5 text-sm text-muted">
              <CircleCheckBig className="size-5 text-success" /> Tidak ada antrean. Terima kasih sudah sigap!
            </div>
          )}
        </Card>

        {/* Iuran bulan ini */}
        <Card data-card className="flex flex-col">
          <CardHeader title={`Iuran ${MONTHS[month - 1]} ${year}`} sub="Terverifikasi oleh Bendahara" icon={HandCoins}
            action={<Link to="/iuran" className="text-[13px] font-semibold text-primary hover:underline">Detail</Link>} />
          <div className="flex flex-1 flex-col justify-end px-5 pb-5">
            <p className="text-[28px] font-extrabold tracking-tight text-ink">
              <CountUp value={stats.collected} format={(n) => rupiah(n)} />
            </p>
            <p className="text-[13px] text-muted">dari target {rupiah(stats.target)}</p>
            <Meter value={stats.target ? stats.collected / stats.target : 0} className="mt-4 h-2.5 bg-panel-2" color={c.success} label="Persentase iuran terkumpul" />
            <div className="mt-3 flex justify-between text-[12.5px] text-muted">
              <span><b className="text-ink">{stats.paidHH}</b> dari {stats.totalHH} rumah lunas</span>
              <span><b className="text-ink">{db.payments.filter((p) => p.status === 'pending').length}</b> menunggu verifikasi</span>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        {can(me.role, 'cash.view') ? (
          <Card data-card>
            <CardHeader title="Arus kas 6 bulan" sub={`Pemasukan ${rupiah(stats.income)} · Pengeluaran ${rupiah(stats.expense)}`} icon={Wallet}
              action={<Legend items={[{ label: 'Masuk', color: c.primary }, { label: 'Keluar', color: c.warn }]} />} />
            <div className="px-3 pb-4">
              <CashFlowChart data={flow} />
            </div>
          </Card>
        ) : (
          <UpcomingCard db={db} />
        )}

        <Card data-card>
          <CardHeader title="Pengumuman terbaru" icon={Megaphone} action={<Link to="/pengumuman" className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline">Lihat semua <ArrowRight className="size-3.5" /></Link>} />
          <ul className="px-2 pb-2">
            {announcements.map((a) => (
              <li key={a.id} data-row>
                <Link to="/pengumuman" className="flex gap-3 rounded-xl px-3 py-3 hover:bg-panel">
                  <AnnIcon category={a.category} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-bold text-ink">{a.title}</span>
                      {a.is_pinned ? <Badge tone="blue">Disematkan</Badge> : null}
                    </span>
                    <span className="mt-0.5 line-clamp-1 text-[12.5px] text-muted">{a.content}</span>
                    <span className="mt-0.5 block text-[11.5px] text-muted">{relative(a.published_at!)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr_1fr]">
        {can(me.role, 'cash.view') ? <UpcomingCard db={db} /> : null}
        <Card data-card>
          <CardHeader title="Ronda & keamanan" icon={ShieldCheck} action={can(me.role, 'security.view') ? <Link to="/keamanan" className="text-[13px] font-semibold text-primary hover:underline">Buka</Link> : undefined} />
          <div className="px-5 pb-5">
            <div className="rounded-2xl bg-navy p-4 text-white">
              <p className="text-[12px] font-semibold text-navy-ink">Malam ini · {tonight?.start_time ?? '22:00'}–{tonight?.end_time ?? '04:00'} WIB</p>
              <p className="mt-1 text-[18px] font-extrabold">{tonightTeam?.name ?? 'Belum dijadwalkan'}</p>
              <p className="mt-1 text-[12.5px] text-navy-ink">
                {tonightTeam ? tonightTeam.member_ids.map((id) => L.resident(id)?.full_name.split(' ')[0]).join(', ') : '—'}
              </p>
            </div>
            <ul className="mt-3 space-y-2">
              {db.incidents.slice(0, 2).map((i) => (
                <li key={i.id} className="flex items-start gap-2.5 text-[13px]">
                  <Siren className={cx('mt-0.5 size-4 shrink-0', i.status === 'open' ? 'text-danger' : 'text-muted')} />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-ink">{i.title}</span>
                    <span className="text-muted">{relative(i.incident_date)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
        <Card data-card className={can(me.role, 'cash.view') ? '' : 'xl:col-span-2'}>
          <CardHeader title="Aktivitas terbaru" sub="Jejak audit pengurus" icon={Clock3} />
          <ol className="relative mx-5 mb-5 border-l border-line pl-5">
            {feed.map((f) => (
              <li key={f.id} className="relative pb-4 last:pb-0" data-row>
                <span className="absolute top-1 -left-[25px] size-2.5 rounded-full bg-primary ring-4 ring-card" />
                <p className="text-[13.5px] font-semibold text-ink">{f.summary}</p>
                <p className="text-[12px] text-muted">{L.userName(f.user_id)} · {relative(f.created_at)}</p>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}

function UpcomingCard({ db }: { db: Database }) {
  const up = db.activities.filter((a) => a.status === 'planned').sort((a, b) => a.start_at.localeCompare(b.start_at)).slice(0, 3);
  return (
    <Card data-card>
      <CardHeader title="Agenda terdekat" icon={CalendarDays} action={<Link to="/kegiatan" className="text-[13px] font-semibold text-primary hover:underline">Kalender</Link>} />
      <ul className="space-y-2 px-3 pb-3">
        {up.map((a) => {
          const d = new Date(a.start_at);
          return (
            <li key={a.id} data-row className="flex items-center gap-3 rounded-xl p-2">
              <span className="grid w-12 shrink-0 place-items-center rounded-xl border border-line bg-panel py-1.5 leading-none">
                <span className="text-[10.5px] font-bold text-primary uppercase">{d.toLocaleDateString('id-ID', { month: 'short', timeZone: 'Asia/Jakarta' })}</span>
                <span className="mt-0.5 text-[19px] font-extrabold text-ink">{d.toLocaleDateString('id-ID', { day: 'numeric', timeZone: 'Asia/Jakarta' })}</span>
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-bold text-ink">{a.title}</span>
                <span className="block truncate text-[12.5px] text-muted">{time(a.start_at)} WIB · {a.location}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* ================================================================== WARGA */
function ResidentHome({ me }: { me: Actor }) {
  const db = useDatabase();
  const L = useLookups();
  const ref = useRef<HTMLDivElement>(null);
  usePageEnter(ref);
  const hh = L.household(me.householdId);
  const family = db.residents.filter((r) => r.household_id === me.householdId && r.is_active);
  const invoices = db.invoices.filter((i) => i.household_id === me.householdId && i.status !== 'cancelled');
  const outstanding = invoices.filter((i) => i.status === 'unpaid' || i.status === 'partial');
  const due = outstanding.reduce((s, i) => s + i.amount - i.paid_amount, 0);
  const pending = db.payments.filter((p) => p.household_id === me.householdId && p.status === 'pending');
  const myLetters = db.letters.filter((l) => family.some((f) => f.id === l.resident_id)).slice(0, 3);
  const myComplaints = db.complaints.filter((c) => c.created_by === me.userId).slice(0, 2);
  const next = db.activities.filter((a) => a.status === 'planned').sort((a, b) => a.start_at.localeCompare(b.start_at))[0];
  const news = db.announcements.filter((a) => a.status === 'published').sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? '')).slice(0, 4);
  const read = new Set(db.announcementReads.filter((r) => r.user_id === me.userId).map((r) => r.announcement_id));

  const services: { to: string; label: string; icon: LucideIcon }[] = [
    { to: '/keluarga', label: 'Data Keluarga', icon: BookUser },
    { to: '/surat', label: 'Surat & Layanan', icon: FileText },
    { to: '/iuran', label: 'Kas & Iuran', icon: Wallet },
    { to: '/pengumuman', label: 'Pengumuman', icon: Megaphone },
    { to: '/pengaduan', label: 'Pengaduan', icon: MessageSquareWarning },
    { to: '/kegiatan', label: 'Kegiatan', icon: CalendarDays },
  ];

  return (
    <div ref={ref} className="mx-auto max-w-[1100px]">
      <LiveMeetingCard />
      <Hero
        title={`${greeting()}, ${honorific(db, me)}`}
        sub={`Rumah ${hh?.house_number} · ${family.length} anggota keluarga`}
        chips={[pending.length ? `${pending.length} pembayaran sedang diverifikasi` : '', `RT ${db.neighborhood.rt_number} / RW ${db.neighborhood.rw_number} ${db.neighborhood.name}`]}
      />

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        {/* Tagihan */}
        <Card data-card className="overflow-hidden">
          <div className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-semibold text-muted">Tagihan keluarga</p>
              {outstanding.length ? <Badge tone="red" dot>{outstanding.length} belum lunas</Badge> : <Badge tone="green" dot>Semua lunas</Badge>}
            </div>
            <p className="mt-2 text-[34px] leading-none font-extrabold tracking-tight text-ink">
              <CountUp value={due} format={(n) => rupiah(n)} />
            </p>
            <p className="mt-1.5 text-[13px] text-muted">
              {outstanding[0] ? `${L.duesType(outstanding[0].dues_type_id)?.name} ${period(outstanding[0].period_month, outstanding[0].period_year)} · jatuh tempo ${new Date(outstanding[0].due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })}` : 'Terima kasih sudah membayar tepat waktu.'}
            </p>
          </div>
          <div className="flex items-center gap-2 border-t border-line bg-panel/50 px-5 py-3">
            <ul className="flex flex-1 gap-1.5">
              {invoices.slice(-6).map((i) => (
                <li key={i.id} title={`${period(i.period_month, i.period_year)} · ${INVOICE[i.status][0]}`} className={cx('h-2 flex-1 rounded-full', i.status === 'paid' ? 'bg-success' : i.status === 'partial' ? 'bg-warn' : 'bg-line-strong')} />
              ))}
            </ul>
            <Link to="/iuran" className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-[13.5px] font-bold text-white hover:bg-primary-hover">
              {outstanding.length ? 'Bayar sekarang' : 'Riwayat'} <ArrowRight className="size-4" />
            </Link>
          </div>
        </Card>

        {/* Layanan */}
        <Card data-card className="p-3">
          <ul className="grid grid-cols-3 gap-2">
            {services.map((s) => (
              <li key={s.to}>
                <Link to={s.to} className="card-lift flex h-full flex-col items-center gap-2 rounded-2xl border border-line bg-card px-2 py-4 text-center hover:border-primary/40">
                  <span className="grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary">
                    <s.icon className="size-6" strokeWidth={2} />
                  </span>
                  <span className="text-[12.5px] leading-tight font-semibold text-ink">{s.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {next ? (
        <Link to="/kegiatan" data-card className="group mt-5 flex items-center gap-4 overflow-hidden rounded-[20px] bg-primary p-4 text-white shadow-[0_18px_40px_-20px_var(--primary)] sm:p-5">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/15">
            <Megaphone className="size-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[16px] font-extrabold">{next.title}</span>
            <span className="block truncate text-[13px] text-white/80">{dateDay(next.start_at)} · {time(next.start_at)} WIB · {next.location}</span>
          </span>
          <ChevronRight className="size-6 transition-transform group-hover:translate-x-1" />
        </Link>
      ) : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Card data-card>
          <CardHeader title="Berita & informasi" icon={Megaphone} action={<Link to="/pengumuman" className="text-[13px] font-semibold text-primary hover:underline">Lihat semua</Link>} />
          <ul className="px-2 pb-2">
            {news.map((a) => (
              <li key={a.id} data-row>
                <Link to="/pengumuman" className="flex gap-3 rounded-xl px-3 py-3 hover:bg-panel">
                  <AnnIcon category={a.category} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-bold text-ink">{a.title}</span>
                      {!read.has(a.id) ? <Badge tone="blue">Baru</Badge> : null}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-muted">{relative(a.published_at!)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <div className="grid content-start gap-5">
          <Card data-card>
            <CardHeader title="Surat saya" icon={FileText} action={<Link to="/surat" className="text-[13px] font-semibold text-primary hover:underline">Ajukan</Link>} />
            <ul className="space-y-1 px-2 pb-3">
              {myLetters.length ? myLetters.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-semibold text-ink">{L.letterType(l.letter_type_id)?.name}</span>
                    <span className="block text-[12px] text-muted">{relative(l.created_at)}</span>
                  </span>
                  <StatusBadge map={REQUEST} value={l.status} />
                </li>
              )) : <li className="px-3 py-2 text-[13px] text-muted">Belum ada permohonan surat.</li>}
            </ul>
          </Card>
          <Card data-card>
            <CardHeader title="Pengaduan saya" icon={MessageSquareWarning} action={<Link to="/pengaduan" className="text-[13px] font-semibold text-primary hover:underline">Lapor</Link>} />
            <ul className="space-y-1 px-2 pb-3">
              {myComplaints.length ? myComplaints.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2">
                  <span className="min-w-0 truncate text-[13.5px] font-semibold text-ink">{c.title}</span>
                  <StatusBadge map={COMPLAINT} value={c.status} />
                </li>
              )) : <li className="px-3 py-2 text-[13px] text-muted">Belum ada pengaduan.</li>}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== shared */
function Hero({ title, sub, chips }: { title: string; sub: string; chips: string[] }) {
  return (
    <section data-card className="relative isolate overflow-hidden rounded-[24px] bg-[#1D4ED8] text-white shadow-[0_24px_50px_-28px_#1D4ED8]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(90%_140%_at_0%_0%,#3B82F6_0%,#2563EB_45%,#1E40AF_100%)]" />
      <NeighborhoodScene className="absolute right-0 bottom-0 -z-10 h-[78%] w-[78%] opacity-90 sm:w-[62%]" />
      <div className="absolute inset-y-0 left-0 -z-10 w-full bg-[linear-gradient(90deg,#1E40AF_0%,rgb(30_64_175/.85)_38%,transparent_75%)]" />
      <div className="px-5 py-6 sm:px-8 sm:py-8">
        <SplitTitle text={title} className="max-w-[18ch] text-[25px] leading-tight font-extrabold tracking-[-0.025em] sm:text-[32px]" />
        <p data-fade className="mt-1.5 text-[14px] text-white/80">{sub}</p>
        <div data-fade className="mt-4 flex flex-wrap gap-2">
          {chips.filter(Boolean).map((c) => (
            <span key={c} className="rounded-full bg-white/14 px-3 py-1.5 text-[12.5px] font-semibold ring-1 ring-white/20 backdrop-blur-sm">{c}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

const TONES = {
  blue: 'bg-primary-soft text-primary',
  green: 'bg-success-soft text-success-ink',
  violet: 'bg-violet-soft text-violet-ink',
  orange: 'bg-warn-soft text-warn-ink',
};
function Stat({ icon: Icon, tone, label, value, foot, to }: { icon: LucideIcon; tone: keyof typeof TONES; label: string; value: ReactNode; foot: string; to?: string }) {
  const body = (
    <>
      <div className="flex items-center gap-3">
        <span className={cx('grid size-11 shrink-0 place-items-center rounded-xl', TONES[tone])}>
          <Icon className="size-[22px]" strokeWidth={2.1} />
        </span>
        <p className="text-[12.5px] leading-tight font-semibold text-muted">{label}</p>
      </div>
      <p className="mt-3 truncate text-[22px] font-extrabold tracking-tight text-ink sm:text-[26px]">{value}</p>
      <p className="mt-0.5 truncate text-[12px] text-muted">{foot}</p>
    </>
  );
  const cls = 'block rounded-[18px] border border-line bg-card p-4 shadow-sm sm:p-5';
  return to ? (
    <Link to={to} data-card className={cx(cls, 'card-lift hover:border-primary/40')}>{body}</Link>
  ) : (
    <div data-card className={cls}>{body}</div>
  );
}

export function AnnIcon({ category }: { category: string }) {
  const m: Record<string, [LucideIcon, string]> = {
    kegiatan: [CalendarDays, 'bg-warn-soft text-warn-ink'],
    keuangan: [Wallet, 'bg-success-soft text-success-ink'],
    keamanan: [ShieldCheck, 'bg-primary-soft text-primary'],
    kesehatan: [CircleCheckBig, 'bg-success-soft text-success-ink'],
    pembangunan: [Siren, 'bg-violet-soft text-violet-ink'],
  };
  const [I, t] = m[category] ?? [Megaphone, 'bg-primary-soft text-primary'];
  return (
    <span className={cx('grid size-10 shrink-0 place-items-center rounded-xl', t)}>
      <I className="size-5" />
    </span>
  );
}
