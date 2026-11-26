/**
 * Store data MODE DEMO. Setiap aksi meniru RPC/RLS di supabase/migrations:
 * memeriksa role, memvalidasi, lalu menerapkan seluruh perubahan sekaligus
 * (bila gagal, tidak ada yang berubah) — sama seperti satu transaksi database.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  Activity, Announcement, AttendanceStatus, Complaint, ComplaintPriority, ComplaintStatus, Database, DuesType,
  GuestLog, Household, Invoice, Notification, Payment, PaymentMethod, Resident, Result, Role, SecurityIncident,
} from '@/types/models';
import { buildSeed, DB_VERSION } from '@/data/seed';
import { can, ROLE_LABEL, type Action } from '@/app/permissions';
import { useAuth } from './auth.store';
import { jakartaParts, MONTHS, pad, period, ROMAN, rupiah, todayISO, uid } from '@/lib/format';

type Draft = Database;
const ok = <T,>(data: T): Result<T> => ({ ok: true, data });
const fail = (error: string): Result<never> => ({ ok: false, error });

interface DbState {
  db: Database;
  reset: () => void;
  run: <T>(fn: (d: Draft, me: Actor) => T | Result<T>, need?: Action) => Result<T>;
}

export interface Actor {
  userId: string;
  role: Role;
  residentId: string | null;
  householdId: string | null;
  name: string;
}

export const useDb = create<DbState>()(
  persist(
    (set, get) => ({
      db: buildSeed(),
      reset: () => set({ db: buildSeed() }),
      run: (fn, need) => {
        const me = actorOf(get().db);
        if (!me) return fail('Sesi berakhir. Silakan masuk kembali.');
        if (need && !can(me.role, need)) return fail(`Role ${ROLE_LABEL[me.role]} tidak berwenang untuk tindakan ini.`);
        const draft = structuredClone(get().db);
        try {
          const out = fn(draft, me);
          if (out && typeof out === 'object' && 'ok' in out) {
            if (!(out as Result<unknown>).ok) return out as Result<never>;
            set({ db: draft });
            return out as Result<never>;
          }
          set({ db: draft });
          return ok(out as never);
        } catch (e) {
          return fail(e instanceof Error ? e.message : 'Terjadi kesalahan');
        }
      },
    }),
    {
      name: 'wargaku-demo-db',
      version: DB_VERSION,
      storage: createJSONStorage(() => localStorage),
      migrate: () => ({ db: buildSeed() }) as never,
      partialize: (s) => ({ db: s.db }),
    },
  ),
);

export function actorOf(db: Database): Actor | null {
  const userId = useAuth.getState().userId;
  if (!userId) return null;
  const m = db.memberships.find((x) => x.user_id === userId && x.is_active);
  const p = db.profiles.find((x) => x.id === userId && x.is_active);
  if (!m || !p) return null;
  const res = m.resident_id ? db.residents.find((x) => x.id === m.resident_id) : undefined;
  return { userId, role: m.role, residentId: res?.id ?? null, householdId: res?.household_id ?? null, name: p.full_name };
}

/* ------------------------------------------------------------ helpers */
const nowIso = () => new Date().toISOString();
function nextNo(d: Draft, key: string) {
  d.counters[key] = (d.counters[key] ?? 0) + 1;
  return d.counters[key]!;
}
function audit(d: Draft, me: Actor, action: string, table: string, record: string | null, summary: string) {
  d.audit.unshift({ id: uid(), user_id: me.userId, action, table_name: table, record_id: record, summary, created_at: nowIso() });
}
function notify(d: Draft, users: (string | null | undefined)[], n: Omit<Notification, 'id' | 'user_id' | 'read_at' | 'created_at'>) {
  [...new Set(users.filter(Boolean) as string[])].forEach((u) =>
    d.notifications.unshift({ id: uid(), user_id: u, read_at: null, created_at: nowIso(), ...n }),
  );
}
const householdUsers = (d: Draft, hh: string) => d.residents.filter((r) => r.household_id === hh && r.user_id).map((r) => r.user_id!);
const roleUsers = (d: Draft, roles: Role[]) => d.memberships.filter((m) => m.is_active && roles.includes(m.role)).map((m) => m.user_id);
const residentUser = (d: Draft, rid: string) => {
  const r = d.residents.find((x) => x.id === rid);
  return r ? householdUsers(d, r.household_id) : [];
};
const required = (v: unknown, label: string) => {
  if (v === undefined || v === null || (typeof v === 'string' && !v.trim())) throw new Error(`${label} wajib diisi`);
};
function nextCash(d: Draft, date: string) {
  const y = Number(date.slice(0, 4));
  return `KAS/${y}/${pad(nextNo(d, `cash:${y}`), 5)}`;
}

const run = <T,>(fn: (d: Draft, me: Actor) => T | Result<T>, need?: Action) => useDb.getState().run(fn, need);

/* =================================================================== */
/*                               AKSI                                   */
/* =================================================================== */
export const actions = {
  /* ---------------- Warga & keluarga ---------------- */
  saveResident(input: Partial<Resident> & { household_id: string; full_name: string }) {
    return run((d, me) => {
      required(input.full_name, 'Nama lengkap');
      required(input.household_id, 'Keluarga');
      if (input.nik && !/^\d{16}$/.test(input.nik)) throw new Error('NIK harus 16 digit angka');
      if (input.nik && d.residents.some((r) => r.nik === input.nik && r.id !== input.id)) throw new Error('NIK sudah terdaftar pada warga lain');
      if (input.id) {
        const r = d.residents.find((x) => x.id === input.id);
        if (!r) throw new Error('Warga tidak ditemukan');
        const changed = Object.keys(input).filter((k) => k !== 'id' && (input as never)[k] !== (r as never)[k] && k !== 'nik');
        Object.assign(r, input);
        d.residentHistory.unshift({ id: uid(), resident_id: r.id, change_type: 'update', summary: changed.length ? `Mengubah ${changed.join(', ')}` : 'Memperbarui data', changed_by: me.userId, created_at: nowIso() });
        audit(d, me, 'update', 'residents', r.id, `Memperbarui data warga ${r.full_name}`);
        return ok(r);
      }
      const r: Resident = {
        id: uid(), user_id: null, nik: '', gender: 'L', birth_place: '', birth_date: '', family_relationship: 'Anak', occupation: '',
        phone: '', resident_status: 'tetap', is_active: true, joined_at: todayISO(), left_at: null, created_at: nowIso(), ...input,
      } as Resident;
      d.residents.push(r);
      const hh = d.households.find((h) => h.id === r.household_id);
      if (hh && !hh.head_resident_id && r.family_relationship === 'Kepala Keluarga') hh.head_resident_id = r.id;
      if (hh && hh.status === 'vacant') hh.status = 'active';
      d.residentHistory.unshift({ id: uid(), resident_id: r.id, change_type: 'insert', summary: 'Data warga ditambahkan', changed_by: me.userId, created_at: nowIso() });
      audit(d, me, 'insert', 'residents', r.id, `Menambahkan warga ${r.full_name}`);
      return ok(r);
    }, 'residents.manage');
  },

  setResidentStatus(id: string, status: Resident['resident_status']) {
    return run((d, me) => {
      const r = d.residents.find((x) => x.id === id);
      if (!r) throw new Error('Warga tidak ditemukan');
      const old = r.resident_status;
      r.resident_status = status;
      r.is_active = !['pindah', 'meninggal'].includes(status);
      r.left_at = r.is_active ? null : todayISO();
      d.residentHistory.unshift({ id: uid(), resident_id: r.id, change_type: 'status', summary: `Status ${old} → ${status}`, changed_by: me.userId, created_at: nowIso() });
      audit(d, me, 'update', 'residents', r.id, `Mengubah status ${r.full_name} menjadi ${status}`);
      return ok(r);
    }, 'residents.manage');
  },

  saveHousehold(input: Partial<Household> & { house_number: string; address: string }) {
    return run((d, me) => {
      required(input.house_number, 'Nomor rumah');
      required(input.address, 'Alamat');
      if (input.family_card_number && !/^\d{16}$/.test(input.family_card_number)) throw new Error('Nomor KK harus 16 digit angka');
      if (d.households.some((h) => h.house_number.toLowerCase() === input.house_number.toLowerCase() && h.id !== input.id))
        throw new Error(`Nomor rumah ${input.house_number} sudah terdaftar`);
      if (input.id) {
        const h = d.households.find((x) => x.id === input.id)!;
        Object.assign(h, input);
        audit(d, me, 'update', 'households', h.id, `Memperbarui keluarga ${h.house_number}`);
        return ok(h);
      }
      const h: Household = { id: uid(), head_resident_id: null, family_card_number: '', status: 'active', created_at: nowIso(), ...input } as Household;
      d.households.push(h);
      audit(d, me, 'insert', 'households', h.id, `Menambahkan keluarga ${h.house_number}`);
      return ok(h);
    }, 'households.manage');
  },

  /* ---------------- Surat ---------------- */
  submitLetter(input: { letter_type_id: string; resident_id: string; purpose: string; form_data: Record<string, string> }) {
    return run((d, me) => {
      required(input.letter_type_id, 'Jenis surat');
      required(input.resident_id, 'Pemohon');
      required(input.purpose, 'Keperluan');
      if (input.purpose.trim().length < 10) throw new Error('Jelaskan keperluan minimal 10 karakter');
      const res = d.residents.find((r) => r.id === input.resident_id);
      if (!res) throw new Error('Pemohon tidak ditemukan');
      if (!can(me.role, 'letters.review') && res.household_id !== me.householdId) throw new Error('Anda hanya dapat mengajukan surat untuk anggota keluarga sendiri');
      const { year, month } = jakartaParts();
      const n = nextNo(d, `request:${year}`);
      const lt = d.letterTypes.find((t) => t.id === input.letter_type_id)!;
      const l = {
        id: uid(), ...input, purpose: input.purpose.trim(), request_number: `REQ/${year}${pad(month, 2)}/${pad(n, 4)}`, status: 'submitted' as const,
        reviewed_by: null, review_note: null, approved_by: null, letter_number: null, rejection_reason: null, created_by: me.userId,
        created_at: nowIso(), completed_at: null, history: [{ status: 'submitted' as const, note: null, by: me.userId, at: nowIso() }],
      };
      d.letters.unshift(l);
      notify(d, roleUsers(d, ['sekretaris']), { title: 'Permohonan surat baru', message: `${res.full_name} mengajukan ${lt.name}.`, type: 'letter', link: '/surat' });
      audit(d, me, 'insert', 'letter_requests', l.id, `Mengajukan ${lt.name} untuk ${res.full_name}`);
      return ok(l);
    }, 'letters.request');
  },

  resubmitLetter(id: string, purpose: string, form_data: Record<string, string>) {
    return run((d, me) => {
      const l = d.letters.find((x) => x.id === id);
      if (!l || l.status !== 'revision') throw new Error('Permohonan tidak dapat diperbaiki');
      const res = d.residents.find((r) => r.id === l.resident_id);
      if (res?.household_id !== me.householdId && !can(me.role, 'letters.review')) throw new Error('Tidak berwenang');
      required(purpose, 'Keperluan');
      l.purpose = purpose.trim();
      l.form_data = form_data;
      l.status = 'submitted';
      l.history.push({ status: 'submitted', note: 'Diperbaiki pemohon', by: me.userId, at: nowIso() });
      notify(d, roleUsers(d, ['sekretaris']), { title: 'Permohonan diperbaiki', message: `${l.request_number} siap diperiksa ulang.`, type: 'letter', link: '/surat' });
      return ok(l);
    });
  },

  reviewLetter(id: string, accept: boolean, note: string) {
    return run((d, me) => {
      const l = d.letters.find((x) => x.id === id);
      if (!l) throw new Error('Permohonan tidak ditemukan');
      if (l.status !== 'submitted') throw new Error('Permohonan ini tidak sedang menunggu pemeriksaan');
      if (!accept && !note.trim()) throw new Error('Tulis catatan perbaikan untuk pemohon');
      l.status = accept ? 'review' : 'revision';
      l.reviewed_by = me.userId;
      l.review_note = note.trim() || null;
      l.history.push({ status: l.status, note: note.trim() || (accept ? 'Berkas lengkap' : null), by: me.userId, at: nowIso() });
      notify(d, residentUser(d, l.resident_id), accept
        ? { title: 'Surat menunggu tanda tangan Ketua RT', message: `${l.request_number} sudah diperiksa Sekretaris.`, type: 'letter', link: '/surat' }
        : { title: 'Permohonan surat perlu diperbaiki', message: note.trim(), type: 'letter', link: '/surat' });
      if (accept) notify(d, roleUsers(d, ['ketua_rt']), { title: 'Surat menunggu persetujuan', message: `${l.request_number} siap ditandatangani.`, type: 'letter', link: '/surat' });
      audit(d, me, accept ? 'review_letter' : 'return_letter', 'letter_requests', l.id, `${accept ? 'Meneruskan' : 'Mengembalikan'} ${l.request_number}`);
      return ok(l);
    }, 'letters.review');
  },

  approveLetter(id: string, approve: boolean, reason: string) {
    return run((d, me) => {
      const l = d.letters.find((x) => x.id === id);
      if (!l) throw new Error('Permohonan tidak ditemukan');
      if (l.status !== 'review') throw new Error('Permohonan belum diperiksa Sekretaris');
      if (approve) {
        const { year, month } = jakartaParts();
        const n = nextNo(d, `letter:${year}`); // counter atomik: nomor tidak pernah dipakai ulang
        l.letter_number = `${pad(n)}/RT.${d.neighborhood.rt_number}/${ROMAN[month - 1]}/${year}`;
        l.status = 'approved';
        l.approved_by = me.userId;
        l.completed_at = nowIso();
        l.history.push({ status: 'approved', note: l.letter_number, by: me.userId, at: nowIso() });
        notify(d, residentUser(d, l.resident_id), { title: 'Surat disetujui', message: `Nomor ${l.letter_number} siap diunduh.`, type: 'letter', link: '/surat' });
      } else {
        if (!reason.trim()) throw new Error('Alasan penolakan wajib diisi');
        l.status = 'rejected';
        l.rejection_reason = reason.trim();
        l.completed_at = nowIso();
        l.history.push({ status: 'rejected', note: reason.trim(), by: me.userId, at: nowIso() });
        notify(d, residentUser(d, l.resident_id), { title: 'Surat ditolak', message: reason.trim(), type: 'letter', link: '/surat' });
      }
      audit(d, me, approve ? 'approve_letter' : 'reject_letter', 'letter_requests', l.id, `${approve ? 'Menyetujui' : 'Menolak'} ${l.request_number}${approve ? ` → ${l.letter_number}` : ''}`);
      return ok(l);
    }, 'letters.approve');
  },

  markLetterDownloaded(id: string) {
    return run((d) => {
      const l = d.letters.find((x) => x.id === id);
      if (l && l.status === 'approved') {
        l.status = 'completed';
        l.history.push({ status: 'completed', note: 'Dokumen PDF diunduh', by: useAuth.getState().userId ?? '', at: nowIso() });
      }
      return ok(true);
    });
  },

  /* ---------------- Iuran & tagihan ---------------- */
  saveDuesType(input: Partial<DuesType> & { name: string; amount: number; billing_period: DuesType['billing_period'] }) {
    return run((d, me) => {
      required(input.name, 'Nama iuran');
      if (!(input.amount > 0)) throw new Error('Nominal harus lebih dari 0');
      if (input.id) {
        const t = d.duesTypes.find((x) => x.id === input.id)!;
        Object.assign(t, input);
        audit(d, me, 'update', 'dues_types', t.id, `Memperbarui jenis iuran ${t.name}`);
        return ok(t);
      }
      const t: DuesType = { id: uid(), description: '', is_active: true, ...input };
      d.duesTypes.push(t);
      audit(d, me, 'insert', 'dues_types', t.id, `Menambahkan jenis iuran ${t.name} (${rupiah(t.amount)})`);
      return ok(t);
    }, 'dues.manage');
  },

  /** create_invoice untuk banyak keluarga sekaligus; periode yang sudah ditagih dilewati. */
  generateInvoices(input: { dues_type_id: string; month: number | null; year: number; due_date: string; household_ids: string[] }) {
    return run((d, me) => {
      const t = d.duesTypes.find((x) => x.id === input.dues_type_id && x.is_active);
      if (!t) throw new Error('Pilih jenis iuran yang aktif');
      if (t.billing_period === 'bulanan' && !input.month) throw new Error('Iuran bulanan wajib memilih bulan');
      if (!input.household_ids.length) throw new Error('Pilih minimal satu keluarga');
      required(input.due_date, 'Jatuh tempo');
      let created = 0, skipped = 0;
      for (const hh of input.household_ids) {
        const dup = d.invoices.some((i) => i.household_id === hh && i.dues_type_id === t.id && i.period_year === input.year
          && (i.period_month ?? 0) === (t.billing_period === 'bulanan' ? input.month ?? 0 : 0) && i.status !== 'cancelled');
        if (dup) { skipped++; continue; }
        const n = nextNo(d, `invoice:${input.year}`);
        const inv: Invoice = {
          id: uid(), household_id: hh, dues_type_id: t.id, invoice_number: `INV/${input.year}/${pad(n, 5)}`,
          period_month: t.billing_period === 'bulanan' ? input.month : null, period_year: input.year, amount: t.amount,
          paid_amount: 0, status: 'unpaid', due_date: input.due_date, created_at: nowIso(),
        };
        d.invoices.push(inv);
        notify(d, householdUsers(d, hh), { title: 'Tagihan baru', message: `${t.name} ${period(inv.period_month, inv.period_year)} · ${rupiah(inv.amount)}`, type: 'invoice', link: '/iuran' });
        created++;
      }
      audit(d, me, 'create_invoice', 'dues_invoices', null, `Membuat ${created} tagihan ${t.name} ${period(input.month, input.year)}`);
      return ok({ created, skipped });
    }, 'dues.manage');
  },

  cancelInvoice(id: string) {
    return run((d, me) => {
      const inv = d.invoices.find((x) => x.id === id);
      if (!inv) throw new Error('Tagihan tidak ditemukan');
      if (inv.paid_amount > 0) throw new Error('Tagihan yang sudah dibayar sebagian tidak dapat dibatalkan');
      if (d.payments.some((p) => p.invoice_id === id && p.status === 'pending')) throw new Error('Masih ada pembayaran menunggu verifikasi');
      inv.status = 'cancelled';
      audit(d, me, 'cancel_invoice', 'dues_invoices', inv.id, `Membatalkan tagihan ${inv.invoice_number}`);
      return ok(inv);
    }, 'dues.manage');
  },

  /** Upload bukti hanya membuat pembayaran `pending` (PRD §3.4). */
  submitPayment(input: { invoice_id: string; amount: number; method: PaymentMethod; date: string; note: string; proof_name: string | null; proof_data: string | null }) {
    return run((d, me) => {
      const inv = d.invoices.find((x) => x.id === input.invoice_id);
      if (!inv) throw new Error('Tagihan tidak ditemukan');
      if (inv.status === 'paid' || inv.status === 'cancelled') throw new Error('Tagihan ini sudah lunas atau dibatalkan');
      if (inv.household_id !== me.householdId && !can(me.role, 'payments.submitForOthers')) throw new Error('Anda hanya dapat membayar tagihan keluarga sendiri');
      const pendingSum = d.payments.filter((p) => p.invoice_id === inv.id && p.status === 'pending').reduce((s, p) => s + p.amount, 0);
      const remaining = inv.amount - inv.paid_amount - pendingSum;
      if (!(input.amount > 0)) throw new Error('Nominal harus lebih dari 0');
      if (input.amount > remaining) throw new Error(`Nominal melebihi sisa tagihan (${rupiah(Math.max(remaining, 0))})`);
      if (input.method === 'transfer' && !input.proof_data) throw new Error('Unggah bukti transfer');
      required(input.date, 'Tanggal bayar');
      const p: Payment = {
        id: uid(), invoice_id: inv.id, household_id: inv.household_id, payer_user_id: me.userId,
        reference_code: `PAY${Date.now().toString(36).toUpperCase()}`, amount: input.amount, payment_method: input.method,
        proof_name: input.proof_name, proof_data: input.proof_data, payment_date: input.date, note: input.note.trim(),
        status: 'pending', verified_by: null, verified_at: null, rejection_reason: null, created_at: nowIso(),
      };
      d.payments.unshift(p);
      const hh = d.households.find((h) => h.id === inv.household_id)!;
      notify(d, roleUsers(d, ['bendahara']), { title: 'Pembayaran menunggu verifikasi', message: `${hh.house_number} · ${rupiah(p.amount)} (${inv.invoice_number})`, type: 'payment', link: '/iuran?tab=verifikasi' });
      audit(d, me, 'submit_payment', 'dues_payments', p.id, `Mengirim pembayaran ${rupiah(p.amount)} untuk ${inv.invoice_number}`);
      return ok(p);
    });
  },

  /** verify_dues_payment: atomik & idempotent (PRD §8.2). */
  verifyPayment(id: string) {
    return run((d, me) => {
      const p = d.payments.find((x) => x.id === id);
      if (!p) throw new Error('Pembayaran tidak ditemukan');
      if (p.status !== 'pending') throw new Error(`Pembayaran sudah diproses (${p.status === 'verified' ? 'terverifikasi' : 'ditolak'})`);
      const inv = d.invoices.find((x) => x.id === p.invoice_id)!;
      if (inv.household_id !== p.household_id) throw new Error('Pembayaran dan tagihan tidak cocok');
      if (inv.status === 'cancelled') throw new Error('Tagihan sudah dibatalkan');
      const newPaid = inv.paid_amount + p.amount;
      if (newPaid > inv.amount) throw new Error(`Nominal melebihi sisa tagihan (${rupiah(inv.amount - inv.paid_amount)})`);
      if (d.cash.some((c) => c.payment_id === p.id)) throw new Error('Pemasukan untuk pembayaran ini sudah tercatat');
      p.status = 'verified';
      p.verified_by = me.userId;
      p.verified_at = nowIso();
      inv.paid_amount = newPaid;
      inv.status = newPaid === inv.amount ? 'paid' : 'partial';
      const hh = d.households.find((h) => h.id === p.household_id)!;
      d.cash.push({
        id: uid(), category_id: 'cc-iuran', payment_id: p.id, reverses_id: null, transaction_number: nextCash(d, p.payment_date),
        transaction_type: 'income', amount: p.amount, transaction_date: p.payment_date,
        description: `Pembayaran ${inv.invoice_number} · ${hh.house_number}`, recorded_by: me.userId, created_at: nowIso(),
      });
      audit(d, me, 'verify_payment', 'dues_payments', p.id, `Memverifikasi ${rupiah(p.amount)} dari ${hh.house_number} (${inv.invoice_number})`);
      notify(d, householdUsers(d, p.household_id), { title: 'Pembayaran diverifikasi', message: `${rupiah(p.amount)} untuk ${inv.invoice_number} telah diterima. Terima kasih!`, type: 'payment', link: '/iuran' });
      return ok(p);
    }, 'payments.verify');
  },

  rejectPayment(id: string, reason: string) {
    return run((d, me) => {
      const p = d.payments.find((x) => x.id === id);
      if (!p) throw new Error('Pembayaran tidak ditemukan');
      if (p.status !== 'pending') throw new Error('Pembayaran sudah diproses');
      if (!reason.trim()) throw new Error('Alasan penolakan wajib diisi');
      p.status = 'rejected';
      p.rejection_reason = reason.trim();
      p.verified_by = me.userId;
      p.verified_at = nowIso();
      audit(d, me, 'reject_payment', 'dues_payments', p.id, `Menolak pembayaran ${rupiah(p.amount)}: ${reason.trim()}`);
      notify(d, householdUsers(d, p.household_id), { title: 'Pembayaran ditolak', message: reason.trim(), type: 'payment', link: '/iuran' });
      return ok(p);
    }, 'payments.verify');
  },

  /* ---------------- Buku kas ---------------- */
  recordCash(input: { type: 'income' | 'expense'; category_id: string; amount: number; date: string; description: string }) {
    return run((d, me) => {
      if (!(input.amount > 0)) throw new Error('Nominal harus lebih dari 0');
      required(input.description, 'Keterangan');
      required(input.date, 'Tanggal');
      const cat = d.cashCategories.find((c) => c.id === input.category_id && c.transaction_type === input.type);
      if (!cat) throw new Error('Pilih kategori yang sesuai');
      if (cat.id === 'cc-iuran') throw new Error('Pemasukan iuran tercatat otomatis saat pembayaran diverifikasi');
      const t = {
        id: uid(), category_id: cat.id, payment_id: null, reverses_id: null, transaction_number: nextCash(d, input.date),
        transaction_type: input.type, amount: input.amount, transaction_date: input.date, description: input.description.trim(),
        recorded_by: me.userId, created_at: nowIso(),
      };
      d.cash.push(t);
      audit(d, me, input.type === 'expense' ? 'record_expense' : 'record_income', 'cash_transactions', t.id, `${input.type === 'expense' ? 'Pengeluaran' : 'Pemasukan'} ${rupiah(t.amount)} · ${cat.name}`);
      return ok(t);
    }, 'cash.manage');
  },

  /** Koreksi = transaksi pembalik; transaksi lama tidak dihapus (PRD §4.3). */
  reverseCash(id: string, reason: string) {
    return run((d, me) => {
      const old = d.cash.find((c) => c.id === id);
      if (!old) throw new Error('Transaksi tidak ditemukan');
      if (old.payment_id) throw new Error('Pemasukan iuran tidak dikoreksi dari buku kas');
      if (old.reverses_id) throw new Error('Transaksi pembalik tidak dapat dibalik lagi');
      if (d.cash.some((c) => c.reverses_id === old.id)) throw new Error('Transaksi ini sudah pernah dikoreksi');
      required(reason, 'Alasan koreksi');
      const date = todayISO();
      const t = {
        id: uid(), category_id: old.category_id, payment_id: null, reverses_id: old.id, transaction_number: nextCash(d, date),
        transaction_type: old.transaction_type === 'income' ? ('expense' as const) : ('income' as const), amount: old.amount,
        transaction_date: date, description: `Koreksi ${old.transaction_number}: ${reason.trim()}`, recorded_by: me.userId, created_at: nowIso(),
      };
      d.cash.push(t);
      audit(d, me, 'reverse_transaction', 'cash_transactions', t.id, `Membuat transaksi pembalik untuk ${old.transaction_number}`);
      return ok(t);
    }, 'cash.manage');
  },

  /* ---------------- Pengumuman ---------------- */
  saveAnnouncement(input: Partial<Announcement> & { title: string; content: string; category: string }) {
    return run((d, me) => {
      required(input.title, 'Judul');
      required(input.content, 'Isi pengumuman');
      if (input.id) {
        const a = d.announcements.find((x) => x.id === input.id)!;
        if (a.status === 'published' && !can(me.role, 'announcements.publish')) throw new Error('Pengumuman terbit hanya dapat diubah Ketua RT/Sekretaris');
        Object.assign(a, { title: input.title, content: input.content, category: input.category, is_pinned: !!input.is_pinned });
        return ok(a);
      }
      const a: Announcement = { id: uid(), status: 'draft', is_pinned: !!input.is_pinned, published_at: null, created_by: me.userId, created_at: nowIso(), title: input.title.trim(), content: input.content.trim(), category: input.category };
      d.announcements.unshift(a);
      if (!can(me.role, 'announcements.publish'))
        notify(d, roleUsers(d, ['ketua_rt', 'sekretaris']), { title: 'Draft pengumuman baru', message: `"${a.title}" menunggu publikasi.`, type: 'announcement', link: '/pengumuman' });
      return ok(a);
    }, 'announcements.create');
  },

  publishAnnouncement(id: string) {
    return run((d, me) => {
      const a = d.announcements.find((x) => x.id === id);
      if (!a) throw new Error('Pengumuman tidak ditemukan');
      if (a.status === 'published') return ok(a); // idempotent
      a.status = 'published';
      a.published_at = nowIso();
      notify(d, d.memberships.filter((m) => m.is_active).map((m) => m.user_id), { title: `Pengumuman: ${a.title}`, message: a.content.slice(0, 120), type: 'announcement', link: '/pengumuman' });
      audit(d, me, 'publish_announcement', 'announcements', a.id, `Memublikasikan "${a.title}"`);
      return ok(a);
    }, 'announcements.publish');
  },

  archiveAnnouncement(id: string) {
    return run((d, me) => {
      const a = d.announcements.find((x) => x.id === id)!;
      a.status = 'archived';
      a.is_pinned = false;
      audit(d, me, 'archive_announcement', 'announcements', a.id, `Mengarsipkan "${a.title}"`);
      return ok(a);
    }, 'announcements.publish');
  },

  markAnnouncementRead(id: string) {
    return run((d, me) => {
      if (!d.announcementReads.some((r) => r.announcement_id === id && r.user_id === me.userId))
        d.announcementReads.push({ announcement_id: id, user_id: me.userId, read_at: nowIso() });
      return ok(true);
    });
  },

  /* ---------------- Notifikasi ---------------- */
  markNotificationRead(id: string) {
    return run((d, me) => {
      const n = d.notifications.find((x) => x.id === id && x.user_id === me.userId);
      if (n && !n.read_at) n.read_at = nowIso();
      return ok(true);
    });
  },
  markAllNotificationsRead() {
    return run((d, me) => {
      d.notifications.forEach((n) => n.user_id === me.userId && !n.read_at && (n.read_at = nowIso()));
      return ok(true);
    });
  },

  /* ---------------- Pengaduan ---------------- */
  fileComplaint(input: { category_id: string; title: string; description: string; location: string; priority: ComplaintPriority }) {
    return run((d, me) => {
      required(input.title, 'Judul laporan');
      required(input.description, 'Uraian');
      required(input.category_id, 'Kategori');
      if (!me.residentId) throw new Error('Akun Anda belum terhubung ke data warga');
      const { year, month } = jakartaParts();
      const n = nextNo(d, `complaint:${year}`) + 6;
      const c: Complaint = {
        id: uid(), ticket_number: `ADU/${year}${pad(month, 2)}/${pad(n)}`, resident_id: me.residentId, ...input,
        title: input.title.trim(), description: input.description.trim(), status: 'submitted', assigned_to: null,
        created_by: me.userId, created_at: nowIso(), completed_at: null,
        updates: [{ status: 'submitted', message: 'Pengaduan diterima sistem', by: me.userId, at: nowIso() }],
      };
      d.complaints.unshift(c);
      notify(d, roleUsers(d, ['ketua_rt']), { title: input.priority === 'darurat' ? 'Pengaduan darurat baru' : 'Pengaduan baru', message: c.title, type: 'complaint', link: '/pengaduan' });
      return ok(c);
    });
  },

  assignComplaint(id: string, assignee: string, note: string) {
    return run((d, me) => {
      const c = d.complaints.find((x) => x.id === id);
      if (!c) throw new Error('Pengaduan tidak ditemukan');
      if (['resolved', 'closed'].includes(c.status)) throw new Error('Pengaduan sudah selesai');
      const m = d.memberships.find((x) => x.user_id === assignee && x.is_active && x.role !== 'warga');
      if (!m) throw new Error('Pilih petugas yang valid');
      c.assigned_to = assignee;
      c.status = 'assigned';
      const name = d.profiles.find((p) => p.id === assignee)?.full_name ?? '';
      c.updates.push({ status: 'assigned', message: note.trim() || `Ditugaskan ke ${name}`, by: me.userId, at: nowIso() });
      notify(d, [assignee], { title: 'Pengaduan ditugaskan ke Anda', message: c.title, type: 'complaint', link: '/pengaduan' });
      notify(d, [c.created_by], { title: 'Pengaduan sedang ditangani', message: `${c.title} — ditugaskan ke ${name}.`, type: 'complaint', link: '/pengaduan' });
      audit(d, me, 'assign_complaint', 'complaints', c.id, `Menugaskan ${c.ticket_number} ke ${name}`);
      return ok(c);
    }, 'complaints.assign');
  },

  updateComplaint(id: string, status: ComplaintStatus, message: string) {
    return run((d, me) => {
      const c = d.complaints.find((x) => x.id === id);
      if (!c) throw new Error('Pengaduan tidak ditemukan');
      if (me.role !== 'ketua_rt' && c.assigned_to !== me.userId) throw new Error('Pengaduan ini tidak ditugaskan kepada Anda');
      if (!message.trim()) throw new Error('Tulis tanggapan untuk pelapor');
      c.status = status;
      c.completed_at = ['resolved', 'closed'].includes(status) ? nowIso() : null;
      c.updates.push({ status, message: message.trim(), by: me.userId, at: nowIso() });
      notify(d, [c.created_by], { title: 'Pengaduan diperbarui', message: message.trim(), type: 'complaint', link: '/pengaduan' });
      audit(d, me, 'update_complaint', 'complaints', c.id, `Status ${c.ticket_number} → ${status}`);
      return ok(c);
    }, 'complaints.handle');
  },

  /* ---------------- Kegiatan ---------------- */
  saveActivity(input: Partial<Activity> & { title: string; start_at: string; location: string; category: Activity['category'] }) {
    return run((d, me) => {
      required(input.title, 'Nama kegiatan');
      required(input.start_at, 'Waktu mulai');
      required(input.location, 'Lokasi');
      if (input.end_at && input.end_at < input.start_at) throw new Error('Waktu selesai harus setelah waktu mulai');
      if (input.id) {
        const a = d.activities.find((x) => x.id === input.id)!;
        Object.assign(a, input);
        return ok(a);
      }
      const a: Activity = { id: uid(), description: '', end_at: null, status: 'planned', created_by: me.userId, created_at: nowIso(), ...input };
      d.activities.push(a);
      notify(d, d.memberships.filter((m) => m.is_active).map((m) => m.user_id), { title: 'Kegiatan baru', message: `${a.title} · ${a.location}`, type: 'activity', link: '/kegiatan' });
      audit(d, me, 'insert', 'activities', a.id, `Membuat kegiatan ${a.title}`);
      return ok(a);
    }, 'activities.manage');
  },

  setActivityStatus(id: string, status: Activity['status']) {
    return run((d, me) => {
      const a = d.activities.find((x) => x.id === id)!;
      a.status = status;
      audit(d, me, 'update', 'activities', a.id, `Status ${a.title} → ${status}`);
      return ok(a);
    }, 'activities.manage');
  },

  toggleJoin(activityId: string, residentId: string) {
    return run((d, me) => {
      const res = d.residents.find((r) => r.id === residentId);
      if (!res) throw new Error('Warga tidak ditemukan');
      if (res.household_id !== me.householdId && !can(me.role, 'activities.manage')) throw new Error('Hanya untuk anggota keluarga sendiri');
      const a = d.activities.find((x) => x.id === activityId)!;
      if (a.status !== 'planned') throw new Error('Pendaftaran kegiatan sudah ditutup');
      const i = d.participants.findIndex((p) => p.activity_id === activityId && p.resident_id === residentId);
      if (i >= 0) {
        d.participants.splice(i, 1);
        return ok(false);
      }
      d.participants.push({ activity_id: activityId, resident_id: residentId, attendance_status: 'registered', registered_at: nowIso() });
      return ok(true);
    });
  },

  setAttendance(activityId: string, residentId: string, status: AttendanceStatus) {
    return run((d) => {
      const p = d.participants.find((x) => x.activity_id === activityId && x.resident_id === residentId);
      if (p) p.attendance_status = status;
      else d.participants.push({ activity_id: activityId, resident_id: residentId, attendance_status: status, registered_at: nowIso() });
      return ok(true);
    }, 'activities.manage');
  },

  /* ---------------- Keamanan ---------------- */
  logGuest(input: Omit<GuestLog, 'id' | 'arrival_at' | 'departure_at' | 'recorded_by'>) {
    return run((d, me) => {
      required(input.visitor_name, 'Nama tamu');
      required(input.destination, 'Tujuan');
      const g: GuestLog = { id: uid(), arrival_at: nowIso(), departure_at: null, recorded_by: me.userId, ...input };
      d.guests.unshift(g);
      return ok(g);
    }, 'security.manage');
  },
  checkoutGuest(id: string) {
    return run((d) => {
      const g = d.guests.find((x) => x.id === id)!;
      g.departure_at = nowIso();
      return ok(g);
    }, 'security.manage');
  },
  reportIncident(input: Omit<SecurityIncident, 'id' | 'status' | 'reported_by' | 'created_at'>) {
    return run((d, me) => {
      required(input.title, 'Judul kejadian');
      required(input.description, 'Kronologi');
      required(input.incident_date, 'Waktu kejadian');
      const s: SecurityIncident = { id: uid(), status: 'open', reported_by: me.userId, created_at: nowIso(), ...input };
      d.incidents.unshift(s);
      notify(d, roleUsers(d, ['ketua_rt', 'pengurus']).filter((u) => u !== me.userId), { title: 'Laporan kejadian keamanan', message: s.title, type: 'security', link: '/keamanan' });
      return ok(s);
    });
  },
  setIncidentStatus(id: string, status: SecurityIncident['status']) {
    return run((d, me) => {
      const s = d.incidents.find((x) => x.id === id)!;
      s.status = status;
      audit(d, me, 'update', 'security_incidents', s.id, `Status kejadian "${s.title}" → ${status}`);
      return ok(s);
    }, 'security.manage');
  },
  submitPatrolReport(scheduleId: string, status: 'aman' | 'ada_kejadian' | 'tidak_terlaksana', report: string) {
    return run((d, me) => {
      required(report, 'Catatan ronda');
      if (d.patrolReports.some((p) => p.schedule_id === scheduleId)) throw new Error('Laporan untuk jadwal ini sudah dikirim');
      d.patrolReports.push({ id: uid(), schedule_id: scheduleId, status, report: report.trim(), submitted_by: me.userId, created_at: nowIso() });
      return ok(true);
    }, 'security.manage');
  },

  /* ---------------- Pengguna & role ---------------- */
  assignRole(userId: string, role: Role) {
    return run((d, me) => {
      if (userId === me.userId && role !== 'ketua_rt') throw new Error('Ketua RT tidak dapat menurunkan role dirinya sendiri');
      const m = d.memberships.find((x) => x.user_id === userId);
      if (!m) throw new Error('Akun tidak ditemukan');
      if (role === 'ketua_rt' && m.role !== 'ketua_rt' && d.memberships.some((x) => x.role === 'ketua_rt' && x.is_active && x.user_id !== userId))
        throw new Error('Hanya boleh ada satu Ketua RT aktif. Ubah role Ketua RT saat ini terlebih dahulu.');
      const old = m.role;
      m.role = role;
      const name = d.profiles.find((p) => p.id === userId)?.full_name;
      audit(d, me, 'assign_role', 'user_memberships', m.id, `Role ${name}: ${ROLE_LABEL[old]} → ${ROLE_LABEL[role]}`);
      notify(d, [userId], { title: 'Role akun diperbarui', message: `Anda sekarang ${ROLE_LABEL[role]}.`, type: 'system', link: null });
      return ok(m);
    }, 'users.manage');
  },
  setUserActive(userId: string, active: boolean) {
    return run((d, me) => {
      if (userId === me.userId) throw new Error('Tidak dapat menonaktifkan akun sendiri');
      const m = d.memberships.find((x) => x.user_id === userId)!;
      const p = d.profiles.find((x) => x.id === userId)!;
      m.is_active = active;
      p.is_active = active;
      audit(d, me, active ? 'activate_user' : 'deactivate_user', 'user_memberships', m.id, `${active ? 'Mengaktifkan' : 'Menonaktifkan'} akun ${p.full_name}${active ? '' : ' (histori tetap tersimpan)'}`);
      return ok(m);
    }, 'users.manage');
  },
  createAccount(residentId: string, role: Role, email: string) {
    return run((d, me) => {
      const res = d.residents.find((r) => r.id === residentId);
      if (!res) throw new Error('Pilih warga');
      if (res.user_id) throw new Error('Warga ini sudah memiliki akun');
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Format email tidak valid');
      if (d.profiles.some((p) => p.email.toLowerCase() === email.toLowerCase())) throw new Error('Email sudah dipakai akun lain');
      if (role === 'ketua_rt') throw new Error('Ketua RT baru ditetapkan lewat perubahan role, bukan akun baru');
      const id = `u-${uid().slice(0, 8)}`;
      d.profiles.push({ id, full_name: res.full_name, phone: res.phone, email, is_active: true, created_at: nowIso() });
      d.memberships.push({ id: `m-${id}`, user_id: id, role, resident_id: res.id, is_active: true });
      res.user_id = id;
      audit(d, me, 'invite_user', 'user_memberships', `m-${id}`, `Membuat akun ${res.full_name} sebagai ${ROLE_LABEL[role]}`);
      return ok(id);
    }, 'users.manage');
  },

  /* ---------------- Pengaturan ---------------- */
  updateNeighborhood(patch: Partial<Database['neighborhood']>) {
    return run((d, me) => {
      required(patch.name ?? d.neighborhood.name, 'Nama lingkungan');
      Object.assign(d.neighborhood, patch);
      audit(d, me, 'update', 'neighborhoods', d.neighborhood.id, 'Memperbarui identitas RT');
      return ok(d.neighborhood);
    }, 'settings.rt');
  },
  updateProfile(patch: { full_name: string; phone: string; email: string }) {
    return run((d, me) => {
      required(patch.full_name, 'Nama');
      const p = d.profiles.find((x) => x.id === me.userId)!;
      Object.assign(p, patch);
      return ok(p);
    });
  },
};

export const monthLabel = (m: number, y: number) => `${MONTHS[m - 1]} ${y}`;
