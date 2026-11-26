/**
 * Data CONTOH untuk mode demo. Semua nama, NIK, nomor KK, nominal, dan kejadian
 * di file ini fiktif (dibuat acak deterministik) — bukan data warga sungguhan.
 */
import type {
  Activity, ActivityParticipant, Announcement, AnnouncementRead, AuditLog, CashTransaction, Complaint,
  Database, GuestLog, Household, Invoice, LetterRequest, Membership, Notification, Payment, PatrolReport,
  PatrolSchedule, PatrolTeam, Profile, Resident, SecurityIncident,
} from '@/types/models';
import { jakartaParts, pad, ROMAN } from '@/lib/format';

export const DB_VERSION = 3;

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MALE = ['Agus', 'Bambang', 'Hendra', 'Rudi', 'Joko', 'Eko', 'Wahyu', 'Fajar', 'Rizky', 'Dimas', 'Yusuf', 'Arif', 'Taufik', 'Imam', 'Slamet', 'Hadi', 'Gilang', 'Bayu', 'Teguh', 'Iwan', 'Doni', 'Ridwan', 'Sigit', 'Heri', 'Aditya', 'Farhan', 'Rafi', 'Naufal'];
const FEMALE = ['Sri', 'Dewi', 'Rina', 'Wati', 'Lestari', 'Fitri', 'Indah', 'Ayu', 'Nur', 'Yuni', 'Ratna', 'Maya', 'Putri', 'Siska', 'Mega', 'Lina', 'Endang', 'Tuti', 'Nanda', 'Citra', 'Aisyah', 'Salsabila', 'Zahra', 'Kirana'];
const LAST = ['Santoso', 'Pratama', 'Wijaya', 'Saputra', 'Hidayat', 'Nugroho', 'Setiawan', 'Kurniawan', 'Hartono', 'Gunawan', 'Susanto', 'Purnomo', 'Firmansyah', 'Ramadhan', 'Siregar', 'Nasution', 'Lubis', 'Simanjuntak', 'Wibowo', 'Hakim', 'Maulana', 'Permana', 'Syahputra', 'Halim'];
const JOBS_ADULT = ['Karyawan Swasta', 'PNS', 'Wiraswasta', 'Guru', 'Pedagang', 'Driver Online', 'Perawat', 'Buruh Pabrik', 'Pensiunan', 'TNI/Polri', 'Dosen', 'Teknisi'];
const PLACES = ['Tangerang', 'Jakarta', 'Bandung', 'Serang', 'Bogor', 'Semarang', 'Yogyakarta', 'Medan', 'Palembang', 'Surabaya', 'Cirebon', 'Lampung'];

export function buildSeed(): Database {
  const r = rng(20261126);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)]!;
  const between = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));

  const now = new Date();
  const { year: Y, month: M } = jakartaParts(now);
  const DAY = 86400000;
  const iso = (d: Date) => d.toISOString();
  const ago = (days: number, hour = 10, min = 0) => {
    const d = new Date(now.getTime() - days * DAY);
    const p = jakartaParts(d);
    return new Date(`${p.year}-${pad(p.month, 2)}-${pad(p.day, 2)}T${pad(hour, 2)}:${pad(min, 2)}:00+07:00`).toISOString();
  };
  const dateOnly = (days: number) => {
    const p = jakartaParts(new Date(now.getTime() - days * DAY));
    return `${p.year}-${pad(p.month, 2)}-${pad(p.day, 2)}`;
  };
  const monthShift = (k: number) => {
    let m = M + k, y = Y;
    while (m < 1) { m += 12; y--; }
    while (m > 12) { m -= 12; y++; }
    return { m, y };
  };
  const ymd = (y: number, m: number, d: number) => `${y}-${pad(m, 2)}-${pad(d, 2)}`;

  // ---------------- Neighborhood -----------------
  const neighborhood = {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Perumahan Griya Asri',
    rt_number: '001',
    rw_number: '001',
    village: 'Sukamaju',
    district: 'Cibodas',
    city: 'Kota Tangerang',
    province: 'Banten',
    postal_code: '15138',
    address: 'Jl. Melati Raya, Perumahan Griya Asri',
    bank_name: 'Bank BRI',
    bank_account_name: 'Kas RT 001 Griya Asri',
    bank_account_number: '0123-01-000456-50-1',
  };

  // ---------------- Households & residents -----------------
  const streets: Record<string, string> = { A: 'Jl. Melati', B: 'Jl. Kenanga', C: 'Jl. Anggrek' };
  const households: Household[] = [];
  const residents: Resident[] = [];
  let nikSeq = 1;
  const nik = (birth: string, g: 'L' | 'P') => {
    const [yy, mm, dd] = [birth.slice(2, 4), birth.slice(5, 7), Number(birth.slice(8, 10)) + (g === 'P' ? 40 : 0)];
    return `367104${pad(dd, 2)}${mm}${yy}${pad(nikSeq++, 4)}`;
  };
  const birth = (ageMin: number, ageMax: number) => ymd(Y - between(ageMin, ageMax), between(1, 12), between(1, 28));

  type Spec = { head: [string, 'L' | 'P']; spouse?: [string, 'L' | 'P']; kids?: number; userFor?: 'head' | 'spouse'; userId?: string };
  const special: Record<string, Spec> = {
    'A-01': { head: ['Budi Santoso', 'L'], spouse: ['Rina Marlina', 'P'], kids: 2, userFor: 'head', userId: 'u-ketua' },
    'A-05': { head: ['Hendra Pratama', 'L'], spouse: ['Siti Rahmawati', 'P'], kids: 1, userFor: 'spouse', userId: 'u-sekre' },
    'B-03': { head: ['Andi Wijaya', 'L'], spouse: ['Maya Anggraini', 'P'], kids: 2, userFor: 'head', userId: 'u-bend' },
    'B-07': { head: ['Rudi Hartono', 'L'], spouse: ['Ani Lestari', 'P'], kids: 2, userFor: 'spouse', userId: 'u-warga' },
    'B-10': { head: ['Dedi Kurniawan', 'L'], spouse: ['Fitri Handayani', 'P'], kids: 3, userFor: 'head', userId: 'u-peng' },
    'C-02': { head: ['Joko Susilo', 'L'], spouse: ['Endang Wahyuni', 'P'], kids: 1, userFor: 'head', userId: 'u-joko' },
    'C-04': { head: ['Sari Wulandari', 'P'], kids: 2, userFor: 'head', userId: 'u-sari' },
  };

  for (const block of ['A', 'B', 'C']) {
    for (let n = 1; n <= 12; n++) {
      const house = `${block}-${pad(n, 2)}`;
      const hid = `hh-${house}`;
      const vacant = house === 'C-11' || house === 'C-12';
      households.push({
        id: hid,
        house_number: house,
        address: `${streets[block]} No. ${n}, Griya Asri`,
        head_resident_id: null,
        family_card_number: `3671042${between(100, 999)}${pad(between(1, 9999), 4)}${between(10, 99)}`.slice(0, 16),
        status: vacant ? 'vacant' : 'active',
        created_at: ago(between(400, 900)),
      });
      if (vacant) continue;

      const sp = special[house];
      const last = sp ? sp.head[0].split(' ').slice(-1)[0]! : pick(LAST);
      const headGender: 'L' | 'P' = sp ? sp.head[1] : r() < 0.88 ? 'L' : 'P';
      const headName = sp ? sp.head[0] : `${pick(headGender === 'L' ? MALE : FEMALE)} ${last}`;
      const status = r() < 0.78 ? 'tetap' : r() < 0.7 ? 'kontrak' : 'pendatang';
      const joined = ymd(Y - between(1, 14), between(1, 12), between(1, 28));
      const add = (name: string, g: 'L' | 'P', rel: string, b: string, job: string, user: string | null) => {
        const id = `rs-${residents.length + 1}`;
        residents.push({
          id, household_id: hid, user_id: user, nik: nik(b, g), full_name: name, gender: g,
          birth_place: pick(PLACES), birth_date: b, family_relationship: rel, occupation: job,
          phone: rel === 'Kepala Keluarga' || rel === 'Istri' || rel === 'Suami' ? `08${between(11, 59)}${between(1000, 9999)}${between(1000, 9999)}` : '',
          resident_status: status as Resident['resident_status'], is_active: true, joined_at: joined, left_at: null,
          created_at: ago(between(100, 600)),
        });
        return id;
      };
      const headId = add(headName, headGender, 'Kepala Keluarga', birth(30, 64), pick(JOBS_ADULT), sp?.userFor === 'head' ? sp.userId! : null);
      households[households.length - 1]!.head_resident_id = headId;

      const hasSpouse = sp ? !!sp.spouse : r() < 0.85 && headGender === 'L';
      if (hasSpouse) {
        const sg: 'L' | 'P' = headGender === 'L' ? 'P' : 'L';
        const sname = sp?.spouse ? sp.spouse[0] : `${pick(sg === 'P' ? FEMALE : MALE)} ${pick(LAST)}`;
        add(sname, sg, sg === 'P' ? 'Istri' : 'Suami', birth(27, 60), r() < 0.45 ? 'Ibu Rumah Tangga' : pick(JOBS_ADULT), sp?.userFor === 'spouse' ? sp.userId! : null);
      }
      const kids = sp?.kids ?? between(0, 3);
      for (let k = 0; k < kids; k++) {
        const g: 'L' | 'P' = r() < 0.5 ? 'L' : 'P';
        const a = between(1, 24);
        add(`${pick(g === 'L' ? MALE : FEMALE)} ${last}`, g, 'Anak', ymd(Y - a, between(1, 12), between(1, 28)),
          a < 6 ? 'Belum Sekolah' : a < 18 ? 'Pelajar' : a < 23 ? 'Mahasiswa' : pick(JOBS_ADULT), null);
      }
      if (!sp && r() < 0.12) add(`${pick(r() < 0.5 ? MALE : FEMALE)} ${last}`, r() < 0.5 ? 'L' : 'P', 'Orang Tua', birth(66, 82), 'Pensiunan', null);
    }
  }
  // Satu warga pindah (riwayat tetap tersimpan)
  const moved = residents.find((x) => x.family_relationship === 'Anak' && x.occupation === 'Mahasiswa');
  if (moved) { moved.resident_status = 'pindah'; moved.is_active = false; moved.left_at = dateOnly(40); }

  const resByUser = (u: string) => residents.find((x) => x.user_id === u)!;

  // ---------------- Profiles & memberships -----------------
  const prof = (id: string, role: Membership['role'], active = true): [Profile, Membership] => {
    const res = resByUser(id);
    return [
      { id, full_name: res.full_name, phone: res.phone, email: `${res.full_name.split(' ')[0]!.toLowerCase()}@contoh.wargaku.id`, is_active: active, created_at: ago(300) },
      { id: `m-${id}`, user_id: id, role, resident_id: res.id, is_active: active },
    ];
  };
  const pm = [
    prof('u-ketua', 'ketua_rt'), prof('u-sekre', 'sekretaris'), prof('u-bend', 'bendahara'),
    prof('u-peng', 'pengurus'), prof('u-warga', 'warga'), prof('u-joko', 'warga'), prof('u-sari', 'warga', false),
  ];
  const profiles = pm.map((x) => x[0]);
  const memberships = pm.map((x) => x[1]);

  // ---------------- Letters -----------------
  const letterTypes = [
    { id: 'lt-sp', code: 'SP', name: 'Surat Pengantar', description: 'Pengantar ke kelurahan, kecamatan, atau instansi lain', is_active: true },
    { id: 'lt-skd', code: 'SKD', name: 'Surat Keterangan Domisili', description: 'Menerangkan alamat tempat tinggal warga', is_active: true },
    { id: 'lt-sku', code: 'SKU', name: 'Surat Keterangan Usaha', description: 'Menerangkan warga memiliki usaha di lingkungan RT', is_active: true },
    { id: 'lt-sktm', code: 'SKTM', name: 'Surat Keterangan Tidak Mampu', description: 'Untuk pengajuan keringanan biaya sekolah/kesehatan', is_active: true },
  ];
  const someone = (i: number) => residents.filter((x) => x.family_relationship === 'Kepala Keluarga')[i]!;
  let letterNo = 0;
  const mkLetter = (o: Partial<LetterRequest> & { resident_id: string; letter_type_id: string; purpose: string; status: LetterRequest['status']; days: number }): LetterRequest => {
    const created = ago(o.days, between(8, 20), between(0, 59));
    const hist: LetterRequest['history'] = [{ status: 'submitted', note: null, by: o.created_by ?? 'u-warga', at: created }];
    let letter_number: string | null = null;
    if (['review', 'approved', 'completed', 'rejected', 'revision'].includes(o.status)) {
      hist.push({ status: o.status === 'revision' ? 'revision' : 'review', note: o.status === 'revision' ? o.review_note ?? null : 'Berkas lengkap', by: 'u-sekre', at: ago(o.days - 0.3) });
    }
    if (o.status === 'approved' || o.status === 'completed') {
      letterNo++;
      const d = new Date(new Date(created).getTime() + DAY);
      const p = jakartaParts(d);
      letter_number = `${pad(letterNo)}/RT.001/${ROMAN[p.month - 1]}/${p.year}`;
      hist.push({ status: 'approved', note: letter_number, by: 'u-ketua', at: iso(d) });
    }
    if (o.status === 'rejected') hist.push({ status: 'rejected', note: o.rejection_reason ?? null, by: 'u-ketua', at: ago(o.days - 1) });
    return {
      id: `lr-${letterNo}-${o.days}`, request_number: '', form_data: {}, reviewed_by: hist.length > 1 ? 'u-sekre' : null,
      review_note: null, approved_by: letter_number ? 'u-ketua' : null, letter_number, rejection_reason: null,
      created_by: 'u-warga', created_at: created, completed_at: letter_number || o.status === 'rejected' ? hist[hist.length - 1]!.at : null,
      history: hist, ...o,
    } as LetterRequest;
  };
  const ani = resByUser('u-warga');
  const letters: LetterRequest[] = [
    mkLetter({ resident_id: someone(3).id, letter_type_id: 'lt-sp', purpose: 'Pengurusan KTP elektronik di kelurahan', status: 'completed', days: 58, created_by: 'u-ketua' }),
    mkLetter({ resident_id: someone(8).id, letter_type_id: 'lt-skd', purpose: 'Syarat pembukaan rekening bank', status: 'completed', days: 41, created_by: 'u-ketua' }),
    mkLetter({ resident_id: ani.id, letter_type_id: 'lt-sp', purpose: 'Pengantar pembuatan SKCK untuk melamar kerja', status: 'completed', days: 26 }),
    mkLetter({ resident_id: someone(14).id, letter_type_id: 'lt-sku', purpose: 'Pengajuan KUR untuk usaha warung kelontong', status: 'approved', days: 9, created_by: 'u-ketua', form_data: { nama_usaha: 'Warung Berkah', jenis_usaha: 'Kelontong' } }),
    mkLetter({ resident_id: someone(20).id, letter_type_id: 'lt-sktm', purpose: 'Keringanan biaya sekolah anak (SMP)', status: 'review', days: 3, created_by: 'u-ketua' }),
    mkLetter({ resident_id: someone(11).id, letter_type_id: 'lt-skd', purpose: 'Syarat administrasi pindah sekolah anak', status: 'review', days: 2, created_by: 'u-ketua' }),
    mkLetter({ resident_id: ani.id, letter_type_id: 'lt-skd', purpose: 'Persyaratan pendaftaran BPJS Kesehatan', status: 'submitted', days: 0.1 }),
    mkLetter({ resident_id: someone(17).id, letter_type_id: 'lt-sp', purpose: 'Pengurusan akta kelahiran anak kedua', status: 'submitted', days: 1, created_by: 'u-ketua' }),
    mkLetter({ resident_id: someone(24).id, letter_type_id: 'lt-sku', purpose: 'Izin usaha laundry kiloan', status: 'revision', days: 5, created_by: 'u-ketua', review_note: 'Mohon lengkapi alamat lokasi usaha dan lama usaha berjalan.' }),
    mkLetter({ resident_id: someone(6).id, letter_type_id: 'lt-sktm', purpose: 'Keringanan biaya rumah sakit', status: 'rejected', days: 15, created_by: 'u-ketua', rejection_reason: 'Data penghasilan tidak sesuai kriteria; silakan konsultasi langsung dengan Ketua RT.' }),
  ];
  letters.forEach((l, i) => {
    l.id = `lr-${i + 1}`;
    const p = jakartaParts(new Date(l.created_at));
    l.request_number = `REQ/${p.year}${pad(p.month, 2)}/${pad(i + 1, 4)}`;
  });

  // ---------------- Finance -----------------
  const duesTypes = [
    { id: 'dt-kk', name: 'Iuran Kebersihan & Keamanan', description: 'Petugas sampah, honor ronda, penerangan jalan', amount: 50000, billing_period: 'bulanan' as const, is_active: true },
    { id: 'dt-sos', name: 'Iuran Sosial', description: 'Santunan duka & warga sakit', amount: 10000, billing_period: 'bulanan' as const, is_active: true },
    { id: 'dt-hut', name: 'Iuran HUT RI', description: 'Lomba & dekorasi Agustusan', amount: 75000, billing_period: 'insidental' as const, is_active: false },
  ];
  const cashCategories = [
    { id: 'cc-awal', name: 'Saldo Awal', transaction_type: 'income' as const },
    { id: 'cc-iuran', name: 'Iuran Warga', transaction_type: 'income' as const },
    { id: 'cc-donasi', name: 'Donasi', transaction_type: 'income' as const },
    { id: 'cc-bersih', name: 'Kebersihan', transaction_type: 'expense' as const },
    { id: 'cc-aman', name: 'Keamanan', transaction_type: 'expense' as const },
    { id: 'cc-kegiatan', name: 'Kegiatan Warga', transaction_type: 'expense' as const },
    { id: 'cc-sosial', name: 'Sosial', transaction_type: 'expense' as const },
    { id: 'cc-fasilitas', name: 'Perbaikan Fasilitas', transaction_type: 'expense' as const },
    { id: 'cc-adm', name: 'Administrasi', transaction_type: 'expense' as const },
  ];

  const invoices: Invoice[] = [];
  const payments: Payment[] = [];
  const cash: CashTransaction[] = [];
  const counters: Record<string, number> = {};
  const next = (k: string) => (counters[k] = (counters[k] ?? 0) + 1);
  const tx = (o: Omit<CashTransaction, 'id' | 'transaction_number' | 'created_at' | 'reverses_id' | 'recorded_by'> & { recorded_by?: string }) => {
    const y = Number(o.transaction_date.slice(0, 4));
    const n = next(`cash:${y}`);
    cash.push({ id: `tx-${cash.length + 1}`, reverses_id: null, recorded_by: 'u-bend', transaction_number: `KAS/${y}/${pad(n, 5)}`, created_at: o.transaction_date + 'T12:00:00+07:00', ...o });
  };

  const start = monthShift(-3);
  tx({ category_id: 'cc-awal', payment_id: null, transaction_type: 'income', amount: 3250000, transaction_date: ymd(start.y, start.m, 1), description: 'Saldo awal kas (pindahan pembukuan manual)' });

  const active = households.filter((h) => h.status === 'active');
  const plan = [-2, -1, 0];
  for (const k of plan) {
    const { m, y } = monthShift(k);
    const due = ymd(y, m, 10);
    // pengeluaran rutin
    tx({ category_id: 'cc-bersih', payment_id: null, transaction_type: 'expense', amount: 750000, transaction_date: ymd(y, m, 3), description: `Honor petugas sampah ${['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][m - 1]}` });
    tx({ category_id: 'cc-aman', payment_id: null, transaction_type: 'expense', amount: 300000, transaction_date: ymd(y, m, 5), description: 'Kopi, gula & senter untuk pos ronda' });
    tx({ category_id: 'cc-fasilitas', payment_id: null, transaction_type: 'expense', amount: 185000, transaction_date: ymd(y, m, 7), description: 'Token listrik lampu jalan & pos ronda' });

    active.forEach((h, idx) => {
      const n = next(`invoice:${y}`);
      const inv: Invoice = {
        id: `inv-${y}${pad(m, 2)}-${h.house_number}`, household_id: h.id, dues_type_id: 'dt-kk',
        invoice_number: `INV/${y}/${pad(n, 5)}`, period_month: m, period_year: y, amount: 50000, paid_amount: 0,
        status: 'unpaid', due_date: due, created_at: ymd(y, m, 1) + 'T08:00:00+07:00',
      };
      invoices.push(inv);
      const roll = r();
      const isAni = h.house_number === 'B-07';
      let outcome: 'paid' | 'partial' | 'pending' | 'rejected' | 'unpaid';
      if (k === -2) outcome = isAni || roll < 0.92 ? 'paid' : 'unpaid';
      else if (k === -1) outcome = isAni ? 'paid' : roll < 0.8 ? 'paid' : roll < 0.86 ? 'partial' : 'unpaid';
      else outcome = isAni ? 'unpaid' : roll < 0.42 ? 'paid' : roll < 0.6 ? 'pending' : idx === 5 ? 'rejected' : 'unpaid';

      const payDay = Math.min(between(2, 12), 28);
      const pd = ymd(y, m, payDay);
      const payer = residents.find((x) => x.household_id === h.id && x.user_id)?.user_id ?? 'u-bend';
      const method = r() < 0.7 ? 'transfer' : 'tunai';
      const mkPay = (amount: number, status: Payment['status']): Payment => ({
        id: `pay-${payments.length + 1}`, invoice_id: inv.id, household_id: h.id, payer_user_id: payer,
        reference_code: `TRF${y}${pad(m, 2)}${pad(payments.length + 1, 4)}`, amount, payment_method: method,
        proof_name: method === 'transfer' ? `bukti-${pad(payments.length + 1, 4)}.jpg` : null, proof_data: null,
        payment_date: pd, note: method === 'tunai' ? 'Diserahkan ke Bendahara' : '', status,
        verified_by: status === 'pending' ? null : 'u-bend', verified_at: status === 'pending' ? null : pd + 'T19:00:00+07:00',
        rejection_reason: status === 'rejected' ? 'Nominal pada bukti transfer tidak sesuai tagihan (Rp5.000).' : null,
        created_at: pd + 'T09:30:00+07:00',
      });
      if (outcome === 'paid' || outcome === 'partial') {
        const amount = outcome === 'paid' ? 50000 : 25000;
        const p = mkPay(amount, 'verified');
        payments.push(p);
        inv.paid_amount = amount;
        inv.status = outcome === 'paid' ? 'paid' : 'partial';
        tx({ category_id: 'cc-iuran', payment_id: p.id, transaction_type: 'income', amount, transaction_date: pd, description: `Pembayaran ${inv.invoice_number} · ${h.house_number}` });
      } else if (outcome === 'pending') {
        payments.push(mkPay(50000, 'pending'));
      } else if (outcome === 'rejected') {
        payments.push(mkPay(5000, 'rejected'));
      }
    });
  }
  const m1 = monthShift(-1), m2 = monthShift(-2);
  tx({ category_id: 'cc-donasi', payment_id: null, transaction_type: 'income', amount: 1000000, transaction_date: ymd(m1.y, m1.m, 14), description: 'Donasi warga untuk konsumsi kerja bakti' });
  tx({ category_id: 'cc-kegiatan', payment_id: null, transaction_type: 'expense', amount: 465000, transaction_date: ymd(m1.y, m1.m, 18), description: 'Konsumsi kerja bakti bulanan' });
  tx({ category_id: 'cc-sosial', payment_id: null, transaction_type: 'expense', amount: 500000, transaction_date: ymd(m2.y, m2.m, 21), description: 'Santunan duka keluarga warga C-07' });
  tx({ category_id: 'cc-adm', payment_id: null, transaction_type: 'expense', amount: 85000, transaction_date: ymd(m1.y, m1.m, 22), description: 'Kertas, map & cetak kop surat RT' });
  cash.sort((a, b) => a.transaction_date.localeCompare(b.transaction_date));

  counters[`letter:${Y}`] = letterNo;
  counters[`request:${Y}`] = letters.length;

  // ---------------- Announcements -----------------
  // Minggu berikutnya
  const dow = new Date(ago(0)).getUTCDay();
  const nextSunday = ((7 - dow) % 7) || 7;
  const atDay = (days: number, h: number, mi = 0) => ago(-days, h, mi);

  const announcements: Announcement[] = [
    { id: 'an-1', title: 'Kerja Bakti Lingkungan', category: 'kegiatan', status: 'published', is_pinned: true, created_by: 'u-peng', created_at: ago(2, 9), published_at: ago(2, 10),
      content: `Seluruh warga diundang mengikuti kerja bakti membersihkan saluran air dan memangkas pohon di sepanjang Jl. Melati sampai Jl. Anggrek.\n\nWaktu: Minggu, pukul 07.00 WIB\nTitik kumpul: Pos ronda Jl. Melati\nMohon membawa cangkul, sapu lidi, atau karung masing-masing. Konsumsi disediakan dari kas RT.` },
    { id: 'an-2', title: 'Pembayaran Iuran Bulanan', category: 'keuangan', status: 'published', is_pinned: false, created_by: 'u-bend', created_at: ago(5, 8), published_at: ago(5, 9),
      content: `Iuran kebersihan & keamanan bulan ini sebesar Rp50.000 per rumah jatuh tempo tanggal 10.\n\nPembayaran dapat ditransfer ke rekening Kas RT (lihat menu Tagihan) lalu unggah bukti transfernya di aplikasi, atau diserahkan tunai ke Bendahara. Terima kasih atas partisipasinya.` },
    { id: 'an-3', title: 'Jadwal Ronda Malam Bulan Depan', category: 'keamanan', status: 'published', is_pinned: false, created_by: 'u-peng', created_at: ago(7, 19), published_at: ago(7, 20),
      content: 'Jadwal ronda bulan depan sudah tersedia di menu Keamanan. Ronda dimulai pukul 22.00 sampai 04.00 WIB. Warga yang berhalangan mohon bertukar jadwal dengan anggota regu lain dan mengabari ketua regu.' },
    { id: 'an-4', title: 'Pemadaman Listrik Terencana dari PLN', category: 'umum', status: 'published', is_pinned: false, created_by: 'u-sekre', created_at: ago(11, 14), published_at: ago(11, 15),
      content: 'PLN menginformasikan pemadaman bergilir untuk pemeliharaan jaringan pada hari Sabtu pukul 09.00–13.00 WIB. Mohon menyiapkan kebutuhan air dan mencabut perangkat elektronik sensitif.' },
    { id: 'an-5', title: 'Posyandu Balita & Lansia', category: 'kesehatan', status: 'published', is_pinned: false, created_by: 'u-sekre', created_at: ago(14, 10), published_at: ago(14, 10),
      content: 'Posyandu bulanan untuk balita dan lansia dilaksanakan di Balai Warga. Kegiatan meliputi penimbangan, imunisasi, dan cek tekanan darah gratis. Bawa buku KIA bagi yang memiliki balita.' },
    { id: 'an-6', title: 'Rencana Perbaikan Saluran Air Jl. Kenanga', category: 'pembangunan', status: 'draft', is_pinned: false, created_by: 'u-peng', created_at: ago(1, 16), published_at: null,
      content: 'Draft: pengurus mengusulkan perbaikan saluran air di depan B-05 s.d. B-09 yang sering meluap saat hujan deras. Perkiraan biaya dan jadwal akan dibahas pada rapat warga.' },
  ];
  const announcementReads: AnnouncementRead[] = [
    { announcement_id: 'an-2', user_id: 'u-warga', read_at: ago(4) },
    { announcement_id: 'an-4', user_id: 'u-warga', read_at: ago(10) },
    { announcement_id: 'an-5', user_id: 'u-warga', read_at: ago(13) },
  ];
  ['u-ketua', 'u-sekre', 'u-bend', 'u-peng', 'u-joko'].forEach((u) =>
    ['an-1', 'an-2', 'an-3', 'an-4', 'an-5'].forEach((a) => r() < 0.75 && announcementReads.push({ announcement_id: a, user_id: u, read_at: ago(between(0, 4)) })),
  );

  // ---------------- Complaints -----------------
  const complaintCategories = [
    { id: 'cp-bersih', name: 'Kebersihan' }, { id: 'cp-aman', name: 'Keamanan' }, { id: 'cp-fasum', name: 'Fasilitas Umum' },
    { id: 'cp-tertib', name: 'Ketertiban' }, { id: 'cp-lain', name: 'Lainnya' },
  ];
  const budi = resByUser('u-ketua');
  const joko = resByUser('u-joko');
  const mkC = (i: number, o: Omit<Complaint, 'id' | 'ticket_number' | 'updates' | 'completed_at' | 'created_at'> & { days: number; flow: [Complaint['status'], string, string, number][] }): Complaint => {
    const created = ago(o.days, between(7, 21));
    const { days, flow, ...rest } = o;
    const p = jakartaParts(new Date(created));
    const updates = [{ status: 'submitted' as const, message: 'Pengaduan diterima sistem', by: o.created_by, at: created }, ...flow.map(([s, m, by, d]) => ({ status: s, message: m, by, at: ago(d, between(8, 20)) }))];
    const last = updates[updates.length - 1]!;
    return { id: `cm-${i}`, ticket_number: `ADU/${p.year}${pad(p.month, 2)}/${pad(i, 3)}`, created_at: created, completed_at: ['resolved', 'closed'].includes(last.status) ? last.at : null, updates, ...rest };
  };
  const complaints: Complaint[] = [
    mkC(1, { resident_id: budi.id, category_id: 'cp-fasum', title: 'Lampu jalan mati di depan B-04', description: 'Lampu PJU di tiang depan rumah B-04 mati sejak tiga hari lalu sehingga jalan gelap saat malam.', location: 'Jl. Kenanga depan B-04', priority: 'tinggi', status: 'in_progress', assigned_to: 'u-peng', created_by: 'u-ketua', days: 3,
      flow: [['assigned', 'Ditugaskan ke Pengurus (Dedi)', 'u-ketua', 2.8], ['in_progress', 'Sudah dicek, perlu ganti bohlam LED 40W. Pembelian dijadwalkan besok.', 'u-peng', 2]] }),
    mkC(2, { resident_id: ani.id, category_id: 'cp-bersih', title: 'Saluran air tersumbat depan B-07', description: 'Air menggenang setinggi mata kaki setiap hujan karena saluran tersumbat sampah plastik.', location: 'Jl. Kenanga depan B-07', priority: 'normal', status: 'submitted', assigned_to: null, created_by: 'u-warga', days: 0.6, flow: [] }),
    mkC(3, { resident_id: joko.id, category_id: 'cp-bersih', title: 'Sampah menumpuk di ujung Jl. Anggrek', description: 'Tumpukan sampah belum diangkut sejak Senin dan mulai berbau.', location: 'Ujung Jl. Anggrek', priority: 'normal', status: 'resolved', assigned_to: 'u-peng', created_by: 'u-joko', days: 12,
      flow: [['assigned', 'Ditugaskan ke Pengurus', 'u-ketua', 11.8], ['in_progress', 'Sudah koordinasi dengan petugas angkut kelurahan.', 'u-peng', 11], ['resolved', 'Sampah sudah diangkut. Jadwal angkut kembali normal Senin & Kamis.', 'u-peng', 10]] }),
    mkC(4, { resident_id: someone(9).id, category_id: 'cp-tertib', title: 'Parkir mobil menghalangi jalan', description: 'Mobil tamu sering parkir di tikungan Jl. Melati sehingga mobil lain sulit lewat.', location: 'Tikungan Jl. Melati', priority: 'normal', status: 'assigned', assigned_to: 'u-peng', created_by: 'u-ketua', days: 4,
      flow: [['assigned', 'Ditugaskan ke Pengurus untuk sosialisasi', 'u-ketua', 3.5]] }),
    mkC(5, { resident_id: someone(15).id, category_id: 'cp-aman', title: 'Anjing liar berkeliaran malam hari', description: 'Ada tiga anjing liar yang sering mengejar pengendara motor setelah pukul 22.00.', location: 'Jl. Anggrek', priority: 'tinggi', status: 'closed', assigned_to: 'u-peng', created_by: 'u-ketua', days: 30,
      flow: [['assigned', 'Ditugaskan ke Regu Ronda', 'u-ketua', 29], ['resolved', 'Sudah dilaporkan ke Dinas Pertanian & Ketahanan Pangan, anjing sudah dievakuasi.', 'u-peng', 24], ['closed', 'Ditutup setelah konfirmasi pelapor.', 'u-ketua', 23]] }),
    mkC(6, { resident_id: someone(22).id, category_id: 'cp-fasum', title: 'Jalan berlubang depan C-05', description: 'Lubang cukup dalam di tengah jalan, berbahaya bagi pengendara motor saat malam.', location: 'Jl. Anggrek depan C-05', priority: 'darurat', status: 'submitted', assigned_to: null, created_by: 'u-ketua', days: 0.3, flow: [] }),
  ];

  // ---------------- Activities -----------------
  const activities: Activity[] = [
    { id: 'ac-1', title: 'Kerja Bakti Lingkungan', category: 'kerja_bakti', description: 'Membersihkan saluran air, memangkas pohon, dan mengecat ulang pos ronda.', location: 'Titik kumpul: Pos ronda Jl. Melati', start_at: atDay(nextSunday, 7), end_at: atDay(nextSunday, 10), status: 'planned', created_by: 'u-peng', created_at: ago(3) },
    { id: 'ac-2', title: 'Pengajian Rutin Malam Jumat', category: 'keagamaan', description: 'Pengajian dan doa bersama warga, bergiliran tuan rumah.', location: 'Musala Al-Ikhlas', start_at: atDay(((5 - dow + 7) % 7) || 7, 19, 30), end_at: atDay(((5 - dow + 7) % 7) || 7, 21), status: 'planned', created_by: 'u-sekre', created_at: ago(6) },
    { id: 'ac-3', title: 'Rapat Warga Akhir Tahun', category: 'rapat', description: 'Laporan pertanggungjawaban kas, evaluasi program, dan rencana kegiatan tahun depan.', location: 'Balai Warga Griya Asri', start_at: atDay(nextSunday + 6, 19, 30), end_at: atDay(nextSunday + 6, 21, 30), status: 'planned', created_by: 'u-ketua', created_at: ago(5) },
    { id: 'ac-4', title: 'Posyandu Balita & Lansia', category: 'sosial', description: 'Penimbangan, imunisasi, dan cek kesehatan gratis.', location: 'Balai Warga Griya Asri', start_at: atDay(nextSunday + 10, 8), end_at: atDay(nextSunday + 10, 11), status: 'planned', created_by: 'u-sekre', created_at: ago(14) },
    { id: 'ac-5', title: 'Senam Pagi Bersama', category: 'olahraga', description: 'Senam sehat bersama instruktur dari puskesmas.', location: 'Lapangan Jl. Anggrek', start_at: ago(5, 6, 30), end_at: ago(5, 8), status: 'done', created_by: 'u-peng', created_at: ago(15) },
    { id: 'ac-6', title: 'Kerja Bakti Bulanan', category: 'kerja_bakti', description: 'Pembersihan selokan utama dan penanaman pohon peneduh.', location: 'Jl. Melati – Jl. Kenanga', start_at: ago(27, 7), end_at: ago(27, 10), status: 'done', created_by: 'u-peng', created_at: ago(35) },
  ];
  const participants: ActivityParticipant[] = [];
  const adults = residents.filter((x) => x.is_active && ['Kepala Keluarga', 'Istri', 'Suami'].includes(x.family_relationship));
  activities.forEach((a) => {
    const count = a.category === 'rapat' ? 14 : a.category === 'kerja_bakti' ? 22 : 12;
    const pool = [...adults].sort(() => r() - 0.5).slice(0, count);
    pool.forEach((p) => participants.push({ activity_id: a.id, resident_id: p.id, attendance_status: a.status === 'done' ? (r() < 0.85 ? 'present' : 'absent') : 'registered', registered_at: ago(between(1, 6)) }));
  });

  // ---------------- Security -----------------
  const men = residents.filter((x) => x.is_active && x.gender === 'L' && ['Kepala Keluarga', 'Suami'].includes(x.family_relationship));
  const teamNames = ['Regu Melati', 'Regu Kenanga', 'Regu Anggrek', 'Regu Mawar'];
  const days: number[][] = [[1, 5], [2, 6], [3, 0], [4]];
  const patrolTeams: PatrolTeam[] = teamNames.map((name, i) => {
    const member_ids = men.filter((_, j) => j % 4 === i).slice(0, 6).map((x) => x.id);
    return { id: `pt-${i + 1}`, name, leader_resident_id: member_ids[0]!, member_ids, weekdays: days[i]! };
  });
  const dedi = resByUser('u-peng');
  if (!patrolTeams[1]!.member_ids.includes(dedi.id)) patrolTeams[1]!.member_ids.unshift(dedi.id);
  patrolTeams[1]!.leader_resident_id = dedi.id;

  const patrolSchedules: PatrolSchedule[] = [];
  const patrolReports: PatrolReport[] = [];
  for (let d = -14; d <= 21; d++) {
    const date = dateOnly(-d);
    const wd = new Date(date + 'T12:00:00+07:00').getUTCDay();
    const team = patrolTeams.find((t) => t.weekdays.includes(wd))!;
    const id = `ps-${date}`;
    patrolSchedules.push({ id, team_id: team.id, patrol_date: date, start_time: '22:00', end_time: '04:00' });
    if (d < 0) {
      const incident = d === -9;
      patrolReports.push({
        id: `pr-${date}`, schedule_id: id, submitted_by: team.id === 'pt-2' ? 'u-peng' : 'u-ketua', created_at: ago(-d - 1, 4, 30),
        status: incident ? 'ada_kejadian' : d === -12 ? 'tidak_terlaksana' : 'aman',
        report: incident ? 'Pukul 01.40 ada orang tak dikenal mencoba membuka pagar C-08. Kabur saat diteriaki, sudah dilaporkan ke Bhabinkamtibmas.'
          : d === -12 ? 'Hujan deras sepanjang malam, ronda keliling ditiadakan. Pos tetap dijaga 2 orang.'
          : pick(['Keliling 3 kali, situasi aman dan kondusif.', 'Aman. Satu motor tamu di B-02 sudah dikonfirmasi pemilik rumah.', 'Situasi aman, gerbang utama dikunci pukul 23.00.', 'Aman terkendali. Lampu pos ronda perlu diganti.']),
      });
    }
  }
  const incidents: SecurityIncident[] = [
    { id: 'si-1', title: 'Percobaan masuk pekarangan C-08', description: 'Orang tak dikenal mencoba membuka pagar rumah C-08 pukul 01.40. Pelaku kabur ke arah jalan raya. Sudah dilaporkan ke Bhabinkamtibmas.', incident_date: ago(9, 1, 40), location: 'Jl. Anggrek No. 8', severity: 'sedang', status: 'handled', reported_by: 'u-ketua', created_at: ago(9, 5) },
    { id: 'si-2', title: 'Helm hilang di parkiran masjid', description: 'Warga kehilangan helm saat salat Isya. Disarankan memakai kunci helm.', incident_date: ago(18, 19, 30), location: 'Parkiran Musala Al-Ikhlas', severity: 'rendah', status: 'closed', reported_by: 'u-peng', created_at: ago(18, 21) },
    { id: 'si-3', title: 'Pohon tumbang menutup jalan', description: 'Angin kencang membuat pohon ketapang tumbang di Jl. Kenanga. Sebagian dahan mengenai kabel listrik.', incident_date: ago(1, 16, 10), location: 'Jl. Kenanga depan B-11', severity: 'tinggi', status: 'open', reported_by: 'u-peng', created_at: ago(1, 16, 30) },
  ];
  const guests: GuestLog[] = [
    ['Sutrisno', 'B-07', 'Antar paket JNE', 'B 4127 KJL', 0.05, 0.04],
    ['dr. Melati Kusuma', 'A-03', 'Kunjungan keluarga', 'B 1890 TRS', 0.2, null],
    ['Teknisi IndiHome', 'C-05', 'Perbaikan internet', 'B 9921 PQE', 1.1, 1.0],
    ['Ahmad Fauzi', 'A-09', 'Survei renovasi rumah', 'A 6532 UY', 1.6, 1.5],
    ['Kurir Shopee', 'B-02', 'Antar paket', '', 2.2, 2.19],
    ['Rombongan arisan', 'A-01', 'Arisan keluarga', 'B 2210 UKA', 3.1, 3.0],
    ['Petugas PLN', 'Pos ronda', 'Cek meteran', 'B 8810 PLN', 5.2, 5.1],
    ['Hj. Romlah', 'C-02', 'Silaturahmi', '', 6.4, 6.2],
  ].map(([n, dest, purpose, plate, a, d], i) => ({
    id: `gl-${i + 1}`, visitor_name: n as string, visitor_phone: i % 2 ? '' : `0812${between(1000, 9999)}${between(1000, 9999)}`, destination: dest as string,
    purpose: purpose as string, vehicle_plate: plate as string,
    arrival_at: new Date(now.getTime() - (a as number) * DAY).toISOString(),
    departure_at: d === null ? null : new Date(now.getTime() - (d as number) * DAY).toISOString(), recorded_by: 'u-peng',
  }));

  // ---------------- Notifications -----------------
  const notifications: Notification[] = [];
  const nf = (user_id: string, title: string, message: string, type: Notification['type'], link: string | null, days: number, read = false) =>
    notifications.push({ id: `nf-${notifications.length + 1}`, user_id, title, message, type, link, read_at: read ? ago(days - 0.1) : null, created_at: ago(days, between(7, 20)) });
  const curr = monthShift(0);
  nf('u-warga', 'Tagihan baru', `Iuran Kebersihan & Keamanan ${['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'][curr.m - 1]} · Rp50.000`, 'invoice', '/iuran', 6);
  nf('u-warga', 'Pengumuman: Kerja Bakti Lingkungan', 'Minggu ini pukul 07.00 WIB, titik kumpul pos ronda Jl. Melati.', 'announcement', '/pengumuman', 2);
  nf('u-warga', 'Surat disetujui', 'Surat Pengantar Anda sudah ditandatangani dan siap diunduh.', 'letter', '/surat', 25, true);
  nf('u-warga', 'Pembayaran diverifikasi', 'Pembayaran iuran bulan lalu sebesar Rp50.000 telah diterima.', 'payment', '/iuran', 20, true);
  nf('u-ketua', 'Pengaduan darurat baru', 'Jalan berlubang depan C-05 — perlu ditugaskan.', 'complaint', '/pengaduan', 0.3);
  nf('u-ketua', 'Surat menunggu persetujuan', '2 permohonan sudah diperiksa Sekretaris dan menunggu tanda tangan Anda.', 'letter', '/surat', 2);
  nf('u-ketua', 'Kejadian keamanan', 'Pohon tumbang di Jl. Kenanga dilaporkan Pengurus.', 'security', '/keamanan', 1, true);
  nf('u-sekre', 'Permohonan surat baru', 'Ani Lestari mengajukan Surat Keterangan Domisili.', 'letter', '/surat', 0.1);
  nf('u-sekre', 'Permohonan surat baru', 'Pengajuan Surat Pengantar akta kelahiran.', 'letter', '/surat', 1);
  nf('u-bend', 'Bukti transfer masuk', 'Ada pembayaran baru menunggu verifikasi.', 'payment', '/iuran?tab=verifikasi', 0.4);
  nf('u-bend', 'Pengingat jatuh tempo', 'Iuran bulan ini jatuh tempo tanggal 10.', 'system', '/iuran', 5, true);
  nf('u-peng', 'Pengaduan ditugaskan', 'Lampu jalan mati di depan B-04.', 'complaint', '/pengaduan', 2.8);
  nf('u-peng', 'Jadwal ronda', 'Regu Kenanga bertugas malam ini pukul 22.00.', 'security', '/keamanan', 0.5);

  // ---------------- Audit -----------------
  const audit: AuditLog[] = [
    { id: 'au-1', user_id: 'u-ketua', action: 'assign_role', table_name: 'user_memberships', record_id: 'm-u-bend', summary: 'Menetapkan Andi Wijaya sebagai Bendahara', created_at: ago(300) },
    { id: 'au-2', user_id: 'u-sekre', action: 'update', table_name: 'residents', record_id: null, summary: 'Memperbarui nomor HP warga A-07', created_at: ago(12, 14) },
    { id: 'au-3', user_id: 'u-bend', action: 'verify_payment', table_name: 'dues_payments', record_id: null, summary: 'Memverifikasi pembayaran iuran B-03 (Rp50.000)', created_at: ago(6, 19) },
    { id: 'au-4', user_id: 'u-bend', action: 'record_expense', table_name: 'cash_transactions', record_id: null, summary: 'Mencatat pengeluaran honor petugas sampah (Rp750.000)', created_at: ago(23, 10) },
    { id: 'au-5', user_id: 'u-ketua', action: 'approve_letter', table_name: 'letter_requests', record_id: 'lr-4', summary: 'Menyetujui Surat Keterangan Usaha', created_at: ago(8, 9) },
    { id: 'au-6', user_id: 'u-ketua', action: 'deactivate_user', table_name: 'user_memberships', record_id: 'm-u-sari', summary: 'Menonaktifkan akun Sari Wulandari (histori tetap tersimpan)', created_at: ago(20, 11) },
  ];

  return {
    version: DB_VERSION, neighborhood, profiles, memberships, households, residents, residentHistory: [],
    letterTypes, letters, duesTypes, invoices, payments, cashCategories, cash, announcements, announcementReads,
    notifications, complaintCategories, complaints, activities, participants, patrolTeams, patrolSchedules,
    patrolReports, incidents, guests, audit, counters,
  };
}
