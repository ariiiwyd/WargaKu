import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { Check, CircleX, Download, FilePlus2, FileSignature, FileText, PencilLine, Send, Undo2 } from 'lucide-react';
import { Modal, Sheet, usePageEnter, useToast } from '@/motion';
import { PageHeader, Magnetic } from '@/components/ui/PageHeader';
import { Avatar, Button, Card, EmptyState, Field, Info, Input, Select, Textarea, cx } from '@/components/ui/primitives';
import { ConfirmDialog, DialogShell } from '@/components/ui/DialogShell';
import { Tabs } from '@/components/ui/Tabs';
import { Pagination, SearchInput, Toolbar, useList } from '@/components/ui/list';
import { StatusBadge, REQUEST } from '@/components/ui/status';
import { useDatabase, useLookups, useMe } from '@/hooks/useData';
import { actions } from '@/stores/db.store';
import { can } from '@/app/permissions';
import { dateTime, maskId, relative } from '@/lib/format';
import { generateLetterPdf } from '@/services/letters.service';
import type { LetterRequest, RequestStatus } from '@/types/models';

type TabKey = 'all' | 'submitted' | 'review' | 'revision' | 'done' | 'rejected';
const inTab = (s: RequestStatus, t: TabKey) => t === 'all' || (t === 'done' ? s === 'approved' || s === 'completed' : s === t);

export function LettersPage() {
  const db = useDatabase();
  const me = useMe()!;
  const L = useLookups();
  const ref = useRef<HTMLDivElement>(null);
  usePageEnter(ref);
  const [params, setParams] = useSearchParams();
  const admin = can(me.role, 'letters.viewAll');
  const tab = (params.get('tab') as TabKey) || (admin ? (me.role === 'ketua_rt' ? 'review' : 'submitted') : 'all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [create, setCreate] = useState(false);

  const mine = useMemo(() => {
    const fam = new Set(db.residents.filter((r) => r.household_id === me.householdId).map((r) => r.id));
    return admin ? db.letters : db.letters.filter((l) => fam.has(l.resident_id));
  }, [db, admin, me.householdId]);
  const sorted = useMemo(() => [...mine].sort((a, b) => b.created_at.localeCompare(a.created_at)).filter((l) => inTab(l.status, tab)), [mine, tab]);
  const list = useList(sorted, { search: (l) => `${l.request_number} ${l.letter_number ?? ''} ${L.resident(l.resident_id)?.full_name} ${L.letterType(l.letter_type_id)?.name} ${l.purpose}`, pageSize: 10 });
  const count = (t: TabKey) => mine.filter((l) => inTab(l.status, t)).length;

  return (
    <div ref={ref}>
      <PageHeader
        title={admin ? 'Surat & Layanan' : 'Surat Saya'}
        description={admin ? 'Alur: warga mengajukan → Sekretaris memeriksa kelengkapan → Ketua RT menyetujui → nomor surat terbit otomatis.' : 'Ajukan surat pengantar dan keterangan tanpa harus datang ke rumah Pak RT. Pantau statusnya di sini.'}
        actions={<Magnetic><Button icon={FilePlus2} onClick={() => setCreate(true)}>Ajukan surat</Button></Magnetic>}
      />

      <Flow />

      <Toolbar>
        <Tabs
          label="Status surat"
          value={tab}
          onChange={(v) => setParams({ tab: v }, { replace: true })}
          tabs={[
            ...(admin ? [{ value: 'submitted' as const, label: 'Perlu diperiksa', count: count('submitted') }, { value: 'review' as const, label: 'Menunggu TTD', count: count('review') }] : []),
            { value: 'revision', label: 'Perlu perbaikan', count: count('revision') },
            { value: 'done', label: 'Selesai', count: count('done') },
            { value: 'rejected', label: 'Ditolak', count: count('rejected') },
            { value: 'all', label: 'Semua', count: mine.length },
          ]}
        />
        <SearchInput value={list.q} onChange={list.setQ} placeholder="Cari nomor, nama, jenis surat…" className="flex-1 sm:min-w-[240px]" />
      </Toolbar>

      <Card data-card className="overflow-hidden">
        {list.rows.length ? (
          <ul className="divide-y divide-line">
            {list.rows.map((l) => {
              const r = L.resident(l.resident_id);
              return (
                <li key={l.id} data-row>
                  <button onClick={() => setOpenId(l.id)} className="flex w-full items-center gap-4 px-4 py-4 text-left hover:bg-panel/50 sm:px-5">
                    <span className={cx('grid size-11 shrink-0 place-items-center rounded-xl', l.status === 'review' ? 'bg-violet-soft text-violet-ink' : l.status === 'rejected' ? 'bg-danger-soft text-danger-ink' : ['approved', 'completed'].includes(l.status) ? 'bg-success-soft text-success-ink' : 'bg-primary-soft text-primary')}>
                      {['approved', 'completed'].includes(l.status) ? <FileSignature className="size-5" /> : <FileText className="size-5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2">
                        <span className="truncate text-[15px] font-bold text-ink">{L.letterType(l.letter_type_id)?.name}</span>
                        <span className="text-[12.5px] text-muted">{l.letter_number ?? l.request_number}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-[13px] text-ink-2">{r?.full_name} · {l.purpose}</span>
                      <span className="mt-0.5 block text-[12px] text-muted">Diajukan {relative(l.created_at)}</span>
                    </span>
                    <StatusBadge map={REQUEST} value={l.status} />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={FileText}
            title={tab === 'submitted' || tab === 'review' ? 'Antrean kosong' : 'Belum ada surat di sini'}
            text={tab === 'submitted' || tab === 'review' ? 'Tidak ada permohonan yang menunggu tindakan Anda.' : 'Permohonan surat akan muncul di sini setelah diajukan.'}
            action={!admin ? <Button icon={FilePlus2} onClick={() => setCreate(true)}>Ajukan surat pertama</Button> : undefined}
          />
        )}
        <Pagination {...list} unit="permohonan" />
      </Card>

      <LetterDetail id={openId} onClose={() => setOpenId(null)} />
      <RequestForm open={create} onClose={() => setCreate(false)} />
    </div>
  );
}

function Flow() {
  const steps = ['Diajukan warga', 'Diperiksa Sekretaris', 'Disetujui Ketua RT', 'Nomor & PDF terbit'];
  return (
    <ol data-fade className="mb-5 hidden grid-cols-4 gap-2 md:grid">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-2.5 rounded-xl border border-line bg-card px-3.5 py-2.5 text-[13px] font-semibold text-ink-2">
          <span className="grid size-6 place-items-center rounded-full bg-primary text-[11.5px] font-bold text-white">{i + 1}</span>
          {s}
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------------ Detail */
function LetterDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const db = useDatabase();
  const me = useMe()!;
  const L = useLookups();
  const toast = useToast();
  const [shownId, setShownId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | 'forward' | 'return' | 'approve' | 'reject'>(null);
  const [fixing, setFixing] = useState(false);
  const [busy, setBusy] = useState(false);
  if (id && id !== shownId) (setShownId(id), setFixing(false));
  const l = db.letters.find((x) => x.id === shownId);
  const r = L.resident(l?.resident_id);
  const t = l ? L.letterType(l.letter_type_id) : undefined;
  const admin = can(me.role, 'letters.viewAll');

  const act = (fn: () => { ok: boolean; error?: string }, msg: string) => {
    const res = fn() as { ok: boolean; error?: string };
    if (!res.ok) {
      toast(res.error!, 'error');
      return false;
    }
    toast(msg);
    setConfirm(null);
    return true;
  };

  const download = async () => {
    if (!l || !r || !t) return;
    setBusy(true);
    try {
      await generateLetterPdf({ letter: l, type: t, resident: r, household: L.household(r.household_id), rt: db.neighborhood, ketua: L.userName(l.approved_by) });
      if (!admin) actions.markLetterDownloaded(l.id);
      toast('PDF surat diunduh');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Sheet open={!!id} onClose={onClose} label="Detail permohonan surat" wide>
        {l && r && t ? (
          <div className="flex h-full flex-col">
            <div className="border-b border-line px-6 py-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[12.5px] font-semibold text-muted">{l.request_number}</p>
                  <h2 className="mt-0.5 text-[19px] font-extrabold">{t.name}</h2>
                </div>
                <StatusBadge map={REQUEST} value={l.status} />
              </div>
              {l.letter_number ? (
                <div className="mt-3 rounded-xl bg-success-soft px-3.5 py-2.5 text-[13.5px] text-success-ink">
                  Nomor surat <b className="font-mono">{l.letter_number}</b>
                </div>
              ) : null}
              {l.status === 'revision' && l.review_note ? <div className="mt-3 rounded-xl bg-warn-soft px-3.5 py-2.5 text-[13.5px] text-warn-ink"><b>Catatan Sekretaris:</b> {l.review_note}</div> : null}
              {l.status === 'rejected' ? <div className="mt-3 rounded-xl bg-danger-soft px-3.5 py-2.5 text-[13.5px] text-danger-ink"><b>Alasan penolakan:</b> {l.rejection_reason}</div> : null}
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
              {fixing ? (
                <FixForm letter={l} onDone={() => setFixing(false)} />
              ) : (
                <>
                  <section data-sheet-item>
                    <p className="mb-2.5 text-[13px] font-semibold text-ink-2">Pemohon</p>
                    <div className="flex items-center gap-3 rounded-2xl border border-line p-3.5">
                      <Avatar name={r.full_name} size={42} />
                      <div className="min-w-0">
                        <p className="truncate font-bold">{r.full_name}</p>
                        <p className="text-[12.5px] text-muted">Rumah {L.household(r.household_id)?.house_number} · {r.family_relationship}{admin ? ` · NIK ${maskId(r.nik)}` : ''}</p>
                      </div>
                    </div>
                  </section>
                  <dl className="grid gap-4 sm:grid-cols-2" data-sheet-item>
                    <Info label="Keperluan" className="sm:col-span-2">{l.purpose}</Info>
                    {Object.entries(l.form_data).map(([k, v]) => <Info key={k} label={k.replace(/_/g, ' ')}>{v}</Info>)}
                    <Info label="Diajukan">{dateTime(l.created_at)}</Info>
                    <Info label="Pemeriksa">{l.reviewed_by ? L.userName(l.reviewed_by) : 'Belum diperiksa'}</Info>
                  </dl>
                  <section data-sheet-item>
                    <p className="mb-2.5 text-[13px] font-semibold text-ink-2">Riwayat status</p>
                    <ol className="relative border-l-2 border-line pl-5">
                      {l.history.map((h, i) => (
                        <li key={i} className="relative pb-4 last:pb-0">
                          <span className={cx('absolute top-0.5 -left-[27px] grid size-4 place-items-center rounded-full ring-4 ring-card', h.status === 'rejected' ? 'bg-danger' : h.status === 'revision' ? 'bg-warn' : 'bg-primary')} />
                          <p className="text-[13.5px] font-semibold">{REQUEST[h.status][0]}</p>
                          {h.note ? <p className="text-[13px] text-ink-2">{h.note}</p> : null}
                          <p className="text-[12px] text-muted">{L.userName(h.by)} · {dateTime(h.at)}</p>
                        </li>
                      ))}
                    </ol>
                  </section>
                </>
              )}
            </div>

            {!fixing ? (
              <div className="flex flex-wrap justify-end gap-2 border-t border-line px-6 py-4">
                {l.status === 'submitted' && can(me.role, 'letters.review') ? (
                  <>
                    <Button variant="secondary" icon={Undo2} onClick={() => setConfirm('return')}>Kembalikan</Button>
                    <Button icon={Send} onClick={() => setConfirm('forward')}>Teruskan ke Ketua RT</Button>
                  </>
                ) : null}
                {l.status === 'review' && can(me.role, 'letters.approve') ? (
                  <>
                    <Button variant="secondary" icon={CircleX} onClick={() => setConfirm('reject')}>Tolak</Button>
                    <Button variant="success" icon={Check} onClick={() => setConfirm('approve')}>Setujui & terbitkan nomor</Button>
                  </>
                ) : null}
                {l.status === 'review' && me.role === 'sekretaris' ? <p className="mr-auto self-center text-[12.5px] text-muted">Menunggu persetujuan final Ketua RT.</p> : null}
                {l.status === 'revision' && !admin ? <Button icon={PencilLine} onClick={() => setFixing(true)}>Perbaiki & kirim ulang</Button> : null}
                {['approved', 'completed'].includes(l.status) ? <Button icon={Download} loading={busy} onClick={download}>Unduh PDF</Button> : null}
                <Button variant="ghost" onClick={onClose}>Tutup</Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </Sheet>

      {l ? (
        <>
          <ConfirmDialog open={confirm === 'forward'} onClose={() => setConfirm(null)} icon={Send} title="Teruskan ke Ketua RT?"
            message={<>Berkas <b>{l.request_number}</b> dinyatakan lengkap dan akan menunggu persetujuan final Ketua RT.</>}
            confirmLabel="Ya, teruskan" reason="optional" reasonLabel="Catatan untuk Ketua RT"
            onConfirm={(n) => act(() => actions.reviewLetter(l.id, true, n), 'Permohonan diteruskan ke Ketua RT')} />
          <ConfirmDialog open={confirm === 'return'} onClose={() => setConfirm(null)} icon={Undo2} tone="red" title="Kembalikan untuk perbaikan?"
            message="Pemohon akan menerima notifikasi berisi catatan Anda dan dapat mengirim ulang permohonan."
            confirmLabel="Kembalikan" reason="required" reasonLabel="Catatan perbaikan" reasonPlaceholder="Contoh: lampirkan alamat lokasi usaha"
            onConfirm={(n) => act(() => actions.reviewLetter(l.id, false, n), 'Permohonan dikembalikan ke pemohon')} />
          <ConfirmDialog open={confirm === 'approve'} onClose={() => setConfirm(null)} icon={FileSignature} tone="green" title="Setujui surat ini?"
            message={<>Nomor surat akan diterbitkan otomatis dan <b>tidak dapat digunakan ulang</b>. Pemohon dapat langsung mengunduh PDF.</>}
            confirmLabel="Setujui & terbitkan" onConfirm={() => act(() => actions.approveLetter(l.id, true, ''), 'Surat disetujui, nomor diterbitkan')} />
          <ConfirmDialog open={confirm === 'reject'} onClose={() => setConfirm(null)} icon={CircleX} tone="red" title="Tolak permohonan?"
            message="Penolakan bersifat final. Pemohon akan menerima alasan Anda." confirmLabel="Tolak permohonan" reason="required" reasonLabel="Alasan penolakan"
            onConfirm={(n) => act(() => actions.approveLetter(l.id, false, n), 'Permohonan ditolak')} />
        </>
      ) : null}
    </>
  );
}

function FixForm({ letter, onDone }: { letter: LetterRequest; onDone: () => void }) {
  const toast = useToast();
  const [purpose, setPurpose] = useState(letter.purpose);
  const [extra, setExtra] = useState(Object.entries(letter.form_data).map(([k, v]) => `${k}: ${v}`).join('\n'));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const fd = Object.fromEntries(extra.split('\n').map((l) => l.split(':').map((s) => s.trim())).filter((p) => p[0] && p[1]).map(([k, ...v]) => [k!.toLowerCase().replace(/\s+/g, '_'), v.join(':')]));
    const r = actions.resubmitLetter(letter.id, purpose, fd);
    if (!r.ok) return toast(r.error, 'error');
    toast('Permohonan dikirim ulang');
    onDone();
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Keperluan" required><Textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} /></Field>
      <Field label="Keterangan tambahan" hint="Satu baris per data, format: nama data: isi"><Textarea value={extra} onChange={(e) => setExtra(e.target.value)} placeholder={'alamat_usaha: Jl. Kenanga No. 3\nlama_usaha: 2 tahun'} /></Field>
      <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onDone}>Batal</Button><Button type="submit" icon={Send}>Kirim ulang</Button></div>
    </form>
  );
}

/* ------------------------------------------------------------------ Form pengajuan */
const EXTRA: Record<string, { key: string; label: string; placeholder: string }[]> = {
  SKU: [
    { key: 'nama_usaha', label: 'Nama usaha', placeholder: 'Warung Berkah' },
    { key: 'jenis_usaha', label: 'Jenis usaha', placeholder: 'Kelontong / kuliner / jasa' },
    { key: 'alamat_usaha', label: 'Alamat usaha', placeholder: 'Jl. Kenanga No. 3' },
  ],
  SKTM: [{ key: 'penghasilan_bulanan', label: 'Perkiraan penghasilan keluarga per bulan', placeholder: 'Rp1.500.000' }],
};

function RequestForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const db = useDatabase();
  const me = useMe()!;
  const toast = useToast();
  const id = useId();
  const admin = can(me.role, 'letters.review');
  const [type, setType] = useState('');
  const [resident, setResident] = useState('');
  const [purpose, setPurpose] = useState('');
  const [fd, setFd] = useState<Record<string, string>>({});
  const [err, setErr] = useState('');
  useEffect(() => {
    if (open) (setType(''), setResident(me.residentId ?? ''), setPurpose(''), setFd({}), setErr(''));
  }, [open, me.residentId]);
  const pool = admin ? db.residents.filter((r) => r.is_active) : db.residents.filter((r) => r.household_id === me.householdId && r.is_active);
  const lt = db.letterTypes.find((t) => t.id === type);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = actions.submitLetter({ letter_type_id: type, resident_id: resident, purpose, form_data: fd });
    if (!r.ok) return setErr(r.error);
    toast(`Permohonan ${r.data.request_number} terkirim ke Sekretaris`);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} labelledBy={id} wide>
      <form onSubmit={submit} noValidate>
        <DialogShell id={id} title="Ajukan surat" sub="Sekretaris akan memeriksa kelengkapan, lalu Ketua RT menyetujui." icon={FilePlus2} onClose={onClose}
          footer={<><Button type="button" variant="secondary" onClick={onClose}>Batal</Button><Button type="submit" icon={Send}>Kirim permohonan</Button></>}>
          <div className="space-y-5">
            <div data-field>
              <p className="mb-2 text-[13px] font-semibold text-ink-2">Jenis surat <span className="text-danger">*</span></p>
              <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
                {db.letterTypes.filter((t) => t.is_active).map((t) => (
                  <button key={t.id} type="button" role="radio" aria-checked={type === t.id} onClick={() => (setType(t.id), setFd({}), setErr(''))}
                    className={cx('rounded-2xl border p-3.5 text-left transition-colors', type === t.id ? 'border-primary bg-primary-soft' : 'border-line hover:border-line-strong')}>
                    <span className={cx('block text-[14px] font-bold', type === t.id ? 'text-primary-soft-ink' : 'text-ink')}>{t.name}</span>
                    <span className="mt-0.5 block text-[12.5px] text-muted">{t.description}</span>
                  </button>
                ))}
              </div>
            </div>
            <Field label="Untuk siapa" required>
              <Select value={resident} onChange={(e) => setResident(e.target.value)}>
                <option value="">Pilih anggota keluarga</option>
                {pool.map((r) => <option key={r.id} value={r.id}>{r.full_name} · {r.family_relationship}</option>)}
              </Select>
            </Field>
            <Field label="Keperluan" required hint="Jelaskan untuk apa surat ini digunakan">
              <Textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Contoh: Persyaratan pendaftaran BPJS Kesehatan" />
            </Field>
            {lt && EXTRA[lt.code] ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {EXTRA[lt.code]!.map((x) => (
                  <Field key={x.key} label={x.label}>
                    <Input value={fd[x.key] ?? ''} onChange={(e) => setFd({ ...fd, [x.key]: e.target.value })} placeholder={x.placeholder} />
                  </Field>
                ))}
              </div>
            ) : null}
            {err ? <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-[13.5px] font-medium text-danger-ink">{err}</p> : null}
          </div>
        </DialogShell>
      </form>
    </Modal>
  );
}
