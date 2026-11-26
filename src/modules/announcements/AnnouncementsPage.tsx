import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { Archive, Eye, Megaphone, PencilLine, Pin, Plus, Send } from 'lucide-react';
import { Modal, Sheet, usePageEnter, useToast, useFlip } from '@/motion';
import { PageHeader, Magnetic } from '@/components/ui/PageHeader';
import { Badge, Button, EmptyState, Field, Input, Select, Textarea, cx } from '@/components/ui/primitives';
import { ConfirmDialog, DialogShell } from '@/components/ui/DialogShell';
import { Tabs } from '@/components/ui/Tabs';
import { SearchInput, Toolbar } from '@/components/ui/list';
import { StatusBadge, ANNOUNCEMENT } from '@/components/ui/status';
import { AnnIcon } from '@/modules/dashboard/DashboardPage';
import { useDatabase, useLookups, useMe } from '@/hooks/useData';
import { useAct } from '@/hooks/useAct';
import { actions } from '@/stores/db.store';
import { can } from '@/app/permissions';
import { dateTime, relative } from '@/lib/format';
import type { Announcement } from '@/types/models';

const CATS = [
  { value: 'umum', label: 'Umum' }, { value: 'kegiatan', label: 'Kegiatan' }, { value: 'keuangan', label: 'Keuangan' },
  { value: 'keamanan', label: 'Keamanan' }, { value: 'kesehatan', label: 'Kesehatan' }, { value: 'pembangunan', label: 'Pembangunan' },
];
const catLabel = (v: string) => CATS.find((c) => c.value === v)?.label ?? v;

export function AnnouncementsPage() {
  const db = useDatabase();
  const me = useMe()!;
  const L = useLookups();
  const toast = useToast();
  const act = useAct();
  const ref = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLUListElement>(null);
  usePageEnter(ref);
  const editor = can(me.role, 'announcements.create');
  const publisher = can(me.role, 'announcements.publish');
  const [cat, setCat] = useState('all');
  const [status, setStatus] = useState<'published' | 'draft' | 'archived'>('published');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [edit, setEdit] = useState<Partial<Announcement> | null>(null);
  const [pub, setPub] = useState<Announcement | null>(null);
  const capture = useFlip(grid, '[data-item]', [cat, status, q]);
  const read = new Set(db.announcementReads.filter((r) => r.user_id === me.userId).map((r) => r.announcement_id));
  const items = useMemo(
    () => db.announcements.filter((a) => (editor ? true : a.status === 'published')).sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned) || (b.published_at ?? b.created_at).localeCompare(a.published_at ?? a.created_at)),
    [db, editor],
  );
  const show = (a: Announcement) => (cat === 'all' || a.category === cat) && a.status === status && (!q || `${a.title} ${a.content}`.toLowerCase().includes(q.toLowerCase()));
  const a = db.announcements.find((x) => x.id === open);
  const totalMembers = db.memberships.filter((m) => m.is_active).length;

  useEffect(() => { if (open) actions.markAnnouncementRead(open); }, [open]);

  return (
    <div ref={ref}>
      <PageHeader
        title="Pengumuman"
        description="Informasi resmi dari pengurus RT. Draft dari Pengurus dipublikasikan oleh Ketua RT atau Sekretaris."
        actions={editor ? <Magnetic><Button icon={Plus} onClick={() => setEdit({ title: '', content: '', category: 'umum' })}>Tulis pengumuman</Button></Magnetic> : null}
      />
      <Toolbar>
        {editor ? (
          <Tabs label="Status" value={status} onChange={(v) => (capture(), setStatus(v))} tabs={[
            { value: 'published', label: 'Terbit', count: db.announcements.filter((x) => x.status === 'published').length },
            { value: 'draft', label: 'Draft', count: db.announcements.filter((x) => x.status === 'draft').length },
            { value: 'archived', label: 'Arsip' },
          ]} />
        ) : null}
        <Select aria-label="Kategori" value={cat} onChange={(e) => (capture(), setCat(e.target.value))} className="sm:w-44">
          <option value="all">Semua kategori</option>
          {CATS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </Select>
        <SearchInput value={q} onChange={(v) => (capture(), setQ(v))} placeholder="Cari pengumuman…" className="flex-1 sm:min-w-[220px]" />
      </Toolbar>

      <ul ref={grid} className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {items.map((x) => {
          const reads = db.announcementReads.filter((r) => r.announcement_id === x.id).length;
          return (
            <li key={x.id} data-item data-card hidden={!show(x)}>
              <button onClick={() => setOpen(x.id)} className={cx('card-lift flex h-full w-full flex-col rounded-[18px] border bg-card p-5 text-left shadow-sm hover:border-primary/40', x.is_pinned ? 'border-primary/40' : 'border-line')}>
                <div className="flex items-start gap-3">
                  <AnnIcon category={x.category} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone="gray">{catLabel(x.category)}</Badge>
                      {x.is_pinned ? <Badge tone="blue"><Pin className="size-3" />Disematkan</Badge> : null}
                      {x.status === 'published' && !read.has(x.id) ? <Badge tone="green">Baru</Badge> : null}
                      {x.status !== 'published' ? <StatusBadge map={ANNOUNCEMENT} value={x.status} /> : null}
                    </div>
                    <p className="mt-2 text-[16px] leading-snug font-bold text-ink">{x.title}</p>
                  </div>
                </div>
                <p className="mt-2 line-clamp-3 text-[13.5px] leading-relaxed text-ink-2">{x.content}</p>
                <div className="mt-auto flex items-center justify-between pt-4 text-[12px] text-muted">
                  <span>{L.userName(x.created_by)} · {relative(x.published_at ?? x.created_at)}</span>
                  {editor && x.status === 'published' ? <span className="inline-flex items-center gap-1"><Eye className="size-3.5" />{reads}/{totalMembers}</span> : null}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      {!items.some(show) ? <EmptyState icon={Megaphone} title="Belum ada pengumuman" text={status === 'draft' ? 'Draft yang ditulis pengurus akan muncul di sini.' : 'Pengumuman resmi RT akan tampil di sini.'} /> : null}

      <Sheet open={!!open} onClose={() => setOpen(null)} label="Isi pengumuman" wide>
        {a ? (
          <div className="flex h-full flex-col">
            <div className="border-b border-line px-6 py-5">
              <div className="flex flex-wrap gap-1.5"><Badge tone="gray">{catLabel(a.category)}</Badge><StatusBadge map={ANNOUNCEMENT} value={a.status} /></div>
              <h2 className="mt-2 text-[21px] leading-tight font-extrabold">{a.title}</h2>
              <p className="mt-1 text-[12.5px] text-muted">{L.userName(a.created_by)} · {a.published_at ? `Terbit ${dateTime(a.published_at)}` : `Draft ${dateTime(a.created_at)}`}</p>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <p className="max-w-[65ch] text-[15px] leading-[1.75] whitespace-pre-line text-ink-2" data-sheet-item>{a.content}</p>
              {editor && a.status === 'published' ? (
                <div className="mt-6 rounded-2xl border border-line p-4" data-sheet-item>
                  <p className="text-[13px] font-semibold text-ink-2">Riwayat pembacaan</p>
                  <p className="mt-1 text-[13px] text-muted">{db.announcementReads.filter((r) => r.announcement_id === a.id).length} dari {totalMembers} akun telah membaca.</p>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {db.announcementReads.filter((r) => r.announcement_id === a.id).map((r) => <li key={r.user_id}><Badge tone="blue">{L.userName(r.user_id)}</Badge></li>)}
                  </ul>
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-line px-6 py-4">
              {editor && (a.status === 'draft' || publisher) && a.status !== 'archived' ? <Button variant="secondary" icon={PencilLine} onClick={() => (setOpen(null), setEdit(a))}>Ubah</Button> : null}
              {publisher && a.status === 'published' ? <Button variant="secondary" icon={Archive} onClick={async () => { if (await act(actions.archiveAnnouncement(a.id), 'Pengumuman diarsipkan')) setOpen(null); }}>Arsipkan</Button> : null}
              {publisher && a.status === 'draft' ? <Button icon={Send} onClick={() => setPub(a)}>Publikasikan</Button> : null}
              {!publisher && a.status === 'draft' ? <p className="mr-auto self-center text-[12.5px] text-muted">Menunggu dipublikasikan Ketua RT/Sekretaris.</p> : null}
              <Button variant="ghost" onClick={() => setOpen(null)}>Tutup</Button>
            </div>
          </div>
        ) : null}
      </Sheet>

      <Editor value={edit} onClose={() => setEdit(null)} />
      <ConfirmDialog open={!!pub} onClose={() => setPub(null)} icon={Send} tone="green" title="Publikasikan pengumuman?" confirmLabel="Publikasikan"
        message={<>“{pub?.title}” akan tampil untuk seluruh warga dan notifikasi dikirim ke <b>{totalMembers}</b> akun.</>}
        onConfirm={async () => { const r = await actions.publishAnnouncement(pub!.id); toast(r.ok ? 'Pengumuman dipublikasikan & notifikasi terkirim' : r.error, r.ok ? 'success' : 'error'); setPub(null); setOpen(null); }} />
    </div>
  );
}

function Editor({ value, onClose }: { value: Partial<Announcement> | null; onClose: () => void }) {
  const me = useMe()!;
  const toast = useToast();
  const id = useId();
  const [f, setF] = useState<Partial<Announcement>>({});
  const [err, setErr] = useState('');
  useEffect(() => { if (value) (setF(value), setErr('')); }, [value]);
  const submit = async (e: FormEvent, publish = false) => {
    e.preventDefault();
    const r = await actions.saveAnnouncement(f as Announcement);
    if (!r.ok) return setErr(r.error);
    if (publish) {
      const pr = await actions.publishAnnouncement(r.data.id);
      if (!pr.ok) return setErr(`Draft tersimpan, tetapi gagal dipublikasikan: ${pr.error}`);
    }
    toast(publish ? 'Pengumuman dipublikasikan' : f.id ? 'Perubahan disimpan' : can(me.role, 'announcements.publish') ? 'Draft disimpan' : 'Draft dikirim ke Ketua RT/Sekretaris');
    onClose();
  };
  return (
    <Modal open={!!value} onClose={onClose} labelledBy={id} wide>
      <form onSubmit={(e) => submit(e)} noValidate>
        <DialogShell id={id} title={f.id ? 'Ubah pengumuman' : 'Tulis pengumuman'} icon={Megaphone} onClose={onClose}
          footer={<>
            <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
            {f.status !== 'published' ? <Button type="submit" variant={can(me.role, 'announcements.publish') ? 'secondary' : 'primary'}>Simpan draft</Button> : <Button type="submit">Simpan</Button>}
            {can(me.role, 'announcements.publish') && f.status !== 'published' ? <Button type="button" icon={Send} onClick={(e) => submit(e as unknown as FormEvent, true)}>Simpan & publikasikan</Button> : null}
          </>}>
          <div className="space-y-4">
            <Field label="Judul" required><Input value={f.title ?? ''} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Contoh: Kerja Bakti Minggu Pagi" /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Kategori"><Select value={f.category ?? 'umum'} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</Select></Field>
              <label className="flex items-center gap-2.5 self-end pb-3 text-[14px] font-semibold" data-field>
                <input type="checkbox" checked={!!f.is_pinned} onChange={(e) => setF({ ...f, is_pinned: e.target.checked })} className="size-4 accent-[var(--primary)]" /> Sematkan di atas
              </label>
            </div>
            <Field label="Isi pengumuman" required><Textarea value={f.content ?? ''} onChange={(e) => setF({ ...f, content: e.target.value })} className="min-h-[200px]" placeholder="Tulis informasi lengkap: waktu, tempat, dan apa yang perlu disiapkan warga." /></Field>
            {err ? <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-[13.5px] font-medium text-danger-ink">{err}</p> : null}
          </div>
        </DialogShell>
      </form>
    </Modal>
  );
}
