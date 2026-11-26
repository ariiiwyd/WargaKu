import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import {
  ArrowDownLeft, ArrowUpRight, Banknote, Check, CircleX, Copy, FileImage, HandCoins, Landmark, Plus, ReceiptText, RotateCcw, Upload, Wallet,
} from 'lucide-react';
import { CountUp, Meter, Modal, usePageEnter, useToast } from '@/motion';
import { PageHeader, Magnetic } from '@/components/ui/PageHeader';
import { Badge, Button, Card, CardHeader, Choice, EmptyState, Field, Info, Input, Select, Skeleton, Textarea, cx } from '@/components/ui/primitives';
import { ConfirmDialog, DialogShell } from '@/components/ui/DialogShell';
import { Tabs } from '@/components/ui/Tabs';
import { Pagination, SearchInput, Td, Th, Toolbar, useList } from '@/components/ui/list';
import { StatusBadge, INVOICE, PAYMENT } from '@/components/ui/status';
import { cashSummary, useDatabase, useLookups, useMe } from '@/hooks/useData';
import { useChartColors } from '@/components/charts/useChartColors';
import { actions } from '@/stores/db.store';
import { can } from '@/app/permissions';
import { dateShort, dateTime, jakartaParts, MONTHS, period, relative, rupiah, todayISO } from '@/lib/format';
import { prepareProof, type PreparedFile } from '@/lib/image';
import { signedUrl } from '@/lib/supabase';
import type { Invoice, PaymentMethod } from '@/types/models';

type TabKey = 'tagihan' | 'verifikasi' | 'kas' | 'jenis';
/** Kategori yang terisi otomatis oleh sistem, tidak dipilih manual. */
const AUTO_CATS = ['Iuran Warga', 'Saldo Awal'];

export function DuesPage() {
  const me = useMe()!;
  return can(me.role, 'dues.viewAll') || can(me.role, 'payments.verify') ? <AdminDues /> : <ResidentDues />;
}

/* =================================================================== ADMIN */
function AdminDues() {
  const db = useDatabase();
  const me = useMe()!;
  const ref = useRef<HTMLDivElement>(null);
  usePageEnter(ref);
  const [params, setParams] = useSearchParams();
  const verify = can(me.role, 'payments.verify');
  const tab = (params.get('tab') as TabKey) || (verify && db.payments.some((p) => p.status === 'pending') ? 'verifikasi' : 'tagihan');
  const [gen, setGen] = useState(false);
  const [cashForm, setCashForm] = useState<null | 'income' | 'expense'>(null);
  const sum = cashSummary(db);
  const pending = db.payments.filter((p) => p.status === 'pending');

  const tabs = [
    { value: 'tagihan' as const, label: 'Tagihan' },
    ...(verify ? [{ value: 'verifikasi' as const, label: 'Verifikasi', count: pending.length }] : []),
    ...(can(me.role, 'cash.view') ? [{ value: 'kas' as const, label: 'Buku Kas' }] : []),
    ...(can(me.role, 'dues.manage') ? [{ value: 'jenis' as const, label: 'Jenis Iuran' }] : []),
  ];

  return (
    <div ref={ref}>
      <PageHeader
        title="Kas & Iuran"
        description="Bukti transfer hanya membuat pembayaran berstatus menunggu. Saldo kas berubah setelah diverifikasi Bendahara — satu pembayaran, satu catatan kas."
        actions={
          can(me.role, 'cash.manage') || can(me.role, 'dues.manage') ? (
            <>
              {can(me.role, 'cash.manage') ? <Button variant="secondary" icon={ArrowUpRight} onClick={() => setCashForm('expense')}>Catat pengeluaran</Button> : null}
              {can(me.role, 'dues.manage') ? <Magnetic><Button icon={Plus} onClick={() => setGen(true)}>Buat tagihan</Button></Magnetic> : null}
            </>
          ) : null
        }
      />

      {can(me.role, 'cash.view') ? (
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <SumCard icon={Wallet} label="Saldo kas" value={sum.balance} tone="blue" big />
          <SumCard icon={ArrowDownLeft} label="Total pemasukan" value={sum.income} tone="green" />
          <SumCard icon={ArrowUpRight} label="Total pengeluaran" value={sum.expense} tone="orange" />
        </div>
      ) : null}

      <Toolbar>
        <Tabs label="Bagian kas & iuran" value={tab} onChange={(v) => setParams({ tab: v }, { replace: true })} tabs={tabs} />
      </Toolbar>

      {tab === 'tagihan' ? <InvoicesTab /> : null}
      {tab === 'verifikasi' && verify ? <VerifyTab /> : null}
      {tab === 'kas' && can(me.role, 'cash.view') ? <CashTab onAdd={setCashForm} /> : null}
      {tab === 'jenis' && can(me.role, 'dues.manage') ? <TypesTab /> : null}

      <GenerateModal open={gen} onClose={() => setGen(false)} />
      <CashModal type={cashForm} onClose={() => setCashForm(null)} />
    </div>
  );
}

function SumCard({ icon: Icon, label, value, tone, big }: { icon: typeof Wallet; label: string; value: number; tone: 'blue' | 'green' | 'orange'; big?: boolean }) {
  const t = { blue: 'bg-primary text-white', green: 'bg-success-soft text-success-ink', orange: 'bg-warn-soft text-warn-ink' }[tone];
  return (
    <div data-card className={cx('rounded-[18px] border p-4 shadow-sm sm:p-5', big ? 'border-transparent bg-navy text-white' : 'border-line bg-card')}>
      <div className="flex items-center gap-2.5">
        <span className={cx('grid size-9 place-items-center rounded-xl', t)}><Icon className="size-[18px]" /></span>
        <p className={cx('text-[13px] font-semibold', big ? 'text-navy-ink' : 'text-muted')}>{label}</p>
      </div>
      <p className={cx('mt-3 text-[24px] font-extrabold tracking-tight sm:text-[26px]', big ? 'text-white' : 'text-ink')}>
        <CountUp value={value} format={(n) => rupiah(n)} />
      </p>
      {big ? <p className="mt-0.5 text-[12px] text-navy-ink">Dihitung dari seluruh transaksi buku kas</p> : null}
    </div>
  );
}

/* ---------------- Tagihan */
function InvoicesTab() {
  const db = useDatabase();
  const me = useMe()!;
  const L = useLookups();
  const toast = useToast();
  const { year, month } = jakartaParts();
  const periods = useMemo(() => [...new Set(db.invoices.map((i) => `${i.period_year}-${String(i.period_month ?? 0).padStart(2, '0')}`))].sort().reverse(), [db]);
  const [per, setPer] = useState(`${year}-${String(month).padStart(2, '0')}`);
  const [status, setStatus] = useState<'all' | Invoice['status']>('all');
  const [pay, setPay] = useState<Invoice | null>(null);
  const [cancel, setCancel] = useState<Invoice | null>(null);
  const rows = db.invoices.filter((i) => `${i.period_year}-${String(i.period_month ?? 0).padStart(2, '0')}` === per && (status === 'all' || i.status === status));
  const list = useList(rows, { search: (i) => `${i.invoice_number} ${L.household(i.household_id)?.house_number} ${L.headOf(L.household(i.household_id))?.full_name}`, pageSize: 12 });
  const all = db.invoices.filter((i) => `${i.period_year}-${String(i.period_month ?? 0).padStart(2, '0')}` === per && i.status !== 'cancelled');
  const paid = all.reduce((s, i) => s + i.paid_amount, 0), target = all.reduce((s, i) => s + i.amount, 0);
  const c = useChartColors();

  return (
    <>
      <Card data-card className="mb-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold text-muted">Terkumpul periode ini</p>
            <p className="text-[22px] font-extrabold text-ink">{rupiah(paid)} <span className="text-[14px] font-semibold text-muted">/ {rupiah(target)}</span></p>
          </div>
          <div className="flex gap-2 text-[12.5px]">
            {(['paid', 'partial', 'unpaid'] as const).map((s) => <Badge key={s} tone={INVOICE[s][1]}>{all.filter((i) => i.status === s).length} {INVOICE[s][0].toLowerCase()}</Badge>)}
          </div>
        </div>
        <Meter value={target ? paid / target : 0} className="mt-3 h-2 bg-panel-2" color={c.success} label="Iuran terkumpul" />
      </Card>
      <Toolbar>
        <Select aria-label="Periode" value={per} onChange={(e) => (setPer(e.target.value), list.resetPage())} className="sm:w-52">
          {periods.map((p) => {
            const [y, m] = p.split('-').map(Number);
            return <option key={p} value={p}>{m ? `${MONTHS[m - 1]} ${y}` : `Tahun ${y}`}</option>;
          })}
        </Select>
        <Select aria-label="Status tagihan" value={status} onChange={(e) => (setStatus(e.target.value as 'all'), list.resetPage())} className="sm:w-44">
          <option value="all">Semua status</option>
          {(Object.keys(INVOICE) as Invoice['status'][]).map((s) => <option key={s} value={s}>{INVOICE[s][0]}</option>)}
        </Select>
        <SearchInput value={list.q} onChange={list.setQ} placeholder="Cari rumah atau nomor tagihan…" className="flex-1 sm:min-w-[220px]" />
      </Toolbar>
      <Card data-card className="overflow-hidden">
        {list.rows.length ? (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full">
                <thead className="border-b border-line bg-panel/60"><tr><Th>No. tagihan</Th><Th>Rumah</Th><Th>Jenis</Th><Th className="text-right">Nominal</Th><Th className="text-right">Terbayar</Th><Th>Status</Th><Th className="text-right">Aksi</Th></tr></thead>
                <tbody className="divide-y divide-line">
                  {list.rows.map((i) => {
                    const hh = L.household(i.household_id);
                    const pend = db.payments.some((p) => p.invoice_id === i.id && p.status === 'pending');
                    return (
                      <tr key={i.id} data-row className="hover:bg-panel/50">
                        <Td className="font-mono text-[13px] text-ink-2">{i.invoice_number}</Td>
                        <Td><span className="font-bold">{hh?.house_number}</span> <span className="text-[13px] text-muted">{L.headOf(hh)?.full_name}</span></Td>
                        <Td className="text-ink-2">{L.duesType(i.dues_type_id)?.name}</Td>
                        <Td className="text-right font-semibold">{rupiah(i.amount)}</Td>
                        <Td className="text-right text-ink-2">{rupiah(i.paid_amount)}</Td>
                        <Td>{pend ? <Badge tone="orange" dot>Menunggu verifikasi</Badge> : <StatusBadge map={INVOICE} value={i.status} />}</Td>
                        <Td className="text-right">
                          {['unpaid', 'partial'].includes(i.status) && can(me.role, 'payments.submitForOthers') ? <Button size="sm" variant="soft" icon={Banknote} onClick={() => setPay(i)}>Catat tunai</Button> : null}
                          {i.status === 'unpaid' && can(me.role, 'dues.manage') && !pend ? <Button size="sm" variant="ghost" onClick={() => setCancel(i)}>Batalkan</Button> : null}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-line md:hidden">
              {list.rows.map((i) => {
                const hh = L.household(i.household_id);
                return (
                  <li key={i.id} data-row className="flex items-center gap-3 px-4 py-3.5">
                    <span className="grid size-11 place-items-center rounded-xl bg-primary-soft text-[13px] font-extrabold text-primary-soft-ink">{hh?.house_number}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{L.headOf(hh)?.full_name ?? '—'}</span>
                      <span className="block text-[12.5px] text-muted">{rupiah(i.paid_amount)} / {rupiah(i.amount)}</span>
                    </span>
                    <div className="flex flex-col items-end gap-1.5">
                      <StatusBadge map={INVOICE} value={i.status} />
                      {['unpaid', 'partial'].includes(i.status) && can(me.role, 'payments.submitForOthers') ? <button onClick={() => setPay(i)} className="text-[12.5px] font-semibold text-primary">Catat tunai</button> : null}
                    </div>
                  </li>
                );
              })}
            </ul>
            <Pagination {...list} unit="tagihan" />
          </>
        ) : (
          <EmptyState icon={ReceiptText} title="Tidak ada tagihan" text="Belum ada tagihan untuk periode dan status ini." />
        )}
      </Card>
      <PayModal invoice={pay} onClose={() => setPay(null)} cashOnly />
      <ConfirmDialog open={!!cancel} onClose={() => setCancel(null)} tone="red" icon={CircleX} title="Batalkan tagihan?" confirmLabel="Batalkan tagihan"
        message={<>Tagihan <b>{cancel?.invoice_number}</b> akan ditandai dibatalkan. Riwayatnya tetap tersimpan.</>}
        onConfirm={async () => { const r = await actions.cancelInvoice(cancel!.id); toast(r.ok ? 'Tagihan dibatalkan' : r.error, r.ok ? 'success' : 'error'); if (r.ok) setCancel(null); return r.ok; }} />
    </>
  );
}

/* ---------------- Verifikasi */
function VerifyTab() {
  const db = useDatabase();
  const L = useLookups();
  const toast = useToast();
  const [sel, setSel] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | 'ok' | 'no'>(null);
  const [view, setView] = useState<'pending' | 'done'>('pending');
  const pending = db.payments.filter((p) => p.status === 'pending').sort((a, b) => a.created_at.localeCompare(b.created_at));
  const done = db.payments.filter((p) => p.status !== 'pending').sort((a, b) => (b.verified_at ?? '').localeCompare(a.verified_at ?? '')).slice(0, 30);
  const rows = view === 'pending' ? pending : done;
  const p = db.payments.find((x) => x.id === sel) ?? rows[0];
  useEffect(() => { if (!sel && rows[0]) setSel(rows[0].id); }, [sel, rows]);
  const inv = p ? db.invoices.find((i) => i.id === p.invoice_id) : undefined;
  const hh = L.household(p?.household_id);
  const otherPending = inv ? db.payments.filter((x) => x.invoice_id === inv.id && x.status === 'pending' && x.id !== p?.id).reduce((s, x) => s + x.amount, 0) : 0;

  const decide = async (ok: boolean, reason = '') => {
    if (!p) return false;
    const r = ok ? await actions.verifyPayment(p.id) : await actions.rejectPayment(p.id, reason);
    if (!r.ok) { toast(r.error, 'error'); return false; }
    toast(ok ? `Pembayaran ${hh?.house_number} diverifikasi · kas bertambah ${rupiah(p.amount)}` : 'Pembayaran ditolak, warga diberi tahu');
    setConfirm(null);
    setSel(null);
    return true;
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <Card data-card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex gap-1 rounded-xl bg-panel p-1 text-[13px] font-semibold">
            {(['pending', 'done'] as const).map((v) => (
              <button key={v} onClick={() => (setView(v), setSel(null))} className={cx('rounded-lg px-3 py-1.5', view === v ? 'bg-card text-ink shadow-sm' : 'text-muted')}>{v === 'pending' ? `Menunggu (${pending.length})` : 'Riwayat'}</button>
            ))}
          </div>
        </div>
        {rows.length ? (
          <ul className="max-h-[620px] divide-y divide-line overflow-y-auto">
            {rows.map((x) => {
              const h = L.household(x.household_id);
              return (
                <li key={x.id} data-row>
                  <button onClick={() => setSel(x.id)} aria-current={p?.id === x.id} className={cx('flex w-full items-center gap-3 px-4 py-3.5 text-left', p?.id === x.id ? 'bg-primary-soft/60' : 'hover:bg-panel/60')}>
                    <span className="grid size-10 place-items-center rounded-xl bg-card text-[13px] font-extrabold text-ink ring-1 ring-line">{h?.house_number}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-bold">{L.headOf(h)?.full_name ?? L.userName(x.payer_user_id)}</span>
                      <span className="block text-[12.5px] text-muted">{x.payment_method === 'transfer' ? 'Transfer' : 'Tunai'} · {relative(x.created_at)}</span>
                    </span>
                    <span className="text-right">
                      <span className="block text-[14px] font-extrabold">{rupiah(x.amount)}</span>
                      {view === 'done' ? <StatusBadge map={PAYMENT} value={x.status} /> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon={Check} title="Semua pembayaran sudah diverifikasi" text="Bukti transfer baru dari warga akan muncul di sini." />
        )}
      </Card>

      {p && inv ? (
        <Card data-card className="flex flex-col">
          <CardHeader title={`Pembayaran ${hh?.house_number}`} sub={`${inv.invoice_number} · ${L.duesType(inv.dues_type_id)?.name} ${period(inv.period_month, inv.period_year)}`} icon={HandCoins} action={<StatusBadge map={PAYMENT} value={p.status} />} />
          <div className="grid flex-1 gap-5 px-5 pb-5 sm:grid-cols-[1fr_1.1fr]">
            <div className="overflow-hidden rounded-2xl border border-line bg-panel">
              {p.proof_path ? (
                <ProofView path={p.proof_path} />
              ) : (
                <div className="grid h-full min-h-[200px] place-items-center p-6 text-center text-[13px] text-muted"><span><Banknote className="mx-auto mb-2 size-8 text-success" />Pembayaran tunai — tanpa bukti transfer.<br />{p.note}</span></div>
              )}
            </div>
            <dl className="grid content-start gap-4">
              <Info label="Nominal dibayar"><span className="text-[22px] font-extrabold">{rupiah(p.amount)}</span></Info>
              <div className="grid grid-cols-2 gap-4">
                <Info label="Nominal tagihan">{rupiah(inv.amount)}</Info>
                <Info label="Sudah terverifikasi">{rupiah(inv.paid_amount)}</Info>
                <Info label="Tanggal bayar">{dateShort(p.payment_date)}</Info>
                <Info label="Metode">{p.payment_method === 'transfer' ? 'Transfer bank' : 'Tunai'}</Info>
              </div>
              <Info label="Keluarga">{L.headOf(hh)?.full_name ?? "—"}</Info><Info label="Diinput oleh">{L.userName(p.payer_user_id)}</Info>
              {p.note ? <Info label="Catatan">{p.note}</Info> : null}
              {p.amount > inv.amount - inv.paid_amount ? <p className="rounded-xl bg-danger-soft px-3 py-2 text-[13px] font-medium text-danger-ink">Nominal melebihi sisa tagihan ({rupiah(inv.amount - inv.paid_amount)}). Verifikasi akan ditolak sistem.</p> : null}
              {otherPending ? <p className="rounded-xl bg-warn-soft px-3 py-2 text-[13px] text-warn-ink">Ada pembayaran lain menunggu untuk tagihan ini ({rupiah(otherPending)}).</p> : null}
              {p.status === 'rejected' ? <p className="rounded-xl bg-danger-soft px-3 py-2 text-[13px] text-danger-ink">Ditolak: {p.rejection_reason}</p> : null}
              {p.status !== 'pending' ? <p className="text-[12.5px] text-muted">Diproses {L.userName(p.verified_by)} · {dateTime(p.verified_at!)}</p> : null}
            </dl>
          </div>
          {p.status === 'pending' ? (
            <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
              <Button variant="secondary" icon={CircleX} onClick={() => setConfirm('no')}>Tolak</Button>
              <Button variant="success" icon={Check} onClick={() => setConfirm('ok')}>Verifikasi pembayaran</Button>
            </div>
          ) : null}
        </Card>
      ) : null}

      <ConfirmDialog open={confirm === 'ok'} onClose={() => setConfirm(null)} tone="green" icon={Check} title="Verifikasi pembayaran ini?" confirmLabel="Ya, verifikasi"
        message={<>Sistem akan memperbarui tagihan <b>{inv?.invoice_number}</b>, mencatat <b>satu</b> pemasukan kas sebesar <b>{p ? rupiah(p.amount) : ''}</b>, dan mengirim konfirmasi ke warga. Tindakan ini tidak bisa dibatalkan.</>}
        onConfirm={() => decide(true)} />
      <ConfirmDialog open={confirm === 'no'} onClose={() => setConfirm(null)} tone="red" icon={CircleX} title="Tolak pembayaran?" confirmLabel="Tolak pembayaran" reason="required" reasonLabel="Alasan penolakan"
        reasonPlaceholder="Contoh: nominal di bukti transfer tidak sesuai" message="Saldo kas tidak berubah. Warga akan menerima alasan Anda dan dapat mengirim ulang."
        onConfirm={(r) => decide(false, r)} />
    </div>
  );
}

/** Bukti transfer dari bucket privat lewat signed URL berumur pendek (60 dtk). */
function ProofView({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const isPdf = path.toLowerCase().endsWith('.pdf');
  useEffect(() => {
    let alive = true;
    setUrl(null);
    setErr('');
    signedUrl('payment-proofs', path, 60).then((u) => alive && setUrl(u)).catch(() => alive && setErr('Bukti tidak dapat dimuat.'));
    return () => {
      alive = false;
    };
  }, [path]);
  if (err) return <div className="grid h-full min-h-[200px] place-items-center p-6 text-center text-[13px] text-danger-ink">{err}</div>;
  if (!url) return <Skeleton className="h-full min-h-[240px] rounded-none" />;
  if (isPdf)
    return (
      <a href={url} target="_blank" rel="noreferrer" className="grid h-full min-h-[200px] place-items-center p-6 text-center text-[13.5px] font-semibold text-primary">
        <span><FileImage className="mx-auto mb-2 size-8" />Buka bukti transfer (PDF)</span>
      </a>
    );
  return (
    <a href={url} target="_blank" rel="noreferrer" title="Buka ukuran penuh">
      <img src={url} alt="Bukti transfer" className="max-h-[360px] w-full object-contain" />
    </a>
  );
}

/* ---------------- Buku kas */
function CashTab({ onAdd }: { onAdd: (t: 'income' | 'expense') => void }) {
  const db = useDatabase();
  const me = useMe()!;
  const L = useLookups();
  const toast = useToast();
  const [type, setType] = useState<'all' | 'income' | 'expense'>('all');
  const [rev, setRev] = useState<string | null>(null);
  const reversed = new Set(db.cash.filter((c) => c.reverses_id).map((c) => c.reverses_id));
  const rows = [...db.cash].filter((c) => type === 'all' || c.transaction_type === type).sort((a, b) => b.transaction_date.localeCompare(a.transaction_date) || b.created_at.localeCompare(a.created_at));
  const list = useList(rows, { search: (c) => `${c.transaction_number} ${c.description} ${L.cashCategory(c.category_id)?.name}`, pageSize: 14 });
  const t = db.cash.find((c) => c.id === rev);
  return (
    <>
      <Toolbar>
        <Select aria-label="Jenis transaksi" value={type} onChange={(e) => (setType(e.target.value as 'all'), list.resetPage())} className="sm:w-48">
          <option value="all">Semua transaksi</option><option value="income">Pemasukan</option><option value="expense">Pengeluaran</option>
        </Select>
        <SearchInput value={list.q} onChange={list.setQ} placeholder="Cari keterangan atau nomor…" className="flex-1 sm:min-w-[220px]" />
        {can(me.role, 'cash.manage') ? <Button variant="secondary" icon={ArrowDownLeft} onClick={() => onAdd('income')}>Catat pemasukan lain</Button> : null}
      </Toolbar>
      <Card data-card className="overflow-hidden">
        <ul className="divide-y divide-line">
          {list.rows.map((c) => {
            const inc = c.transaction_type === 'income';
            return (
              <li key={c.id} data-row className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                <span className={cx('grid size-10 shrink-0 place-items-center rounded-xl', inc ? 'bg-success-soft text-success-ink' : 'bg-warn-soft text-warn-ink')}>
                  {inc ? <ArrowDownLeft className="size-5" /> : <ArrowUpRight className="size-5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-ink">{c.description}</span>
                  <span className="block truncate text-[12.5px] text-muted">
                    {dateShort(c.transaction_date)} · {L.cashCategory(c.category_id)?.name ?? 'Koreksi'} · <span className="font-mono">{c.transaction_number}</span>
                    {c.payment_id ? ' · otomatis dari verifikasi' : ''}
                  </span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <span className={cx('text-[14.5px] font-extrabold', inc ? 'text-success-ink' : 'text-ink')}>{inc ? '+' : '−'}{rupiah(c.amount)}</span>
                  {reversed.has(c.id) ? <Badge tone="gray">Dikoreksi</Badge> : c.reverses_id ? <Badge tone="violet">Pembalik</Badge> : !c.payment_id && can(me.role, 'cash.manage') ? (
                    <button onClick={() => setRev(c.id)} className="inline-flex items-center gap-1 text-[12px] font-semibold text-muted hover:text-primary"><RotateCcw className="size-3.5" />Koreksi</button>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
        <Pagination {...list} unit="transaksi" />
      </Card>
      <ConfirmDialog open={!!rev} onClose={() => setRev(null)} icon={RotateCcw} tone="red" title="Buat transaksi pembalik?" confirmLabel="Buat koreksi" reason="required" reasonLabel="Alasan koreksi"
        message={<>Transaksi lama <b>{t?.transaction_number}</b> tidak dihapus. Sistem membuat transaksi {t?.transaction_type === 'income' ? 'pengeluaran' : 'pemasukan'} sebesar <b>{t ? rupiah(t.amount) : ''}</b> sebagai koreksi.</>}
        onConfirm={async (r) => { const res = await actions.reverseCash(rev!, r); toast(res.ok ? 'Transaksi pembalik dicatat' : res.error, res.ok ? 'success' : 'error'); if (res.ok) setRev(null); return res.ok; }} />
    </>
  );
}

/* ---------------- Jenis iuran */
function TypesTab() {
  const db = useDatabase();
  const toast = useToast();
  const [edit, setEdit] = useState<{ id?: string; name: string; amount: string; billing_period: string; description: string; is_active: boolean } | null>(null);
  const id = useId();
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!edit) return;
    const r = await actions.saveDuesType({ ...edit, amount: Number(edit.amount.replace(/\D/g, '')), billing_period: edit.billing_period as never });
    if (!r.ok) return toast(r.error, 'error');
    toast('Jenis iuran disimpan');
    setEdit(null);
  };
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {db.duesTypes.map((t) => (
          <Card key={t.id} data-card className="p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[15px] font-bold">{t.name}</p>
                <p className="mt-0.5 text-[13px] text-muted">{t.description}</p>
              </div>
              <Badge tone={t.is_active ? 'green' : 'gray'}>{t.is_active ? 'Aktif' : 'Nonaktif'}</Badge>
            </div>
            <p className="mt-4 text-[22px] font-extrabold">{rupiah(t.amount)} <span className="text-[13px] font-semibold text-muted">/ {t.billing_period}</span></p>
            <Button size="sm" variant="secondary" className="mt-3" onClick={() => setEdit({ ...t, amount: String(t.amount) })}>Ubah</Button>
          </Card>
        ))}
        <button data-card onClick={() => setEdit({ name: '', amount: '', billing_period: 'bulanan', description: '', is_active: true })} className="grid min-h-[180px] place-items-center rounded-[18px] border-2 border-dashed border-line text-[14px] font-semibold text-muted hover:border-primary hover:text-primary">
          <span className="flex flex-col items-center gap-2"><Plus className="size-6" />Tambah jenis iuran</span>
        </button>
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} labelledBy={id}>
        {edit ? (
          <form onSubmit={save} noValidate>
            <DialogShell id={id} title={edit.id ? 'Ubah jenis iuran' : 'Jenis iuran baru'} icon={ReceiptText} onClose={() => setEdit(null)}
              footer={<><Button type="button" variant="secondary" onClick={() => setEdit(null)}>Batal</Button><Button type="submit">Simpan</Button></>}>
              <div className="space-y-4">
                <Field label="Nama iuran" required><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Nominal (Rp)" required><Input inputMode="numeric" value={edit.amount} onChange={(e) => setEdit({ ...edit, amount: e.target.value.replace(/\D/g, '') })} /></Field>
                  <Field label="Periode">
                    <Select value={edit.billing_period} onChange={(e) => setEdit({ ...edit, billing_period: e.target.value })}>
                      <option value="bulanan">Bulanan</option><option value="tahunan">Tahunan</option><option value="sekali">Sekali bayar</option><option value="insidental">Insidental</option>
                    </Select>
                  </Field>
                </div>
                <Field label="Keterangan"><Input value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
                <label className="flex items-center gap-2.5 text-[14px] font-semibold" data-field>
                  <input type="checkbox" checked={edit.is_active} onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })} className="size-4 accent-[var(--primary)]" /> Aktif dan dapat ditagihkan
                </label>
              </div>
            </DialogShell>
          </form>
        ) : null}
      </Modal>
    </>
  );
}

/* ---------------- Modal: buat tagihan */
function GenerateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const db = useDatabase();
  const toast = useToast();
  const id = useId();
  const { year, month } = jakartaParts();
  const [type, setType] = useState('');
  const [m, setM] = useState(month);
  const [y, setY] = useState(year);
  const [due, setDue] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => {
    if (open) (setType(db.duesTypes.find((t) => t.is_active)?.id ?? ''), setM(month), setY(year), setDue(`${year}-${String(month).padStart(2, '0')}-10`), setErr(''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const t = db.duesTypes.find((x) => x.id === type);
  const targets = db.households.filter((h) => h.status === 'active');
  const existing = targets.filter((h) => db.invoices.some((i) => i.household_id === h.id && i.dues_type_id === type && i.period_year === y && (i.period_month ?? 0) === (t?.billing_period === 'bulanan' ? m : 0) && i.status !== 'cancelled')).length;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const r = await actions.generateInvoices({ dues_type_id: type, month: t?.billing_period === 'bulanan' ? m : null, year: y, due_date: due, household_ids: targets.map((h) => h.id) });
    if (!r.ok) return setErr(r.error);
    toast(`${r.data.created} tagihan dibuat${r.data.skipped ? `, ${r.data.skipped} dilewati (sudah ada)` : ''}`);
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} labelledBy={id}>
      <form onSubmit={submit} noValidate>
        <DialogShell id={id} title="Buat tagihan" sub="Tagihan dibuat untuk setiap rumah berpenghuni. Periode yang sudah ditagih otomatis dilewati." icon={ReceiptText} onClose={onClose}
          footer={<><Button type="button" variant="secondary" onClick={onClose}>Batal</Button><Button type="submit">Buat {Math.max(targets.length - existing, 0)} tagihan</Button></>}>
          <div className="space-y-4">
            <Field label="Jenis iuran" required>
              <Select value={type} onChange={(e) => setType(e.target.value)}>
                {db.duesTypes.filter((x) => x.is_active).map((x) => <option key={x.id} value={x.id}>{x.name} · {rupiah(x.amount)}</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              {t?.billing_period === 'bulanan' ? (
                <Field label="Bulan"><Select value={m} onChange={(e) => setM(Number(e.target.value))}>{MONTHS.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}</Select></Field>
              ) : null}
              <Field label="Tahun"><Select value={y} onChange={(e) => setY(Number(e.target.value))}>{[year - 1, year, year + 1].map((v) => <option key={v}>{v}</option>)}</Select></Field>
            </div>
            <Field label="Jatuh tempo" required><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
            <div className="rounded-xl bg-panel px-4 py-3 text-[13.5px] text-ink-2" data-field>
              <b className="text-ink">{targets.length}</b> rumah berpenghuni · <b className="text-ink">{existing}</b> sudah memiliki tagihan periode ini
            </div>
            {err ? <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-[13.5px] font-medium text-danger-ink">{err}</p> : null}
          </div>
        </DialogShell>
      </form>
    </Modal>
  );
}

/* ---------------- Modal: kas */
function CashModal({ type, onClose }: { type: null | 'income' | 'expense'; onClose: () => void }) {
  const db = useDatabase();
  const toast = useToast();
  const id = useId();
  const [f, setF] = useState({ category_id: '', amount: '', date: todayISO(), description: '' });
  const [err, setErr] = useState('');
  useEffect(() => {
    if (type) (setF({ category_id: db.cashCategories.find((c) => c.transaction_type === type && !AUTO_CATS.includes(c.name))?.id ?? '', amount: '', date: todayISO(), description: '' }), setErr(''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const r = await actions.recordCash({ type: type!, category_id: f.category_id, amount: Number(f.amount), date: f.date, description: f.description });
    if (!r.ok) return setErr(r.error);
    toast(`${type === 'expense' ? 'Pengeluaran' : 'Pemasukan'} ${rupiah(Number(f.amount))} dicatat`);
    onClose();
  };
  return (
    <Modal open={!!type} onClose={onClose} labelledBy={id}>
      <form onSubmit={submit} noValidate>
        <DialogShell id={id} title={type === 'expense' ? 'Catat pengeluaran' : 'Catat pemasukan lain'} sub="Transaksi tidak dapat dihapus. Kesalahan dikoreksi dengan transaksi pembalik." icon={type === 'expense' ? ArrowUpRight : ArrowDownLeft} onClose={onClose}
          footer={<><Button type="button" variant="secondary" onClick={onClose}>Batal</Button><Button type="submit">Simpan transaksi</Button></>}>
          <div className="space-y-4">
            <Field label="Kategori" required>
              <Select value={f.category_id} onChange={(e) => setF({ ...f, category_id: e.target.value })}>
                {db.cashCategories.filter((c) => c.transaction_type === type && !AUTO_CATS.includes(c.name)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nominal (Rp)" required><Input inputMode="numeric" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/\D/g, '') })} placeholder="0" /></Field>
              <Field label="Tanggal" required><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
            </div>
            <Field label="Keterangan" required><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Contoh: Pembelian bohlam LED lampu jalan" /></Field>
            {err ? <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-[13.5px] font-medium text-danger-ink">{err}</p> : null}
          </div>
        </DialogShell>
      </form>
    </Modal>
  );
}

/* ---------------- Modal: bayar */
function PayModal({ invoice, onClose, cashOnly }: { invoice: Invoice | null; onClose: () => void; cashOnly?: boolean }) {
  const db = useDatabase();
  const L = useLookups();
  const toast = useToast();
  const id = useId();
  const [method, setMethod] = useState<PaymentMethod>('transfer');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [proof, setProof] = useState<PreparedFile | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const pendingSum = invoice ? db.payments.filter((p) => p.invoice_id === invoice.id && p.status === 'pending').reduce((s, p) => s + p.amount, 0) : 0;
  const remaining = invoice ? invoice.amount - invoice.paid_amount - pendingSum : 0;
  useEffect(() => {
    if (invoice) (setMethod(cashOnly ? 'tunai' : 'transfer'), setAmount(String(Math.max(remaining, 0))), setDate(todayISO()), setNote(cashOnly ? 'Diterima tunai oleh pengurus' : ''), setProof(null), setErr(''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice]);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    try {
      setProof(await prepareProof(f));
      setErr('');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const r = await actions.submitPayment({ invoice_id: invoice!.id, amount: Number(amount), method, date, note, proof: proof ? { blob: proof.blob, ext: proof.ext } : null });
    if (!r.ok) return setErr(r.error);
    toast('Pembayaran terkirim · menunggu verifikasi Bendahara');
    onClose();
  };

  return (
    <Modal open={!!invoice} onClose={onClose} labelledBy={id}>
      {invoice ? (
        <form onSubmit={submit} noValidate>
          <DialogShell id={id} title={cashOnly ? 'Catat pembayaran tunai' : 'Kirim bukti pembayaran'} sub={`${L.duesType(invoice.dues_type_id)?.name} ${period(invoice.period_month, invoice.period_year)} · ${L.household(invoice.household_id)?.house_number}`} icon={HandCoins} onClose={onClose}
            footer={<><Button type="button" variant="secondary" onClick={onClose}>Batal</Button><Button type="submit" loading={busy}>Kirim untuk verifikasi</Button></>}>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-2xl bg-panel px-4 py-3" data-field>
                <span className="text-[13px] text-muted">Sisa yang dapat dibayar</span>
                <span className="text-[18px] font-extrabold">{rupiah(Math.max(remaining, 0))}</span>
              </div>
              {!cashOnly ? (
                <>
                  <Field label="Metode pembayaran"><Choice name="Metode pembayaran" value={method} onChange={setMethod} options={[{ value: 'transfer', label: 'Transfer bank', icon: Landmark }, { value: 'tunai', label: 'Tunai', icon: Banknote }]} /></Field>
                  {method === 'transfer' ? <BankBox /> : <p className="rounded-xl bg-warn-soft px-4 py-3 text-[13px] text-warn-ink" data-field>Serahkan uang tunai ke Bendahara, lalu kirim catatan ini. Tagihan berubah setelah Bendahara memverifikasi.</p>}
                </>
              ) : null}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nominal (Rp)" required hint="Boleh dicicil"><Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} /></Field>
                <Field label="Tanggal bayar" required><Input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} /></Field>
              </div>
              {method === 'transfer' ? (
                <Field label="Bukti transfer" required hint="JPG/PNG/WEBP atau PDF. Gambar diperkecil otomatis.">
                  <label className={cx('flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed p-4 transition-colors', proof ? 'border-success bg-success-soft/50' : 'border-line hover:border-primary')}>
                    {proof?.preview ? <img src={proof.preview} alt="" className="size-14 rounded-lg object-cover" /> : <span className="grid size-14 place-items-center rounded-xl bg-primary-soft text-primary"><Upload className="size-6" /></span>}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold">{proof ? proof.name : 'Pilih atau foto bukti transfer'}</span>
                      <span className="block text-[12.5px] text-muted">{proof ? 'Ketuk untuk mengganti' : 'Nama file tidak boleh memuat nomor rekening/NIK'}</span>
                    </span>
                    <input type="file" accept="image/*,application/pdf" capture="environment" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
                  </label>
                </Field>
              ) : null}
              <Field label="Catatan (opsional)"><Input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
              {err ? <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-[13.5px] font-medium text-danger-ink">{err}</p> : null}
            </div>
          </DialogShell>
        </form>
      ) : null}
    </Modal>
  );
}

function BankBox() {
  const db = useDatabase();
  const toast = useToast();
  const n = db.neighborhood;
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-navy p-4 text-white" data-field>
      <span className="grid size-11 place-items-center rounded-xl bg-white/10"><Landmark className="size-5" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] text-navy-ink">{n.bank_name} · a.n. {n.bank_account_name}</p>
        <p className="font-mono text-[16px] font-bold tracking-wide">{n.bank_account_number}</p>
      </div>
      <button type="button" onClick={() => { navigator.clipboard?.writeText(n.bank_account_number.replace(/\D/g, '')); toast('Nomor rekening disalin'); }} className="grid size-10 place-items-center rounded-xl bg-white/10 hover:bg-white/20" aria-label="Salin nomor rekening">
        <Copy className="size-4" />
      </button>
    </div>
  );
}

/* =================================================================== WARGA */
function ResidentDues() {
  const db = useDatabase();
  const me = useMe()!;
  const L = useLookups();
  const ref = useRef<HTMLDivElement>(null);
  usePageEnter(ref);
  const [pay, setPay] = useState<Invoice | null>(null);
  const inv = db.invoices.filter((i) => i.household_id === me.householdId && i.status !== 'cancelled').sort((a, b) => b.created_at.localeCompare(a.created_at));
  const open = inv.filter((i) => i.status === 'unpaid' || i.status === 'partial');
  const pays = db.payments.filter((p) => p.household_id === me.householdId).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const sum = cashSummary(db);
  const due = open.reduce((s, i) => s + i.amount - i.paid_amount, 0);

  return (
    <div ref={ref} className="mx-auto max-w-[1100px]">
      <PageHeader title="Tagihan & Pembayaran" description="Bayar lewat transfer lalu unggah buktinya, atau serahkan tunai ke Bendahara. Status lunas muncul setelah diverifikasi." />
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-5">
          <Card data-card className="overflow-hidden">
            <div className="bg-primary px-5 py-5 text-white">
              <p className="text-[13px] text-white/80">Total belum dibayar</p>
              <p className="mt-1 text-[32px] font-extrabold tracking-tight"><CountUp value={due} format={(n) => rupiah(n)} /></p>
              <p className="text-[13px] text-white/80">{open.length ? `${open.length} tagihan terbuka` : 'Semua tagihan lunas. Terima kasih!'}</p>
            </div>
            <ul className="divide-y divide-line">
              {inv.map((i) => {
                const pend = db.payments.filter((p) => p.invoice_id === i.id && p.status === 'pending').reduce((s, p) => s + p.amount, 0);
                const canPay = (i.status === 'unpaid' || i.status === 'partial') && i.amount - i.paid_amount - pend > 0;
                return (
                  <li key={i.id} data-row className="flex items-center gap-3 px-5 py-4">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-bold">{L.duesType(i.dues_type_id)?.name}</span>
                      <span className="block text-[12.5px] text-muted">{period(i.period_month, i.period_year)} · {rupiah(i.amount)}{i.paid_amount ? ` · terbayar ${rupiah(i.paid_amount)}` : ''}</span>
                    </span>
                    {pend ? <Badge tone="orange" dot>Diverifikasi</Badge> : <StatusBadge map={INVOICE} value={i.status} />}
                    {canPay ? <Button size="sm" onClick={() => setPay(i)}>Bayar</Button> : null}
                  </li>
                );
              })}
            </ul>
          </Card>
          <Card data-card>
            <CardHeader title="Riwayat pembayaran" icon={ReceiptText} />
            {pays.length ? (
              <ul className="divide-y divide-line">
                {pays.map((p) => (
                  <li key={p.id} className="px-5 py-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <span>
                        <span className="block text-[14px] font-semibold">{rupiah(p.amount)} · {p.payment_method === 'transfer' ? 'Transfer' : 'Tunai'}</span>
                        <span className="block text-[12.5px] text-muted">{dateShort(p.payment_date)} · {db.invoices.find((i) => i.id === p.invoice_id)?.invoice_number}</span>
                      </span>
                      <StatusBadge map={PAYMENT} value={p.status} />
                    </div>
                    {p.status === 'rejected' ? <p className="mt-2 rounded-lg bg-danger-soft px-3 py-2 text-[12.5px] text-danger-ink">{p.rejection_reason}</p> : null}
                  </li>
                ))}
              </ul>
            ) : <EmptyState icon={ReceiptText} title="Belum ada pembayaran" />}
          </Card>
        </div>
        <div className="space-y-5">
          <Card data-card className="p-5">
            <p className="mb-3 text-[14px] font-bold">Rekening kas RT</p>
            <BankBox />
            <p className="mt-3 text-[12.5px] text-muted">Pastikan nominal sesuai tagihan. Simpan bukti transfer untuk diunggah.</p>
          </Card>
          <Card data-card>
            <CardHeader title="Ringkasan kas RT" sub="Transparansi untuk seluruh warga" icon={Wallet} />
            <dl className="grid gap-3 px-5 pb-5">
              <div className="flex justify-between text-[14px]"><dt className="text-muted">Pemasukan</dt><dd className="font-bold text-success-ink">{rupiah(sum.income)}</dd></div>
              <div className="flex justify-between text-[14px]"><dt className="text-muted">Pengeluaran</dt><dd className="font-bold">{rupiah(sum.expense)}</dd></div>
              <div className="flex justify-between border-t border-line pt-3 text-[15px]"><dt className="font-semibold">Saldo</dt><dd className="font-extrabold">{rupiah(sum.balance)}</dd></div>
            </dl>
          </Card>
        </div>
      </div>
      <PayModal invoice={pay} onClose={() => setPay(null)} />
    </div>
  );
}
