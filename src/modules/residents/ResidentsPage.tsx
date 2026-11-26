import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Download, Eye, EyeOff, History, Pencil, Plus, UserRound, Users } from 'lucide-react';
import { Sheet, usePageEnter, useToast, useFlip } from '@/motion';
import { PageHeader, Magnetic } from '@/components/ui/PageHeader';
import { Avatar, Badge, Button, Card, Field, Info, Input, Select, EmptyState, cx } from '@/components/ui/primitives';
import { Tabs } from '@/components/ui/Tabs';
import { Pagination, SearchInput, Td, Th, Toolbar, useList } from '@/components/ui/list';
import { StatusBadge, RESIDENT } from '@/components/ui/status';
import { useDatabase, useLookups, useMe } from '@/hooks/useData';
import { actions } from '@/stores/db.store';
import { can } from '@/app/permissions';
import { age, dateLong, dateTime, maskId } from '@/lib/format';
import { exportXlsx } from '@/services/export.service';
import type { Resident, ResidentStatus } from '@/types/models';

type Filter = 'aktif' | 'tetap' | 'kontrak' | 'pendatang' | 'nonaktif';

export function ResidentsPage() {
  const db = useDatabase();
  const me = useMe()!;
  const L = useLookups();
  const toast = useToast();
  const ref = useRef<HTMLDivElement>(null);
  usePageEnter(ref);

  const manage = can(me.role, 'residents.manage');
  const sensitive = can(me.role, 'residents.viewSensitive');
  const [filter, setFilter] = useState<Filter>('aktif');
  const [reveal, setReveal] = useState(false);
  const [gender, setGender] = useState<'all' | 'L' | 'P'>('all');
  const [editing, setEditing] = useState<Partial<Resident> | null>(null);
  const [viewing, setViewing] = useState<Resident | null>(null);

  const base = useMemo(
    () =>
      db.residents
        .filter((r) => (filter === 'aktif' ? r.is_active : filter === 'nonaktif' ? !r.is_active : r.is_active && r.resident_status === filter))
        .filter((r) => gender === 'all' || r.gender === gender)
        .sort((a, b) => (L.household(a.household_id)?.house_number ?? '').localeCompare(L.household(b.household_id)?.house_number ?? '') || (a.family_relationship === 'Kepala Keluarga' ? -1 : 1)),
    [db, filter, gender, L],
  );
  const list = useList(base, { search: (r) => `${r.full_name} ${L.household(r.household_id)?.house_number} ${r.occupation} ${sensitive ? r.nik : ''}`, pageSize: 12 });
  const tableRef = useRef<HTMLTableSectionElement>(null);
  const capture = useFlip(tableRef, '[data-item]', [filter, gender, list.page]);

  const counts = {
    aktif: db.residents.filter((r) => r.is_active).length,
    tetap: db.residents.filter((r) => r.is_active && r.resident_status === 'tetap').length,
    kontrak: db.residents.filter((r) => r.is_active && r.resident_status === 'kontrak').length,
    pendatang: db.residents.filter((r) => r.is_active && r.resident_status === 'pendatang').length,
    nonaktif: db.residents.filter((r) => !r.is_active).length,
  };

  const doExport = () => {
    exportXlsx(
      `data-warga-rt${db.neighborhood.rt_number}`,
      'Warga',
      base.map((r) => ({
        'Nama lengkap': r.full_name,
        ...(sensitive ? { NIK: r.nik } : {}),
        'No. rumah': L.household(r.household_id)?.house_number,
        'Jenis kelamin': r.gender === 'L' ? 'Laki-laki' : 'Perempuan',
        'Tempat lahir': r.birth_place,
        'Tanggal lahir': r.birth_date,
        Hubungan: r.family_relationship,
        Pekerjaan: r.occupation,
        'No. HP': r.phone,
        Status: RESIDENT[r.resident_status][0],
      })),
    );
    toast(`${base.length} data warga diekspor ke Excel`);
  };

  return (
    <div ref={ref}>
      <PageHeader
        title="Data Warga"
        description={sensitive ? 'Kelola data individu warga. NIK disembunyikan secara bawaan dan hanya ditampilkan saat diperlukan.' : 'Direktori warga RT. NIK dan nomor KK tidak ditampilkan untuk peran Anda.'}
        actions={
          <>
            {can(me.role, 'residents.export') ? <Button variant="secondary" icon={Download} onClick={doExport}>Ekspor Excel</Button> : null}
            {manage ? (
              <Magnetic>
                <Button icon={Plus} onClick={() => setEditing({ household_id: '', gender: 'L', resident_status: 'tetap', family_relationship: 'Anak' })}>Tambah warga</Button>
              </Magnetic>
            ) : null}
          </>
        }
      />

      <Toolbar>
        <Tabs
          label="Filter status warga"
          value={filter}
          onChange={(v) => (capture(), setFilter(v), list.resetPage())}
          tabs={[
            { value: 'aktif', label: 'Semua aktif', count: counts.aktif },
            { value: 'tetap', label: 'Tetap', count: counts.tetap },
            { value: 'kontrak', label: 'Kontrak', count: counts.kontrak },
            { value: 'pendatang', label: 'Pendatang', count: counts.pendatang },
            { value: 'nonaktif', label: 'Pindah/meninggal', count: counts.nonaktif },
          ]}
        />
        <div className="flex flex-1 gap-2.5">
          <SearchInput value={list.q} onChange={list.setQ} placeholder={sensitive ? 'Cari nama, rumah, NIK…' : 'Cari nama atau nomor rumah…'} className="flex-1 sm:min-w-[220px]" />
          <Select aria-label="Jenis kelamin" value={gender} onChange={(e) => (capture(), setGender(e.target.value as 'all'))} className="w-auto min-w-[130px]">
            <option value="all">Semua</option>
            <option value="L">Laki-laki</option>
            <option value="P">Perempuan</option>
          </Select>
        </div>
      </Toolbar>

      <Card data-card className="overflow-hidden">
        {sensitive ? (
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
            <p className="text-[13px] text-muted">
              Menampilkan <b className="text-ink">{list.total}</b> warga
            </p>
            <button onClick={() => setReveal((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-primary hover:bg-primary-soft">
              {reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              {reveal ? 'Sembunyikan NIK' : 'Tampilkan NIK'}
            </button>
          </div>
        ) : null}

        {list.rows.length ? (
          <>
            {/* Desktop */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full">
                <thead className="border-b border-line bg-panel/60">
                  <tr>
                    <Th>Nama</Th>
                    {sensitive ? <Th>NIK</Th> : null}
                    <Th>Rumah</Th>
                    <Th>Hubungan</Th>
                    <Th>Usia</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Aksi</Th>
                  </tr>
                </thead>
                <tbody ref={tableRef} className="divide-y divide-line">
                  {list.rows.map((r) => (
                    <tr key={r.id} data-item data-row className="hover:bg-panel/50">
                      <Td>
                        <button onClick={() => setViewing(r)} className="flex items-center gap-3 text-left">
                          <Avatar name={r.full_name} size={34} />
                          <span>
                            <span className="block font-semibold text-ink hover:text-primary">{r.full_name}</span>
                            <span className="block text-[12.5px] text-muted">{r.occupation}</span>
                          </span>
                        </button>
                      </Td>
                      {sensitive ? <Td className="font-mono text-[13px] text-ink-2">{reveal ? r.nik : maskId(r.nik)}</Td> : null}
                      <Td><span className="font-semibold">{L.household(r.household_id)?.house_number}</span></Td>
                      <Td className="text-ink-2">{r.family_relationship}</Td>
                      <Td className="text-ink-2">{r.birth_date ? `${age(r.birth_date)} th` : '—'}</Td>
                      <Td><StatusBadge map={RESIDENT} value={r.resident_status} /></Td>
                      <Td className="text-right">
                        <div className="inline-flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setViewing(r)}>Detail</Button>
                          {manage ? <Button size="sm" variant="ghost" icon={Pencil} aria-label={`Ubah ${r.full_name}`} onClick={() => setEditing(r)} /> : null}
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile */}
            <ul className="divide-y divide-line md:hidden">
              {list.rows.map((r) => (
                <li key={r.id} data-row>
                  <button onClick={() => setViewing(r)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
                    <Avatar name={r.full_name} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-bold text-ink">{r.full_name}</span>
                      <span className="block truncate text-[12.5px] text-muted">
                        {L.household(r.household_id)?.house_number} · {r.family_relationship}
                        {sensitive ? ` · ${reveal ? r.nik : maskId(r.nik)}` : ''}
                      </span>
                    </span>
                    <StatusBadge map={RESIDENT} value={r.resident_status} />
                  </button>
                </li>
              ))}
            </ul>
            <Pagination {...list} setPage={(n) => (capture(), list.setPage(n))} unit="warga" />
          </>
        ) : (
          <EmptyState icon={Users} title="Tidak ada warga yang cocok" text="Coba ubah kata kunci atau filter status." />
        )}
      </Card>

      <ResidentForm value={editing} onClose={() => setEditing(null)} />
      <ResidentDetail resident={viewing} onClose={() => setViewing(null)} onEdit={(r) => (setViewing(null), setEditing(r))} reveal={sensitive} manage={manage} />
    </div>
  );
}

/* ------------------------------------------------------------------ Form */
const RELATIONS = ['Kepala Keluarga', 'Istri', 'Suami', 'Anak', 'Orang Tua', 'Menantu', 'Cucu', 'Famili Lain'];

function ResidentForm({ value, onClose }: { value: Partial<Resident> | null; onClose: () => void }) {
  const db = useDatabase();
  const toast = useToast();
  const [form, setForm] = useState<Partial<Resident>>({});
  const [err, setErr] = useState('');
  const [lastId, setLastId] = useState<string | undefined>();
  if (value && (value.id ?? 'new') !== lastId) {
    setLastId(value.id ?? 'new');
    setForm(value);
    setErr('');
  }
  if (!value && lastId) setLastId(undefined);

  const set = (k: keyof Resident) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const r = await actions.saveResident(form as Resident);
    if (!r.ok) return setErr(r.error);
    toast(form.id ? 'Data warga diperbarui' : 'Warga baru ditambahkan');
    onClose();
  };

  return (
    <Sheet open={!!value} onClose={onClose} label={form.id ? 'Ubah data warga' : 'Tambah warga'} wide>
      <form onSubmit={submit} className="flex h-full flex-col" noValidate>
        <div className="border-b border-line px-6 py-4">
          <h2 className="text-[18px] font-bold">{form.id ? 'Ubah data warga' : 'Tambah warga'}</h2>
          <p className="text-[13px] text-muted">Perubahan tercatat di riwayat perubahan data.</p>
        </div>
        <div className="grid flex-1 content-start gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
          <Field label="Nama lengkap" required className="sm:col-span-2" htmlFor="rf-name">
            <Input id="rf-name" value={form.full_name ?? ''} onChange={set('full_name')} autoFocus data-sheet-item />
          </Field>
          <Field label="NIK" hint="16 digit, data terbatas" htmlFor="rf-nik">
            <Input id="rf-nik" inputMode="numeric" maxLength={16} value={form.nik ?? ''} onChange={(e) => setForm((f) => ({ ...f, nik: e.target.value.replace(/\D/g, '') }))} />
          </Field>
          <Field label="Keluarga / rumah" required htmlFor="rf-hh">
            <Select id="rf-hh" value={form.household_id ?? ''} onChange={set('household_id')}>
              <option value="">Pilih rumah</option>
              {db.households.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.house_number} — {db.residents.find((r) => r.id === h.head_resident_id)?.full_name ?? 'Kosong'}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Jenis kelamin" htmlFor="rf-g">
            <Select id="rf-g" value={form.gender ?? 'L'} onChange={set('gender')}>
              <option value="L">Laki-laki</option>
              <option value="P">Perempuan</option>
            </Select>
          </Field>
          <Field label="Hubungan keluarga" htmlFor="rf-rel">
            <Select id="rf-rel" value={form.family_relationship ?? 'Anak'} onChange={set('family_relationship')}>
              {RELATIONS.map((r) => <option key={r}>{r}</option>)}
            </Select>
          </Field>
          <Field label="Tempat lahir" htmlFor="rf-bp">
            <Input id="rf-bp" value={form.birth_place ?? ''} onChange={set('birth_place')} />
          </Field>
          <Field label="Tanggal lahir" htmlFor="rf-bd">
            <Input id="rf-bd" type="date" value={form.birth_date ?? ''} onChange={set('birth_date')} />
          </Field>
          <Field label="Pekerjaan" htmlFor="rf-job">
            <Input id="rf-job" value={form.occupation ?? ''} onChange={set('occupation')} />
          </Field>
          <Field label="Nomor HP" htmlFor="rf-hp">
            <Input id="rf-hp" type="tel" inputMode="tel" value={form.phone ?? ''} onChange={set('phone')} placeholder="08…" />
          </Field>
          <Field label="Status domisili" htmlFor="rf-st">
            <Select id="rf-st" value={form.resident_status ?? 'tetap'} onChange={set('resident_status')}>
              {(['tetap', 'kontrak', 'pendatang'] as ResidentStatus[]).map((s) => <option key={s} value={s}>{RESIDENT[s][0]}</option>)}
            </Select>
          </Field>
          <Field label="Tanggal masuk" htmlFor="rf-j">
            <Input id="rf-j" type="date" value={form.joined_at ?? ''} onChange={set('joined_at')} />
          </Field>
          {err ? <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-[13.5px] font-medium text-danger-ink sm:col-span-2">{err}</p> : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-6 py-4">
          <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
          <Button type="submit">{form.id ? 'Simpan perubahan' : 'Tambah warga'}</Button>
        </div>
      </form>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ Detail */
function ResidentDetail({ resident, onClose, onEdit, reveal, manage }: { resident: Resident | null; onClose: () => void; onEdit: (r: Resident) => void; reveal: boolean; manage: boolean }) {
  const db = useDatabase();
  const L = useLookups();
  const toast = useToast();
  const [shown, setShown] = useState<Resident | null>(null);
  const [showNik, setShowNik] = useState(false);
  if (resident && resident !== shown) {
    setShown(resident);
    setShowNik(false);
  }
  const r = shown ? db.residents.find((x) => x.id === shown.id) ?? shown : null;
  const hh = L.household(r?.household_id);
  const history = db.residentHistory.filter((h) => h.resident_id === r?.id);

  return (
    <Sheet open={!!resident} onClose={onClose} label="Detail warga">
      {r ? (
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-4 border-b border-line px-6 py-5">
            <Avatar name={r.full_name} size={56} />
            <div className="min-w-0">
              <h2 className="truncate text-[18px] font-bold">{r.full_name}</h2>
              <p className="text-[13px] text-muted">{r.family_relationship} · Rumah {hh?.house_number}</p>
              <div className="mt-1.5 flex gap-1.5"><StatusBadge map={RESIDENT} value={r.resident_status} />{r.user_id ? <Badge tone="blue">Punya akun</Badge> : null}</div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4" data-sheet-item>
              {reveal ? (
                <div className="col-span-2 flex items-end justify-between rounded-xl border border-line bg-panel/50 p-3">
                  <Info label="NIK (data terbatas)"><span className="font-mono">{showNik ? r.nik : maskId(r.nik)}</span></Info>
                  <button onClick={() => setShowNik((v) => !v)} className="text-[12.5px] font-semibold text-primary">{showNik ? 'Sembunyikan' : 'Tampilkan'}</button>
                </div>
              ) : null}
              <Info label="Jenis kelamin">{r.gender === 'L' ? 'Laki-laki' : 'Perempuan'}</Info>
              <Info label="Tempat, tanggal lahir">{r.birth_place}{r.birth_date ? `, ${dateLong(r.birth_date)}` : ''}</Info>
              <Info label="Usia">{r.birth_date ? `${age(r.birth_date)} tahun` : '—'}</Info>
              <Info label="Pekerjaan">{r.occupation}</Info>
              <Info label="Nomor HP">{r.phone}</Info>
              <Info label="Tanggal masuk">{r.joined_at ? dateLong(r.joined_at) : '—'}</Info>
              <Info label="Alamat" className="col-span-2">{hh?.address}</Info>
              {r.left_at ? <Info label="Tanggal keluar">{dateLong(r.left_at)}</Info> : null}
            </dl>

            {manage ? (
              <div className="mt-6" data-sheet-item>
                <p className="mb-2 text-[13px] font-semibold text-ink-2">Ubah status domisili</p>
                <div className="flex flex-wrap gap-1.5">
                  {(['tetap', 'kontrak', 'pendatang', 'pindah', 'meninggal'] as ResidentStatus[]).map((s) => (
                    <button
                      key={s}
                      onClick={async () => {
                        const res = await actions.setResidentStatus(r.id, s);
                        toast(res.ok ? `Status diubah menjadi ${RESIDENT[s][0]}` : res.error, res.ok ? 'success' : 'error');
                      }}
                      className={cx('h-8 rounded-full border px-3 text-[12.5px] font-semibold', r.resident_status === s ? 'border-primary bg-primary-soft text-primary-soft-ink' : 'border-line text-ink-2 hover:bg-panel')}
                    >
                      {RESIDENT[s][0]}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[12px] text-muted">Warga pindah/meninggal ditandai nonaktif; datanya tidak dihapus.</p>
              </div>
            ) : null}

            {manage ? (
              <div className="mt-6" data-sheet-item>
                <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-ink-2"><History className="size-4" /> Riwayat perubahan</p>
                {history.length ? (
                  <ol className="space-y-2">
                    {history.map((h) => (
                      <li key={h.id} className="rounded-xl border border-line px-3 py-2 text-[13px]">
                        <span className="font-semibold text-ink">{h.summary}</span>
                        <span className="block text-[12px] text-muted">{L.userName(h.changed_by)} · {dateTime(h.created_at)}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-[13px] text-muted">Belum ada perubahan sejak data dibuat.</p>
                )}
              </div>
            ) : null}
          </div>
          <div className="flex justify-end gap-2 border-t border-line px-6 py-4">
            <Button variant="secondary" onClick={onClose}>Tutup</Button>
            {manage ? <Button icon={Pencil} onClick={() => onEdit(r)}>Ubah data</Button> : null}
          </div>
        </div>
      ) : (
        <EmptyState icon={UserRound} title="Memuat…" />
      )}
    </Sheet>
  );
}
