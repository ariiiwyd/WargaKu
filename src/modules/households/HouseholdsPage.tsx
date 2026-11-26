import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { BookUser, Eye, EyeOff, House, Plus, UserPlus, Users } from 'lucide-react';
import { Sheet, usePageEnter, useToast, useFlip } from '@/motion';
import { PageHeader, Magnetic } from '@/components/ui/PageHeader';
import { Avatar, Badge, Button, Card, CardHeader, EmptyState, Field, Info, Input, Select, cx } from '@/components/ui/primitives';
import { Tabs } from '@/components/ui/Tabs';
import { SearchInput, Toolbar } from '@/components/ui/list';
import { StatusBadge, RESIDENT, INVOICE } from '@/components/ui/status';
import { useDatabase, useLookups, useMe } from '@/hooks/useData';
import { actions } from '@/stores/db.store';
import { can } from '@/app/permissions';
import { age, maskId, period, rupiah } from '@/lib/format';
import type { Household } from '@/types/models';

export function HouseholdsPage() {
  const me = useMe()!;
  return can(me.role, 'households.view') ? <AdminHouseholds /> : <MyFamily />;
}

/* ------------------------------------------------------------------ Admin */
function AdminHouseholds() {
  const db = useDatabase();
  const me = useMe()!;
  const L = useLookups();
  const ref = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLUListElement>(null);
  usePageEnter(ref);
  const [block, setBlock] = useState<'all' | 'A' | 'B' | 'C'>('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Household | null>(null);
  const [form, setForm] = useState<Partial<Household> | null>(null);
  const capture = useFlip(grid, '[data-item]', [block, q]);
  const manage = can(me.role, 'households.manage');

  const rows = useMemo(
    () =>
      db.households.map((h) => {
        const members = db.residents.filter((r) => r.household_id === h.id && r.is_active);
        const unpaid = db.invoices.filter((i) => i.household_id === h.id && (i.status === 'unpaid' || i.status === 'partial'));
        return { h, members, head: L.headOf(h), unpaid };
      }),
    [db, L],
  );
  const match = (r: (typeof rows)[number]) =>
    (block === 'all' || r.h.house_number.startsWith(block)) &&
    (!q.trim() || `${r.h.house_number} ${r.head?.full_name ?? ''} ${r.h.address}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div ref={ref}>
      <PageHeader
        title="Data Keluarga"
        description={`${db.households.filter((h) => h.status === 'active').length} rumah berpenghuni dari ${db.households.length} unit di ${db.neighborhood.name}.`}
        actions={manage ? <Magnetic><Button icon={Plus} onClick={() => setForm({ house_number: '', address: '' })}>Tambah keluarga</Button></Magnetic> : null}
      />
      <Toolbar>
        <Tabs
          label="Blok"
          value={block}
          onChange={(v) => (capture(), setBlock(v))}
          tabs={[
            { value: 'all', label: 'Semua blok' },
            { value: 'A', label: 'Blok A · Melati' },
            { value: 'B', label: 'Blok B · Kenanga' },
            { value: 'C', label: 'Blok C · Anggrek' },
          ]}
        />
        <SearchInput value={q} onChange={(v) => (capture(), setQ(v))} placeholder="Cari nomor rumah atau kepala keluarga…" className="flex-1 sm:min-w-[260px]" />
      </Toolbar>

      <ul ref={grid} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {rows.map((r) => (
          <li key={r.h.id} data-item data-card hidden={!match(r)}>
            <button onClick={() => setOpen(r.h)} className="card-lift flex h-full w-full flex-col rounded-[18px] border border-line bg-card p-4 text-left shadow-sm hover:border-primary/40">
              <div className="flex items-start justify-between gap-2">
                <span className="flex items-center gap-3">
                  <span className={cx('grid size-12 place-items-center rounded-2xl text-[15px] font-extrabold', r.h.status === 'vacant' ? 'bg-panel-2 text-muted' : 'bg-primary-soft text-primary-soft-ink')}>
                    {r.h.house_number}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-bold text-ink">{r.head?.full_name ?? 'Rumah kosong'}</span>
                    <span className="block truncate text-[12.5px] text-muted">{r.h.address.split(',')[0]}</span>
                  </span>
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="flex -space-x-2">
                  {r.members.slice(0, 4).map((m) => <Avatar key={m.id} name={m.full_name} size={28} className="ring-2 ring-card" />)}
                  {r.members.length > 4 ? <span className="grid size-7 place-items-center rounded-full bg-panel-2 text-[11px] font-bold text-ink-2 ring-2 ring-card">+{r.members.length - 4}</span> : null}
                </span>
                {r.h.status === 'vacant' ? (
                  <Badge tone="gray">Kosong</Badge>
                ) : r.unpaid.length ? (
                  <Badge tone="red" dot>{r.unpaid.length} tagihan terbuka</Badge>
                ) : (
                  <Badge tone="green" dot>Iuran lancar</Badge>
                )}
              </div>
            </button>
          </li>
        ))}
      </ul>
      {!rows.some(match) ? <EmptyState icon={House} title="Rumah tidak ditemukan" text="Periksa kembali nomor rumah atau nama kepala keluarga." /> : null}

      <HouseholdDetail household={open} onClose={() => setOpen(null)} onEdit={(h) => (setOpen(null), setForm(h))} />
      <HouseholdForm value={form} onClose={() => setForm(null)} />
    </div>
  );
}

function HouseholdDetail({ household, onClose, onEdit }: { household: Household | null; onClose: () => void; onEdit: (h: Household) => void }) {
  const db = useDatabase();
  const me = useMe()!;
  const L = useLookups();
  const [shown, setShown] = useState<Household | null>(null);
  const [kk, setKk] = useState(false);
  if (household && household !== shown) (setShown(household), setKk(false));
  const h = shown ? db.households.find((x) => x.id === shown.id) ?? shown : null;
  const members = db.residents.filter((r) => r.household_id === h?.id);
  const inv = db.invoices.filter((i) => i.household_id === h?.id && i.status !== 'cancelled').slice(-4).reverse();
  const sensitive = can(me.role, 'residents.viewSensitive');

  return (
    <Sheet open={!!household} onClose={onClose} label="Detail keluarga" wide>
      {h ? (
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-4 border-b border-line px-6 py-5">
            <span className="grid size-14 place-items-center rounded-2xl bg-primary text-[17px] font-extrabold text-white">{h.house_number}</span>
            <div className="min-w-0">
              <h2 className="truncate text-[18px] font-bold">Keluarga {L.headOf(h)?.full_name ?? '—'}</h2>
              <p className="truncate text-[13px] text-muted">{h.address}</p>
            </div>
          </div>
          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
            <dl className="grid grid-cols-2 gap-4" data-sheet-item>
              <div className="col-span-2 flex items-end justify-between rounded-xl border border-line bg-panel/50 p-3">
                <Info label="Nomor KK (data terbatas)">
                  <span className="font-mono">{sensitive && kk ? h.family_card_number : maskId(h.family_card_number)}</span>
                </Info>
                {sensitive ? (
                  <button onClick={() => setKk((v) => !v)} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary">
                    {kk ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    {kk ? 'Sembunyikan' : 'Tampilkan'}
                  </button>
                ) : null}
              </div>
              <Info label="Status rumah">{h.status === 'active' ? 'Berpenghuni' : h.status === 'vacant' ? 'Kosong' : 'Nonaktif'}</Info>
              <Info label="Jumlah anggota aktif">{members.filter((m) => m.is_active).length} orang</Info>
            </dl>
            <div data-sheet-item>
              <p className="mb-2 text-[13px] font-semibold text-ink-2">Anggota keluarga</p>
              <ul className="divide-y divide-line rounded-2xl border border-line">
                {members.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 px-3.5 py-3">
                    <Avatar name={m.full_name} size={34} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold">{m.full_name}</span>
                      <span className="block text-[12px] text-muted">{m.family_relationship} · {m.birth_date ? `${age(m.birth_date)} th` : '—'} · {m.occupation}</span>
                    </span>
                    <StatusBadge map={RESIDENT} value={m.resident_status} />
                  </li>
                ))}
                {!members.length ? <li className="px-4 py-6 text-center text-[13px] text-muted">Belum ada anggota terdaftar.</li> : null}
              </ul>
            </div>
            {can(me.role, 'dues.viewAll') ? (
              <div data-sheet-item>
                <p className="mb-2 text-[13px] font-semibold text-ink-2">Tagihan terakhir</p>
                <ul className="space-y-1.5">
                  {inv.map((i) => (
                    <li key={i.id} className="flex items-center justify-between rounded-xl bg-panel/60 px-3.5 py-2.5 text-[13px]">
                      <span><b className="font-semibold">{period(i.period_month, i.period_year)}</b> · {rupiah(i.amount)}</span>
                      <StatusBadge map={INVOICE} value={i.status} />
                    </li>
                  ))}
                  {!inv.length ? <li className="text-[13px] text-muted">Belum ada tagihan.</li> : null}
                </ul>
              </div>
            ) : null}
          </div>
          <div className="flex justify-end gap-2 border-t border-line px-6 py-4">
            <Button variant="secondary" onClick={onClose}>Tutup</Button>
            {can(me.role, 'households.manage') ? <Button onClick={() => onEdit(h)}>Ubah data rumah</Button> : null}
          </div>
        </div>
      ) : null}
    </Sheet>
  );
}

function HouseholdForm({ value, onClose }: { value: Partial<Household> | null; onClose: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<Partial<Household>>({});
  const [key, setKey] = useState<string | null>(null);
  const [err, setErr] = useState('');
  if (value && (value.id ?? 'new') !== key) (setKey(value.id ?? 'new'), setF(value), setErr(''));
  if (!value && key) setKey(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const r = await actions.saveHousehold(f as Household);
    if (!r.ok) return setErr(r.error);
    toast(f.id ? 'Data rumah diperbarui' : `Keluarga ${f.house_number} ditambahkan`);
    onClose();
  };
  return (
    <Sheet open={!!value} onClose={onClose} label="Form keluarga">
      <form onSubmit={submit} className="flex h-full flex-col" noValidate>
        <div className="border-b border-line px-6 py-4">
          <h2 className="text-[18px] font-bold">{f.id ? 'Ubah data rumah' : 'Tambah keluarga'}</h2>
          <p className="text-[13px] text-muted">Tambahkan anggota keluarga dari menu Data Warga.</p>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <Field label="Nomor rumah" required htmlFor="hf-no" hint="Contoh: A-13">
            <Input id="hf-no" value={f.house_number ?? ''} onChange={(e) => setF({ ...f, house_number: e.target.value.toUpperCase() })} autoFocus />
          </Field>
          <Field label="Alamat lengkap" required htmlFor="hf-addr">
            <Input id="hf-addr" value={f.address ?? ''} onChange={(e) => setF({ ...f, address: e.target.value })} />
          </Field>
          <Field label="Nomor KK" htmlFor="hf-kk" hint="16 digit, hanya terlihat oleh Ketua RT & Sekretaris">
            <Input id="hf-kk" inputMode="numeric" maxLength={16} value={f.family_card_number ?? ''} onChange={(e) => setF({ ...f, family_card_number: e.target.value.replace(/\D/g, '') })} />
          </Field>
          <Field label="Status rumah" htmlFor="hf-st">
            <Select id="hf-st" value={f.status ?? 'active'} onChange={(e) => setF({ ...f, status: e.target.value as Household['status'] })}>
              <option value="active">Berpenghuni</option>
              <option value="vacant">Kosong</option>
              <option value="inactive">Nonaktif</option>
            </Select>
          </Field>
          {err ? <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-[13.5px] font-medium text-danger-ink">{err}</p> : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-6 py-4">
          <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
          <Button type="submit">Simpan</Button>
        </div>
      </form>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ Warga */
function MyFamily() {
  const db = useDatabase();
  const me = useMe()!;
  const L = useLookups();
  const ref = useRef<HTMLDivElement>(null);
  usePageEnter(ref);
  const [kk, setKk] = useState(false);
  const h = L.household(me.householdId);
  const members = db.residents.filter((r) => r.household_id === me.householdId);
  if (!h) return <EmptyState icon={BookUser} title="Akun belum terhubung ke data keluarga" text="Hubungi Sekretaris RT untuk menautkan akun Anda." />;
  return (
    <div ref={ref} className="mx-auto max-w-[900px]">
      <PageHeader title="Data Keluarga" description="Data keluarga yang terdaftar di RT. Ajukan perubahan melalui Sekretaris bila ada data yang tidak sesuai." />
      <Card data-card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-4 bg-primary px-5 py-5 text-white sm:px-6">
          <span className="grid size-14 place-items-center rounded-2xl bg-white/15 text-[17px] font-extrabold">{h.house_number}</span>
          <div className="min-w-0 flex-1">
            <p className="text-[18px] font-extrabold">Keluarga {L.headOf(h)?.full_name}</p>
            <p className="text-[13px] text-white/80">{h.address}</p>
          </div>
        </div>
        <dl className="grid gap-4 px-5 py-4 sm:grid-cols-3 sm:px-6">
          <Info label="Nomor KK">
            <span className="font-mono">{kk ? h.family_card_number : maskId(h.family_card_number)}</span>{' '}
            <button onClick={() => setKk((v) => !v)} className="ml-1 text-[12px] font-semibold text-primary">{kk ? 'Sembunyikan' : 'Tampilkan'}</button>
          </Info>
          <Info label="Anggota aktif">{members.filter((m) => m.is_active).length} orang</Info>
          <Info label="RT / RW">{db.neighborhood.rt_number} / {db.neighborhood.rw_number}</Info>
        </dl>
      </Card>
      <Card data-card className="mt-5">
        <CardHeader title="Anggota keluarga" icon={Users} action={<Link to="/surat"><Button size="sm" variant="soft" icon={UserPlus}>Ajukan perubahan</Button></Link>} />
        <ul className="divide-y divide-line">
          {members.map((m) => (
            <li key={m.id} data-row className="flex items-center gap-3 px-5 py-3.5">
              <Avatar name={m.full_name} size={42} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold">{m.full_name}</span>
                <span className="block text-[12.5px] text-muted">{m.family_relationship} · {m.birth_date ? `${age(m.birth_date)} tahun` : '—'} · {m.occupation}</span>
              </span>
              <StatusBadge map={RESIDENT} value={m.resident_status} />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
