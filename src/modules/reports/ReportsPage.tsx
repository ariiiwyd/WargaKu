import { useMemo, useRef, useState } from 'react';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarDays, FileSpreadsheet, FileText, MessageSquareWarning, Printer, ShieldCheck, Users, Wallet } from 'lucide-react';
import { CountUp, Meter, usePageEnter, useToast } from '@/motion';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button, Card, CardHeader, Select } from '@/components/ui/primitives';
import { CashFlowChart, Legend } from '@/components/charts/CashFlowChart';
import { useChartColors } from '@/components/charts/useChartColors';
import { REQUEST, COMPLAINT, RESIDENT } from '@/components/ui/status';
import { cashByMonth, useDatabase, useLookups, useMe } from '@/hooks/useData';
import { can } from '@/app/permissions';
import { age, dateLong, dateShort, rupiah } from '@/lib/format';
import { exportMultiXlsx } from '@/services/export.service';

export function ReportsPage() {
  const db = useDatabase();
  const me = useMe()!;
  const L = useLookups();
  const toast = useToast();
  const c = useChartColors();
  const ref = useRef<HTMLDivElement>(null);
  usePageEnter(ref);
  const [months, setMonths] = useState(6);
  const fin = can(me.role, 'reports.finance');
  const showFinance = can(me.role, 'cash.view');

  const r = useMemo(() => {
    const active = db.residents.filter((x) => x.is_active);
    const groups = [['0–5', 0, 5], ['6–17', 6, 17], ['18–30', 18, 30], ['31–45', 31, 45], ['46–60', 46, 60], ['60+', 61, 200]] as const;
    const ages = groups.map(([label, a, b]) => ({ label, value: active.filter((x) => x.birth_date && age(x.birth_date) >= a && age(x.birth_date) <= b).length }));
    const statuses = (['tetap', 'kontrak', 'pendatang'] as const).map((s) => ({ name: RESIDENT[s][0], value: active.filter((x) => x.resident_status === s).length }));
    const letters = db.letterTypes.map((t) => ({ name: t.code, full: t.name, value: db.letters.filter((l) => l.letter_type_id === t.id).length }));
    const byCat = db.cashCategories.map((cat) => ({ ...cat, total: db.cash.filter((t) => t.category_id === cat.id).reduce((s, t) => s + t.amount, 0) })).filter((x) => x.total > 0);
    const income = db.cash.filter((t) => t.transaction_type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = db.cash.filter((t) => t.transaction_type === 'expense').reduce((s, t) => s + t.amount, 0);
    const inv = db.invoices.filter((i) => i.status !== 'cancelled');
    const done = db.activities.filter((a) => a.status === 'done');
    const attendance = done.map((a) => {
      const p = db.participants.filter((x) => x.activity_id === a.id);
      return { a, total: p.length, present: p.filter((x) => x.attendance_status === 'present').length };
    });
    return {
      active, ages, statuses, letters, byCat, income, expense,
      male: active.filter((x) => x.gender === 'L').length, female: active.filter((x) => x.gender === 'P').length,
      households: db.households.filter((h) => h.status === 'active').length,
      billed: inv.reduce((s, i) => s + i.amount, 0), collected: inv.reduce((s, i) => s + i.paid_amount, 0),
      attendance,
    };
  }, [db]);

  const doExport = async () => {
    const sheets: { name: string; rows: Record<string, unknown>[] }[] = [
      { name: 'Statistik Warga', rows: [
        { Indikator: 'Warga aktif', Nilai: r.active.length }, { Indikator: 'Keluarga/rumah berpenghuni', Nilai: r.households },
        { Indikator: 'Laki-laki', Nilai: r.male }, { Indikator: 'Perempuan', Nilai: r.female },
        ...r.statuses.map((s) => ({ Indikator: `Status ${s.name}`, Nilai: s.value })), ...r.ages.map((a) => ({ Indikator: `Usia ${a.label}`, Nilai: a.value })),
      ] },
      { name: 'Rekap Surat', rows: db.letters.map((l) => ({ 'No. permohonan': l.request_number, 'No. surat': l.letter_number ?? '', Jenis: L.letterType(l.letter_type_id)?.name, Status: REQUEST[l.status][0], Diajukan: dateShort(l.created_at) })) },
      { name: 'Rekap Pengaduan', rows: db.complaints.map((x) => ({ Tiket: x.ticket_number, Judul: x.title, Kategori: L.complaintCategory(x.category_id)?.name, Prioritas: x.priority, Status: COMPLAINT[x.status][0], Dilaporkan: dateShort(x.created_at) })) },
      { name: 'Rekap Kegiatan', rows: db.activities.map((a) => ({ Kegiatan: a.title, Tanggal: dateShort(a.start_at), Lokasi: a.location, Peserta: db.participants.filter((p) => p.activity_id === a.id).length, Hadir: db.participants.filter((p) => p.activity_id === a.id && p.attendance_status === 'present').length })) },
    ];
    if (can(me.role, 'security.view')) sheets.push({ name: 'Rekap Keamanan', rows: db.patrolReports.map((p) => { const s = db.patrolSchedules.find((x) => x.id === p.schedule_id); return { Tanggal: s?.patrol_date, Regu: db.patrolTeams.find((t) => t.id === s?.team_id)?.name, Status: p.status, Catatan: p.report }; }) });
    if (fin) {
      sheets.push({ name: 'Buku Kas', rows: [...db.cash].sort((a, b) => a.transaction_date.localeCompare(b.transaction_date)).map((t) => ({ Tanggal: t.transaction_date, Nomor: t.transaction_number, Kategori: L.cashCategory(t.category_id)?.name ?? 'Koreksi', Keterangan: t.description, Masuk: t.transaction_type === 'income' ? t.amount : '', Keluar: t.transaction_type === 'expense' ? t.amount : '' })) });
      sheets.push({ name: 'Tagihan', rows: db.invoices.map((i) => ({ Nomor: i.invoice_number, Rumah: L.household(i.household_id)?.house_number, Periode: `${i.period_month ?? '-'}/${i.period_year}`, Nominal: i.amount, Terbayar: i.paid_amount, Status: i.status })) });
    }
    await exportMultiXlsx(`laporan-wargaku-rt${db.neighborhood.rt_number}`, sheets);
    toast(`Laporan diekspor (${sheets.length} lembar)`);
  };

  const tip = { contentStyle: { background: c.card, border: `1px solid ${c.line}`, borderRadius: 12, fontSize: 13, color: c.ink } };
  const pie = [c.success, c.primary, c.violet];

  return (
    <div ref={ref}>
      <PageHeader title="Laporan" description={`Rekap data RT ${db.neighborhood.rt_number} per ${dateLong(new Date())}. Total di laporan dihitung langsung dari data sumber.`}
        actions={<><Button variant="secondary" icon={Printer} onClick={() => window.print()} className="no-print">Cetak / PDF</Button><Button icon={FileSpreadsheet} onClick={doExport} className="no-print">Ekspor Excel</Button></>} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Users} label="Warga aktif" value={r.active.length} sub={`${r.households} keluarga`} />
        <Kpi icon={FileText} label="Surat diterbitkan" value={db.letters.filter((l) => l.letter_number).length} sub={`${db.letters.length} permohonan`} />
        <Kpi icon={MessageSquareWarning} label="Pengaduan selesai" value={db.complaints.filter((x) => ['resolved', 'closed'].includes(x.status)).length} sub={`dari ${db.complaints.length} laporan`} />
        <Kpi icon={CalendarDays} label="Kegiatan terlaksana" value={db.activities.filter((a) => a.status === 'done').length} sub={`${db.activities.filter((a) => a.status === 'planned').length} dijadwalkan`} />
      </div>

      {showFinance ? (
        <div className="mt-5 grid gap-5 xl:grid-cols-[1.4fr_1fr]">
          <Card data-card>
            <CardHeader title="Pemasukan & pengeluaran" icon={Wallet} action={
              <div className="flex items-center gap-3"><Legend items={[{ label: 'Masuk', color: c.primary }, { label: 'Keluar', color: c.warn }]} />
                <Select aria-label="Rentang" value={months} onChange={(e) => setMonths(Number(e.target.value))} className="h-9 w-auto text-[13px]"><option value={3}>3 bulan</option><option value={6}>6 bulan</option><option value={12}>12 bulan</option></Select></div>} />
            <div className="px-3 pb-4"><CashFlowChart data={cashByMonth(db, months)} height={260} /></div>
          </Card>
          <Card data-card>
            <CardHeader title="Saldo & kolektibilitas" icon={Wallet} />
            <dl className="space-y-3 px-5 pb-5 text-[14px]">
              <div className="flex justify-between"><dt className="text-muted">Total pemasukan</dt><dd className="font-bold text-success-ink">{rupiah(r.income)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Total pengeluaran</dt><dd className="font-bold">{rupiah(r.expense)}</dd></div>
              <div className="flex justify-between border-t border-line pt-3 text-[16px]"><dt className="font-semibold">Saldo kas</dt><dd className="font-extrabold">{rupiah(r.income - r.expense)}</dd></div>
              <div className="pt-3">
                <div className="mb-1.5 flex justify-between text-[13px]"><span className="text-muted">Iuran terkumpul</span><b>{r.billed ? Math.round((r.collected / r.billed) * 100) : 0}%</b></div>
                <Meter value={r.billed ? r.collected / r.billed : 0} className="h-2.5 bg-panel-2" color={c.success} label="Kolektibilitas iuran" />
                <p className="mt-1.5 text-[12.5px] text-muted">{rupiah(r.collected)} dari {rupiah(r.billed)} ditagihkan</p>
              </div>
              {fin ? (
                <div className="pt-3">
                  <p className="mb-2 text-[13px] font-semibold text-ink-2">Per kategori</p>
                  <ul className="space-y-1.5">
                    {r.byCat.map((x) => <li key={x.id} className="flex justify-between text-[13px]"><span className="text-ink-2">{x.name}</span><span className={x.transaction_type === 'income' ? 'font-semibold text-success-ink' : 'font-semibold'}>{x.transaction_type === 'income' ? '+' : '−'}{rupiah(x.total)}</span></li>)}
                  </ul>
                </div>
              ) : null}
            </dl>
          </Card>
        </div>
      ) : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card data-card>
          <CardHeader title="Komposisi usia" icon={Users} sub={`${r.male} laki-laki · ${r.female} perempuan`} />
          <div className="h-[220px] px-3 pb-4">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 300, height: 220 }}>
              <BarChart data={r.ages} margin={{ left: -24, right: 8 }}>
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: c.muted, fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} tick={{ fill: c.muted, fontSize: 11 }} />
                <Tooltip {...tip} cursor={{ fill: c.panel2 }} formatter={(v) => [`${v} orang`, 'Jumlah']} />
                <Bar dataKey="value" fill={c.primary} radius={[6, 6, 2, 2]} animationBegin={300} animationDuration={900} animationEasing="ease-out" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card data-card>
          <CardHeader title="Status domisili" icon={Users} />
          <div className="flex items-center gap-4 px-5 pb-5">
            <div className="size-[150px] shrink-0">
              <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 150, height: 150 }}>
                <PieChart>
                  <Pie data={r.statuses} dataKey="value" nameKey="name" innerRadius={44} outerRadius={70} paddingAngle={3} stroke="none" animationBegin={300} animationDuration={900}>
                    {r.statuses.map((_, i) => <Cell key={i} fill={pie[i]} />)}
                  </Pie>
                  <Tooltip {...tip} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-2 text-[13.5px]">
              {r.statuses.map((s, i) => <li key={s.name} className="flex items-center gap-2"><span className="size-2.5 rounded-sm" style={{ background: pie[i] }} /><span className="text-ink-2">{s.name}</span><b className="ml-auto pl-3">{s.value}</b></li>)}
            </ul>
          </div>
        </Card>
        <Card data-card>
          <CardHeader title="Rekap surat" icon={FileText} />
          <ul className="space-y-3 px-5 pb-5">
            {r.letters.map((l) => (
              <li key={l.name}>
                <div className="mb-1 flex justify-between text-[13px]"><span className="text-ink-2">{l.full}</span><b>{l.value}</b></div>
                <Meter value={db.letters.length ? l.value / db.letters.length : 0} className="h-1.5 bg-panel-2" label={l.full} />
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card data-card>
          <CardHeader title="Rekap pengaduan" icon={MessageSquareWarning} />
          <ul className="grid grid-cols-2 gap-2 px-5 pb-5">
            {(Object.keys(COMPLAINT) as (keyof typeof COMPLAINT)[]).map((s) => <li key={s} className="rounded-xl bg-panel/60 p-3"><p className="text-[20px] font-extrabold">{db.complaints.filter((x) => x.status === s).length}</p><p className="text-[12px] text-muted">{COMPLAINT[s][0]}</p></li>)}
          </ul>
        </Card>
        <Card data-card>
          <CardHeader title="Kehadiran kegiatan" icon={CalendarDays} />
          <ul className="space-y-3 px-5 pb-5">
            {r.attendance.map(({ a, total, present }) => (
              <li key={a.id}>
                <div className="mb-1 flex justify-between text-[13px]"><span className="truncate text-ink-2">{a.title}</span><b>{present}/{total}</b></div>
                <Meter value={total ? present / total : 0} className="h-1.5 bg-panel-2" color={c.success} label={a.title} />
              </li>
            ))}
          </ul>
        </Card>
        {can(me.role, 'security.view') ? (
          <Card data-card>
            <CardHeader title="Rekap keamanan" icon={ShieldCheck} sub="14 malam terakhir" />
            <ul className="grid grid-cols-3 gap-2 px-5 pb-5 text-center">
              {(['aman', 'ada_kejadian', 'tidak_terlaksana'] as const).map((s) => <li key={s} className="rounded-xl bg-panel/60 p-3"><p className="text-[20px] font-extrabold">{db.patrolReports.filter((p) => p.status === s).length}</p><p className="text-[11.5px] text-muted">{{ aman: 'Aman', ada_kejadian: 'Ada kejadian', tidak_terlaksana: 'Tidak jalan' }[s]}</p></li>)}
            </ul>
            <p className="px-5 pb-5 text-[13px] text-muted">{db.incidents.length} catatan kejadian · {db.guests.length} tamu tercatat</p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub }: { icon: typeof Users; label: string; value: number; sub: string }) {
  return (
    <div data-card className="rounded-[18px] border border-line bg-card p-4 shadow-sm sm:p-5">
      <Icon className="size-5 text-primary" />
      <p className="mt-2 text-[26px] font-extrabold tracking-tight"><CountUp value={value} /></p>
      <p className="text-[13px] font-semibold text-ink-2">{label}</p>
      <p className="text-[12px] text-muted">{sub}</p>
    </div>
  );
}
