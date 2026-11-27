import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { BookUser, Eye, EyeOff, House, Plus, UserPlus, Users } from 'lucide-react';
import { Sheet, usePageEnter, useToast, useFlip } from '@/motion';
import { PageHeader, Magnetic } from '@/components/ui/PageHeader';
import { Avatar, Badge, Button, Card, CardHeader, Choice, EmptyState, Field, Info, Input, Select, cx } from '@/components/ui/primitives';
import { Tabs } from '@/components/ui/Tabs';
import { SearchInput, Toolbar } from '@/components/ui/list';
import { StatusBadge, RESIDENT, INVOICE } from '@/components/ui/status';
import { useDatabase, useLookups, useMe } from '@/hooks/useData';
import { actions } from '@/stores/db.store';
import { can } from '@/app/permissions';
import { age, maskId, period, rupiah } from '@/lib/format';
import type { House as HouseT, Household } from '@/types/models';

export function HouseholdsPage() {
  const me = useMe()!;
  return can(me.role, 'households.view') ? <AdminHouseholds /> : <MyFamily />;
}

const HOUSE_STATUS: Record<HouseT['status'], string> = { occupied: 'Berpenghuni', vacant: 'Kosong', inactive: 'Nonaktif' };
/** Blok dari nomor rumah: "A-13" → "A". Nomor tanpa huruf depan tidak berblok. */
const blockOf = (no: string) => /^([A-Za-z]+)[-\s]?\d/.exec(no)?.[1].toUpperCase() ?? null;

/** KK di sebuah rumah: penanggung jawab iuran dulu, lalu yang aktif, lalu urutan daftar. */
function useHouseFamilies() {
  const db = useDatabase();
  return useMemo(() => {
    const map = new Map<string, Household[]>();
    for (const h of db.households) map.set(h.house_id, [...(map.get(h.house_id) ?? []), h]);
    return (o: HouseT) =>
      (map.get(o.id) ?? []).slice().sort((a, b) =>
        Number(b.id === o.billing_household_id) - Number(a.id === o.billing_household_id)
        || Number(a.status !== 'active') - Number(b.status !== 'active')
        || a.created_at.localeCompare(b.created_at));
  }, [db]);
}

/* ------------------------------------------------------------------ Admin */
function AdminHouseholds() {
  const db = useDatabase();
  const me = useMe()!;
  const L = useLookups();
  const familiesOf = useHouseFamilies();
  const ref = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLUListElement>(null);
  usePageEnter(ref);
  const [block, setBlock] = useState('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<HouseT | null>(null);
  const [houseForm, setHouseForm] = useState<Partial<HouseT> | null>(null);
  const [kkForm, setKkForm] = useState<(Partial<Household> & { house_id: string }) | null>(null);
  const capture = useFlip(grid, '[data-item]', [block, q]);
  const manage = can(me.role, 'households.manage');

  const rows = useMemo(
    () =>
      db.houses.map((o) => {
        const kks = familiesOf(o);
        const ids = new Set(kks.map((k) => k.id));
        const members = db.residents.filter((r) => ids.has(r.household_id) && r.is_active);
        const unpaid = db.invoices.filter((i) => ids.has(i.household_id) && (i.status === 'unpaid' || i.status === 'partial'));
        const lead = kks.find((k) => k.status === 'active') ?? kks[0];
        return { o, kks, activeKks: kks.filter((k) => k.status === 'active'), members, head: L.headOf(lead), unpaid };
      }),
    [db, L, familiesOf],
  );
  const blocks = useMemo(() => [...new Set(db.houses.map((o) => blockOf(o.house_number)).filter(Boolean) as string[])].sort(), [db.houses]);
  const match = (r: (typeof rows)[number]) =>
    (block === 'all' || blockOf(r.o.house_number) === block) &&
    (!q.trim() || `${r.o.house_number} ${r.o.address} ${r.kks.map((k) => L.headOf(k)?.full_name ?? '').join(' ')}`.toLowerCase().includes(q.toLowerCase()));

  const occupied = db.houses.filter((o) => o.status === 'occupied').length;
  const activeKk = db.households.filter((h) => h.status === 'active').length;

  return (
    <div ref={ref}>
      <PageHeader
        title="Data Keluarga"
        description={`${occupied} rumah berpenghuni dari ${db.houses.length} rumah · ${activeKk} KK aktif di ${db.neighborhood.name}.`}
        actions={manage ? <Magnetic><Button icon={Plus} onClick={() => setHouseForm({ house_number: '', address: db.neighborhood.address ?? '' })}>Tambah rumah</Button></Magnetic> : null}
      />
      <Toolbar>
        {blocks.length > 1 ? (
          <Tabs
            label="Blok"
            value={block}
            onChange={(v) => (capture(), setBlock(v))}
            tabs={[{ value: 'all', label: 'Semua blok' }, ...blocks.map((b) => ({ value: b, label: `Blok ${b}` }))]}
          />
        ) : null}
        <SearchInput value={q} onChange={(v) => (capture(), setQ(v))} placeholder="Cari nomor rumah atau kepala keluarga…" className="flex-1 sm:min-w-[260px]" />
      </Toolbar>

      <ul ref={grid} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {rows.map((r) => (
          <li key={r.o.id} data-item data-card hidden={!match(r)}>
            <button onClick={() => setOpen(r.o)} className="card-lift flex h-full w-full flex-col rounded-[18px] border border-line bg-card p-4 text-left shadow-sm hover:border-primary/40">
              <div className="flex items-start justify-between gap-2">
                <span className="flex min-w-0 items-center gap-3">
                  <span className={cx('grid size-12 shrink-0 place-items-center rounded-2xl text-[15px] font-extrabold', r.o.status === 'occupied' ? 'bg-primary-soft text-primary-soft-ink' : 'bg-panel-2 text-muted')}>
                    {r.o.house_number}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-bold text-ink">{r.head?.full_name ?? (r.kks.length ? 'Kepala keluarga belum diisi' : 'Rumah kosong')}</span>
                    <span className="block truncate text-[12.5px] text-muted">{r.o.address.split(',')[0]}</span>
                  </span>
                </span>
                {r.activeKks.length > 1 ? <Badge tone="blue">{r.activeKks.length} KK</Badge> : null}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="flex -space-x-2">
                  {r.members.slice(0, 4).map((m) => <Avatar key={m.id} name={m.full_name} size={28} className="ring-2 ring-card" />)}
                  {r.members.length > 4 ? <span className="grid size-7 place-items-center rounded-full bg-panel-2 text-[11px] font-bold text-ink-2 ring-2 ring-card">+{r.members.length - 4}</span> : null}
                </span>
                {r.o.status !== 'occupied' ? (
                  <Badge tone="gray">{HOUSE_STATUS[r.o.status]}</Badge>
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
      {!rows.some(match) ? (
        db.houses.length ? (
          <EmptyState icon={House} title="Rumah tidak ditemukan" text="Periksa kembali nomor rumah atau nama kepala keluarga." />
        ) : (
          <EmptyState icon={House} title="Belum ada rumah terdaftar" text="Tambahkan rumah, lalu isi KK dan anggota keluarganya." />
        )
      ) : null}

      <HouseDetail
        house={open}
        onClose={() => setOpen(null)}
        onEditHouse={(o) => (setOpen(null), setHouseForm(o))}
        onEditKk={(k) => (setOpen(null), setKkForm(k))}
      />
      <HouseForm value={houseForm} onClose={() => setHouseForm(null)} />
      <KkForm value={kkForm} onClose={() => setKkForm(null)} />
    </div>
  );
}

function HouseDetail({ house, onClose, onEditHouse, onEditKk }: {
  house: HouseT | null; onClose: () => void; onEditHouse: (o: HouseT) => void; onEditKk: (k: Partial<Household> & { house_id: string }) => void;
}) {
  const db = useDatabase();
  const me = useMe()!;
  const L = useLookups();
  const toast = useToast();
  const familiesOf = useHouseFamilies();
  const [shown, setShown] = useState<HouseT | null>(null);
  const [reveal, setReveal] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  if (house && house !== shown) (setShown(house), setReveal(null));
  const o = shown ? db.houses.find((x) => x.id === shown.id) ?? shown : null;
  const kks = o ? familiesOf(o) : [];
  const ids = new Set(kks.map((k) => k.id));
  const inv = db.invoices.filter((i) => ids.has(i.household_id) && i.status !== 'cancelled').slice(-5).reverse();
  const sensitive = can(me.role, 'residents.viewSensitive');
  const manage = can(me.role, 'households.manage');
  const activeMembers = db.residents.filter((r) => ids.has(r.household_id) && r.is_active).length;

  const makeBilling = async (k: Household) => {
    if (!o) return;
    setBusy(k.id);
    const r = await actions.setHouseBilling(o.id, k.id);
    setBusy(null);
    toast(r.ok ? `Iuran rumah ${o.house_number} kini ditagihkan ke KK ${L.headOf(k)?.full_name ?? 'ini'}` : r.error, r.ok ? 'success' : 'error');
  };

  return (
    <Sheet open={!!house} onClose={onClose} label="Detail rumah" wide>
      {o ? (
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-4 border-b border-line px-6 py-5">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary text-[17px] font-extrabold text-white">{o.house_number}</span>
            <div className="min-w-0">
              <h2 className="truncate text-[18px] font-bold">Rumah {o.house_number}</h2>
              <p className="truncate text-[13px] text-muted">{o.address}</p>
            </div>
          </div>
          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3" data-sheet-item>
              <Info label="Status rumah">{HOUSE_STATUS[o.status]}</Info>
              <Info label="Kartu Keluarga">{kks.filter((k) => k.status === 'active').length} KK aktif</Info>
              <Info label="Penghuni aktif">{activeMembers} orang</Info>
            </dl>

            <div data-sheet-item>
              <div className="mb-2 flex items-end justify-between gap-3">
                <p className="text-[13px] font-semibold text-ink-2">KK di rumah ini</p>
                {manage ? <Button size="sm" variant="soft" icon={Plus} onClick={() => onEditKk({ house_id: o.id, family_card_number: '' })}>Tambah KK</Button> : null}
              </div>
              {kks.length > 1 ? (
                <p className="mb-3 text-[12.5px] text-muted">Setiap KK punya data, tagihan, dan surat sendiri. Warga hanya melihat KK-nya sendiri.</p>
              ) : null}
              <ul className="space-y-3">
                {kks.map((k) => {
                  const members = db.residents.filter((r) => r.household_id === k.id);
                  const billing = k.id === o.billing_household_id;
                  return (
                    <li key={k.id} className={cx('rounded-2xl border', billing ? 'border-primary/40' : 'border-line')}>
                      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-3.5 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-[14.5px] font-bold">KK {L.headOf(k)?.full_name ?? 'tanpa kepala keluarga'}</p>
                          <p className="mt-0.5 flex items-center gap-2 text-[12.5px] text-muted">
                            <span className="font-mono">{sensitive && reveal === k.id ? k.family_card_number || '—' : k.family_card_number ? maskId(k.family_card_number) : 'No. KK belum diisi'}</span>
                            {sensitive && k.family_card_number ? (
                              <button onClick={() => setReveal((v) => (v === k.id ? null : k.id))} className="inline-flex items-center gap-1 font-semibold text-primary" aria-label={reveal === k.id ? 'Sembunyikan nomor KK' : 'Tampilkan nomor KK'}>
                                {reveal === k.id ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                              </button>
                            ) : null}
                          </p>
                        </div>
                        <span className="flex flex-wrap items-center gap-1.5">
                          {billing ? <Badge tone="blue">Penanggung jawab iuran rumah</Badge> : null}
                          {k.status === 'inactive' ? <Badge tone="gray">Nonaktif</Badge> : null}
                        </span>
                      </div>
                      <ul className="divide-y divide-line">
                        {members.map((m) => (
                          <li key={m.id} className="flex items-center gap-3 px-3.5 py-2.5">
                            <Avatar name={m.full_name} size={32} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[14px] font-semibold">{m.full_name}</span>
                              <span className="block text-[12px] text-muted">{m.family_relationship ?? '—'} · {m.birth_date ? `${age(m.birth_date)} th` : '—'}{m.occupation ? ` · ${m.occupation}` : ''}</span>
                            </span>
                            <StatusBadge map={RESIDENT} value={m.resident_status} />
                          </li>
                        ))}
                        {!members.length ? <li className="px-4 py-4 text-center text-[13px] text-muted">Belum ada anggota. Tambahkan dari menu Data Warga.</li> : null}
                      </ul>
                      {manage ? (
                        <div className="flex flex-wrap justify-end gap-2 border-t border-line px-3.5 py-2.5">
                          {!billing && k.status === 'active' ? (
                            <Button size="sm" variant="ghost" loading={busy === k.id} onClick={() => makeBilling(k)}>Jadikan penanggung jawab iuran</Button>
                          ) : null}
                          <Button size="sm" variant="secondary" onClick={() => onEditKk(k)}>Ubah KK</Button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
                {!kks.length ? <li className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-[13px] text-muted">Rumah ini belum dihuni KK mana pun.</li> : null}
              </ul>
            </div>

            {can(me.role, 'dues.viewAll') ? (
              <div data-sheet-item>
                <p className="mb-2 text-[13px] font-semibold text-ink-2">Tagihan terakhir</p>
                <ul className="space-y-1.5">
                  {inv.map((i) => (
                    <li key={i.id} className="flex items-center justify-between gap-3 rounded-xl bg-panel/60 px-3.5 py-2.5 text-[13px]">
                      <span className="min-w-0">
                        <b className="font-semibold">{L.duesType(i.dues_type_id)?.name ?? 'Iuran'}</b> {period(i.period_month, i.period_year)} · {rupiah(i.amount)}
                        {kks.length > 1 && !i.house_id ? <span className="block truncate text-[12px] text-muted">KK {L.headOf(L.household(i.household_id))?.full_name ?? '—'}</span> : null}
                      </span>
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
            {manage ? <Button onClick={() => onEditHouse(o)}>Ubah data rumah</Button> : null}
          </div>
        </div>
      ) : null}
    </Sheet>
  );
}

function HouseForm({ value, onClose }: { value: Partial<HouseT> | null; onClose: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<Partial<HouseT>>({});
  const [withKk, setWithKk] = useState<'kk' | 'vacant'>('kk');
  const [kk, setKk] = useState('');
  const [key, setKey] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (value && (value.id ?? 'new') !== key) (setKey(value.id ?? 'new'), setF(value), setWithKk('kk'), setKk(''), setErr(''));
  if (!value && key) setKey(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await actions.saveHouse({ ...f, house_number: f.house_number ?? '', address: f.address ?? '', with_family: !f.id && withKk === 'kk', first_family_card: kk });
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    toast(f.id ? 'Data rumah diperbarui' : withKk === 'kk' ? `Rumah ${f.house_number} & KK pertamanya ditambahkan. Isi anggotanya di menu Data Warga.` : `Rumah ${f.house_number} ditambahkan`);
    onClose();
  };
  return (
    <Sheet open={!!value} onClose={onClose} label="Form rumah">
      <form onSubmit={submit} className="flex h-full flex-col" noValidate>
        <div className="border-b border-line px-6 py-4">
          <h2 className="text-[18px] font-bold">{f.id ? 'Ubah data rumah' : 'Tambah rumah'}</h2>
          <p className="text-[13px] text-muted">{f.id ? 'Nomor & alamat baru ikut berlaku untuk semua KK di rumah ini.' : 'Satu rumah bisa dihuni beberapa KK. KK berikutnya ditambahkan dari detail rumah.'}</p>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <Field label="Nomor rumah" required htmlFor="hf-no" hint="Contoh: 23 atau A-13">
            <Input id="hf-no" value={f.house_number ?? ''} onChange={(e) => setF({ ...f, house_number: e.target.value.toUpperCase() })} autoFocus />
          </Field>
          <Field label="Alamat lengkap" required htmlFor="hf-addr">
            <Input id="hf-addr" value={f.address ?? ''} onChange={(e) => setF({ ...f, address: e.target.value })} />
          </Field>
          {f.id ? (
            <Field label="Status rumah" htmlFor="hf-st">
              <Select id="hf-st" value={f.status ?? 'occupied'} onChange={(e) => setF({ ...f, status: e.target.value as HouseT['status'] })}>
                <option value="occupied">Berpenghuni</option>
                <option value="vacant">Kosong</option>
                <option value="inactive">Nonaktif</option>
              </Select>
            </Field>
          ) : (
            <>
              <Field label="Penghuni">
                <Choice name="Penghuni" value={withKk} onChange={setWithKk} options={[{ value: 'kk', label: 'Ada KK' }, { value: 'vacant', label: 'Rumah kosong' }]} />
              </Field>
              {withKk === 'kk' ? (
                <Field label="Nomor KK pertama" htmlFor="hf-kk" hint="16 digit, boleh diisi nanti. Hanya terlihat oleh Ketua RT & Sekretaris">
                  <Input id="hf-kk" inputMode="numeric" maxLength={16} value={kk} onChange={(e) => setKk(e.target.value.replace(/\D/g, ''))} />
                </Field>
              ) : null}
            </>
          )}
          {err ? <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-[13.5px] font-medium text-danger-ink">{err}</p> : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-6 py-4">
          <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
          <Button type="submit" loading={busy}>Simpan</Button>
        </div>
      </form>
    </Sheet>
  );
}

function KkForm({ value, onClose }: { value: (Partial<Household> & { house_id: string }) | null; onClose: () => void }) {
  const db = useDatabase();
  const toast = useToast();
  const [f, setF] = useState<Partial<Household> & { house_id: string }>({ house_id: '' });
  const [key, setKey] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (value && (value.id ?? `new-${value.house_id}`) !== key) (setKey(value.id ?? `new-${value.house_id}`), setF(value), setErr(''));
  if (!value && key) setKey(null);
  const house = db.houses.find((o) => o.id === f.house_id);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await actions.saveHousehold(f);
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    toast(f.id ? 'Data KK diperbarui' : `KK baru ditambahkan di rumah ${house?.house_number}. Isi anggotanya di menu Data Warga.`);
    onClose();
  };
  return (
    <Sheet open={!!value} onClose={onClose} label="Form Kartu Keluarga">
      <form onSubmit={submit} className="flex h-full flex-col" noValidate>
        <div className="border-b border-line px-6 py-4">
          <h2 className="text-[18px] font-bold">{f.id ? 'Ubah Kartu Keluarga' : `Tambah KK di rumah ${house?.house_number ?? ''}`}</h2>
          <p className="text-[13px] text-muted">Anggota keluarga ditambahkan dari menu Data Warga.</p>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <Field label="Rumah" required htmlFor="kf-house" hint={f.id ? 'Ganti bila KK ini pindah ke rumah lain di RT.' : undefined}>
            <Select id="kf-house" value={f.house_id} onChange={(e) => setF({ ...f, house_id: e.target.value })}>
              {db.houses.map((o) => <option key={o.id} value={o.id}>{o.house_number} · {o.address.split(',')[0]}</option>)}
            </Select>
          </Field>
          <Field label="Nomor KK" htmlFor="kf-kk" hint="16 digit, hanya terlihat oleh Ketua RT & Sekretaris">
            <Input id="kf-kk" inputMode="numeric" maxLength={16} value={f.family_card_number ?? ''} onChange={(e) => setF({ ...f, family_card_number: e.target.value.replace(/\D/g, '') })} autoFocus={!f.id} />
          </Field>
          {f.id ? (
            <Field label="Status KK" hint="KK nonaktif tidak ditagih iuran lagi.">
              <Choice name="Status KK" value={f.status ?? 'active'} onChange={(v) => setF({ ...f, status: v })} options={[{ value: 'active', label: 'Aktif' }, { value: 'inactive', label: 'Nonaktif' }]} />
            </Field>
          ) : null}
          {err ? <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-[13.5px] font-medium text-danger-ink">{err}</p> : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-6 py-4">
          <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
          <Button type="submit" loading={busy}>Simpan</Button>
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
