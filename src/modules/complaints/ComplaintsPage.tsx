import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { MapPin, MessageSquareWarning, Plus, Reply, Send, UserCheck } from 'lucide-react';
import { Modal, Sheet, usePageEnter, useToast } from '@/motion';
import { PageHeader, Magnetic } from '@/components/ui/PageHeader';
import { Avatar, Button, Card, Choice, EmptyState, Field, Info, Input, Select, Textarea, cx } from '@/components/ui/primitives';
import { DialogShell } from '@/components/ui/DialogShell';
import { Tabs } from '@/components/ui/Tabs';
import { Pagination, SearchInput, Toolbar, useList } from '@/components/ui/list';
import { StatusBadge, COMPLAINT, PRIORITY } from '@/components/ui/status';
import { useDatabase, useLookups, useMe } from '@/hooks/useData';
import { actions } from '@/stores/db.store';
import { can } from '@/app/permissions';
import { dateTime, relative } from '@/lib/format';
import type { ComplaintPriority, ComplaintStatus } from '@/types/models';

type TabKey = 'open' | 'mine' | 'done' | 'all';

export function ComplaintsPage() {
  const db = useDatabase();
  const me = useMe()!;
  const L = useLookups();
  const ref = useRef<HTMLDivElement>(null);
  usePageEnter(ref);
  const all = can(me.role, 'complaints.viewAll');
  const handler = me.role === 'pengurus';
  const [tab, setTab] = useState<TabKey>(handler ? 'mine' : 'open');
  const [openId, setOpenId] = useState<string | null>(null);
  const [create, setCreate] = useState(false);

  const visible = useMemo(() => db.complaints.filter((c) => all || c.assigned_to === me.userId || c.created_by === me.userId || c.resident_id === me.residentId), [db, all, me]);
  const inTab = (s: ComplaintStatus, c: (typeof visible)[number], t: TabKey) =>
    t === 'all' || (t === 'open' ? !['resolved', 'closed'].includes(s) : t === 'done' ? ['resolved', 'closed'].includes(s) : c.assigned_to === me.userId && !['resolved', 'closed'].includes(s));
  const rows = visible.filter((c) => inTab(c.status, c, tab)).sort((a, b) => ['darurat', 'tinggi', 'normal', 'rendah'].indexOf(a.priority) - ['darurat', 'tinggi', 'normal', 'rendah'].indexOf(b.priority) || b.created_at.localeCompare(a.created_at));
  const list = useList(rows, { search: (c) => `${c.ticket_number} ${c.title} ${c.location}`, pageSize: 10 });

  return (
    <div ref={ref}>
      <PageHeader
        title="Pengaduan"
        description={all || handler ? 'Tugaskan, tindak lanjuti, dan beri tanggapan. Pelapor melihat setiap perubahan status.' : 'Laporkan masalah lingkungan — dari lampu jalan mati sampai saluran tersumbat — dan pantau tindak lanjutnya.'}
        actions={<Magnetic><Button icon={Plus} onClick={() => setCreate(true)}>Buat laporan</Button></Magnetic>}
      />
      <Toolbar>
        <Tabs label="Status pengaduan" value={tab} onChange={setTab} tabs={[
          { value: 'open', label: 'Aktif', count: visible.filter((c) => inTab(c.status, c, 'open')).length },
          ...(handler || me.role === 'ketua_rt' ? [{ value: 'mine' as const, label: 'Tugas saya', count: visible.filter((c) => inTab(c.status, c, 'mine')).length }] : []),
          { value: 'done', label: 'Selesai', count: visible.filter((c) => inTab(c.status, c, 'done')).length },
          { value: 'all', label: 'Semua' },
        ]} />
        <SearchInput value={list.q} onChange={list.setQ} placeholder="Cari laporan atau lokasi…" className="flex-1 sm:min-w-[220px]" />
      </Toolbar>
      <Card data-card className="overflow-hidden">
        {list.rows.length ? (
          <ul className="divide-y divide-line">
            {list.rows.map((c) => (
              <li key={c.id} data-row>
                <button onClick={() => setOpenId(c.id)} className="flex w-full items-start gap-4 px-4 py-4 text-left hover:bg-panel/50 sm:px-5">
                  <span className={cx('mt-0.5 grid size-11 shrink-0 place-items-center rounded-xl', c.priority === 'darurat' ? 'bg-danger text-white' : c.priority === 'tinggi' ? 'bg-warn-soft text-warn-ink' : 'bg-primary-soft text-primary')}>
                    <MessageSquareWarning className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[15px] font-bold text-ink">{c.title}</span>
                      <StatusBadge map={PRIORITY} value={c.priority} />
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 text-[13px] text-ink-2"><MapPin className="size-3.5 text-muted" />{c.location || '—'}</span>
                    <span className="mt-0.5 block text-[12px] text-muted">{c.ticket_number} · {L.complaintCategory(c.category_id)?.name} · {relative(c.created_at)}{c.assigned_to ? ` · ${L.userName(c.assigned_to)}` : ''}</span>
                  </span>
                  <StatusBadge map={COMPLAINT} value={c.status} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={MessageSquareWarning} title="Tidak ada pengaduan" text="Lingkungan aman terkendali. Laporan baru akan muncul di sini." />
        )}
        <Pagination {...list} unit="laporan" />
      </Card>
      <Detail id={openId} onClose={() => setOpenId(null)} />
      <CreateForm open={create} onClose={() => setCreate(false)} />
    </div>
  );
}

function Detail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const db = useDatabase();
  const me = useMe()!;
  const L = useLookups();
  const toast = useToast();
  const [shown, setShown] = useState<string | null>(null);
  const [assignee, setAssignee] = useState('');
  const [status, setStatus] = useState<ComplaintStatus>('in_progress');
  const [msg, setMsg] = useState('');
  if (id && id !== shown) (setShown(id), setMsg(''), setAssignee(''));
  const c = db.complaints.find((x) => x.id === shown);
  const staff = db.memberships.filter((m) => m.is_active && m.role !== 'warga').map((m) => L.profile(m.user_id)!);
  const canHandle = c && (me.role === 'ketua_rt' || c.assigned_to === me.userId) && !['closed'].includes(c.status);
  useEffect(() => { if (c) setStatus(c.status === 'assigned' || c.status === 'submitted' ? 'in_progress' : c.status === 'in_progress' ? 'resolved' : 'closed'); }, [c?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const assign = () => {
    const r = actions.assignComplaint(c!.id, assignee, msg);
    toast(r.ok ? 'Pengaduan ditugaskan' : r.error, r.ok ? 'success' : 'error');
    if (r.ok) setMsg('');
  };
  const respond = (e: FormEvent) => {
    e.preventDefault();
    const r = actions.updateComplaint(c!.id, status, msg);
    toast(r.ok ? 'Tanggapan terkirim ke pelapor' : r.error, r.ok ? 'success' : 'error');
    if (r.ok) setMsg('');
  };

  return (
    <Sheet open={!!id} onClose={onClose} label="Detail pengaduan" wide>
      {c ? (
        <div className="flex h-full flex-col">
          <div className="border-b border-line px-6 py-5">
            <div className="flex flex-wrap items-center gap-1.5"><StatusBadge map={COMPLAINT} value={c.status} /><StatusBadge map={PRIORITY} value={c.priority} /></div>
            <h2 className="mt-2 text-[20px] leading-tight font-extrabold">{c.title}</h2>
            <p className="mt-1 text-[12.5px] text-muted">{c.ticket_number} · {L.complaintCategory(c.category_id)?.name}</p>
          </div>
          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
            <p className="text-[14.5px] leading-relaxed text-ink-2" data-sheet-item>{c.description}</p>
            <dl className="grid grid-cols-2 gap-4" data-sheet-item>
              <Info label="Lokasi">{c.location}</Info>
              <Info label="Pelapor">{L.resident(c.resident_id)?.full_name}</Info>
              <Info label="Dilaporkan">{dateTime(c.created_at)}</Info>
              <Info label="Petugas">{c.assigned_to ? L.userName(c.assigned_to) : 'Belum ditugaskan'}</Info>
            </dl>
            <section data-sheet-item>
              <p className="mb-3 text-[13px] font-semibold text-ink-2">Riwayat tindak lanjut</p>
              <ol className="space-y-3">
                {c.updates.map((u, i) => (
                  <li key={i} className="flex gap-3">
                    <Avatar name={L.userName(u.by)} size={32} />
                    <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md bg-panel px-3.5 py-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[13px] font-bold">{L.userName(u.by)}</span>
                        <StatusBadge map={COMPLAINT} value={u.status} />
                      </div>
                      <p className="mt-1 text-[13.5px] text-ink-2">{u.message}</p>
                      <p className="mt-1 text-[11.5px] text-muted">{dateTime(u.at)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </div>
          {can(me.role, 'complaints.assign') && ['submitted', 'assigned'].includes(c.status) ? (
            <div className="space-y-3 border-t border-line px-6 py-4">
              <p className="text-[13px] font-semibold">Tugaskan ke petugas</p>
              <div className="flex gap-2">
                <Select value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="Petugas">
                  <option value="">Pilih pengurus</option>
                  {staff.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </Select>
                <Button icon={UserCheck} disabled={!assignee} onClick={assign}>Tugaskan</Button>
              </div>
            </div>
          ) : null}
          {canHandle && c.status !== 'submitted' ? (
            <form onSubmit={respond} className="space-y-3 border-t border-line px-6 py-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[13px] font-semibold">Beri tanggapan</p>
                <Select value={status} onChange={(e) => setStatus(e.target.value as ComplaintStatus)} className="h-9 w-auto text-[13px]" aria-label="Status baru">
                  <option value="in_progress">Diproses</option>
                  <option value="resolved">Selesai</option>
                  {me.role === 'ketua_rt' ? <option value="closed">Ditutup</option> : null}
                </Select>
              </div>
              <div className="flex gap-2">
                <Input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Tulis perkembangan untuk pelapor…" aria-label="Tanggapan" />
                <Button type="submit" icon={Reply}>Kirim</Button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}
    </Sheet>
  );
}

function CreateForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const db = useDatabase();
  const toast = useToast();
  const id = useId();
  const [f, setF] = useState({ category_id: '', title: '', description: '', location: '', priority: 'normal' as ComplaintPriority });
  const [err, setErr] = useState('');
  useEffect(() => { if (open) (setF({ category_id: '', title: '', description: '', location: '', priority: 'normal' }), setErr('')); }, [open]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = actions.fileComplaint(f);
    if (!r.ok) return setErr(r.error);
    toast(`Laporan ${r.data.ticket_number} terkirim ke Ketua RT`);
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} labelledBy={id}>
      <form onSubmit={submit} noValidate>
        <DialogShell id={id} title="Buat laporan pengaduan" sub="Laporan Anda diteruskan ke Ketua RT untuk ditugaskan." icon={MessageSquareWarning} onClose={onClose}
          footer={<><Button type="button" variant="secondary" onClick={onClose}>Batal</Button><Button type="submit" icon={Send}>Kirim laporan</Button></>}>
          <div className="space-y-4">
            <Field label="Kategori" required>
              <Select value={f.category_id} onChange={(e) => setF({ ...f, category_id: e.target.value })}>
                <option value="">Pilih kategori</option>
                {db.complaintCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Judul laporan" required><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Contoh: Lampu jalan mati" /></Field>
            <Field label="Lokasi"><Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="Contoh: Jl. Kenanga depan B-04" /></Field>
            <Field label="Uraian" required><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Jelaskan apa yang terjadi dan sejak kapan." /></Field>
            <Field label="Prioritas">
              <Choice name="Prioritas" value={f.priority} onChange={(v) => setF({ ...f, priority: v })} options={[{ value: 'rendah', label: 'Rendah' }, { value: 'normal', label: 'Normal' }, { value: 'tinggi', label: 'Tinggi' }, { value: 'darurat', label: 'Darurat' }]} />
            </Field>
            {err ? <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-[13.5px] font-medium text-danger-ink">{err}</p> : null}
          </div>
        </DialogShell>
      </form>
    </Modal>
  );
}
