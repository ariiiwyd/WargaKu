/**
 * Store data aplikasi yang terhubung ke Supabase.
 * - `db` berisi semua data RT yang boleh dilihat akun (dimuat oleh services/loader).
 * - Setiap aksi memanggil Supabase (insert/update dengan RLS atau RPC SECURITY DEFINER),
 *   lalu memuat ulang data. Validasi di sini hanya untuk umpan balik cepat;
 *   aturan sesungguhnya ditegakkan di database (supabase/migrations).
 */
import { create } from 'zustand';
import type {
  Activity, Announcement, AttendanceStatus, ComplaintPriority, ComplaintStatus, Database, DuesType, GuestLog, House, Household,
  PaymentMethod, Resident, Result, Role, SecurityIncident,
} from '@/types/models';
import { can, ROLE_LABEL, type Action } from '@/app/permissions';
import { useAuth } from './auth.store';
import { friendlyError, sb } from '@/lib/supabase';
import { loadDatabase, NoMembershipError } from '@/services/loader';
import { rupiah } from '@/lib/format';
import { meetingUrlError } from '@/lib/meeting';

export type DbStatus = 'idle' | 'loading' | 'ready' | 'error' | 'no-membership';

interface DbState {
  db: Database | null;
  status: DbStatus;
  error: string | null;
  load: (opts?: { silent?: boolean }) => Promise<void>;
  clear: () => void;
}

export interface Actor {
  userId: string;
  role: Role;
  residentId: string | null;
  householdId: string | null;
  name: string;
}

let loadSeq = 0;

export const useDb = create<DbState>()((set, get) => ({
  db: null,
  status: 'idle',
  error: null,
  load: async ({ silent } = {}) => {
    const uid = useAuth.getState().userId;
    if (!uid) return;
    const seq = ++loadSeq;
    if (!silent || !get().db) set({ status: 'loading', error: null });
    try {
      const db = await loadDatabase(uid);
      if (seq === loadSeq) set({ db, status: 'ready', error: null });
    } catch (e) {
      if (seq !== loadSeq) return;
      if (e instanceof NoMembershipError) set({ db: null, status: 'no-membership', error: e.message });
      else if (silent && get().db) console.warn('Gagal memuat ulang data', e);
      else set({ status: 'error', error: friendlyError(e) });
    }
  },
  clear: () => {
    loadSeq++;
    set({ db: null, status: 'idle', error: null });
  },
}));

export function actorOf(db: Database | null): Actor | null {
  const userId = useAuth.getState().userId;
  if (!userId || !db) return null;
  const m = db.memberships.find((x) => x.user_id === userId && x.is_active);
  const p = db.profiles.find((x) => x.id === userId);
  if (!m || !p) return null;
  const res = m.resident_id ? db.residents.find((x) => x.id === m.resident_id) : db.residents.find((x) => x.user_id === userId);
  return { userId, role: m.role, residentId: res?.id ?? null, householdId: res?.household_id ?? null, name: p.full_name };
}

/* ------------------------------------------------------------ helpers */
const ok = <T,>(data: T): Result<T> => ({ ok: true, data });
const fail = (error: string): Result<never> => ({ ok: false, error });

type Ctx = { db: Database; me: Actor; nid: string };

/** Jalankan aksi: cek peran → panggil Supabase → muat ulang data. */
async function run<T>(fn: (ctx: Ctx) => Promise<T>, need?: Action): Promise<Result<T>> {
  const db = useDb.getState().db;
  const me = actorOf(db);
  if (!db || !me) return fail('Sesi berakhir. Silakan masuk kembali.');
  if (need && !can(me.role, need)) return fail(`Role ${ROLE_LABEL[me.role]} tidak berwenang untuk tindakan ini.`);
  try {
    const data = await fn({ db, me, nid: db.neighborhood.id });
    await useDb.getState().load({ silent: true });
    return ok(data);
  } catch (e) {
    return fail(friendlyError(e));
  }
}

async function q<T = unknown>(p: PromiseLike<{ data: unknown; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw error;
  return data as T;
}
const rpc = <T = unknown,>(fn: string, args: Record<string, unknown>) => q<T>(sb().rpc(fn, args));

const required = (v: unknown, label: string) => {
  if (v === undefined || v === null || (typeof v === 'string' && !v.trim())) throw new Error(`${label} wajib diisi`);
};
const blank = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

/* =================================================================== */
/*                               AKSI                                   */
/* =================================================================== */
export const actions = {
  /* ---------------- Warga & keluarga ---------------- */
  saveResident(input: Partial<Resident> & { household_id: string; full_name: string }) {
    return run(async ({ db, nid }) => {
      required(input.full_name, 'Nama lengkap');
      required(input.household_id, 'Keluarga');
      if (input.nik && !/^\d{16}$/.test(input.nik)) throw new Error('NIK harus 16 digit angka');
      const row = {
        household_id: input.household_id, full_name: input.full_name.trim(), nik: blank(input.nik), gender: input.gender ?? 'L',
        birth_place: blank(input.birth_place), birth_date: blank(input.birth_date), family_relationship: blank(input.family_relationship),
        occupation: blank(input.occupation), phone: blank(input.phone), resident_status: input.resident_status ?? 'tetap', joined_at: blank(input.joined_at),
      };
      if (input.id) {
        await q(sb().from('residents').update(row).eq('id', input.id));
        return input.id;
      }
      const created = await q(sb().from('residents').insert({ ...row, neighborhood_id: nid }).select('id').single());
      const id = (created as { id: string }).id;
      const hh = db.households.find((h) => h.id === input.household_id);
      if (hh && !hh.head_resident_id && input.family_relationship === 'Kepala Keluarga') {
        await q(sb().from('households').update({ head_resident_id: id }).eq('id', hh.id));
      }
      return id;
    }, 'residents.manage');
  },

  setResidentStatus(id: string, status: Resident['resident_status']) {
    return run(async () => {
      const active = !['pindah', 'meninggal'].includes(status);
      await q(sb().from('residents').update({
        resident_status: status, is_active: active, left_at: active ? null : new Date().toISOString().slice(0, 10),
      }).eq('id', id));
    }, 'residents.manage');
  },

  /** Rumah baru (opsional langsung dengan KK pertamanya) atau ubah data rumah. */
  saveHouse(input: Partial<House> & { house_number: string; address: string; first_family_card?: string; with_family?: boolean }) {
    return run(async ({ db, nid }) => {
      required(input.house_number, 'Nomor rumah');
      required(input.address, 'Alamat');
      const no = input.house_number.trim();
      if (db.houses.some((o) => o.house_number.toLowerCase() === no.toLowerCase() && o.id !== input.id)) throw new Error(`Nomor rumah ${no} sudah terdaftar`);
      const kk = blank(input.first_family_card);
      if (kk && !/^\d{16}$/.test(kk)) throw new Error('Nomor KK harus 16 digit angka');
      const row = { house_number: no, address: input.address.trim(), ...(input.status ? { status: input.status } : {}) };
      if (input.id) {
        await q(sb().from('houses').update(row).eq('id', input.id));
        return input.id;
      }
      const created = (await q(sb().from('houses').insert({ ...row, neighborhood_id: nid, status: input.with_family ? 'occupied' : 'vacant' }).select('id').single())) as { id: string };
      if (input.with_family) await q(sb().from('households').insert({ neighborhood_id: nid, house_id: created.id, family_card_number: kk }));
      return created.id;
    }, 'households.manage');
  },

  /** KK yang menanggung iuran per rumah. */
  setHouseBilling(houseId: string, householdId: string) {
    return run(() => q(sb().from('houses').update({ billing_household_id: householdId }).eq('id', houseId)), 'households.manage');
  },

  /** Tambah/ubah KK. Nomor rumah & alamat mengikuti rumahnya (diisi database). */
  saveHousehold(input: Partial<Household> & { house_id: string }) {
    return run(async ({ nid }) => {
      required(input.house_id, 'Rumah');
      if (input.family_card_number && !/^\d{16}$/.test(input.family_card_number)) throw new Error('Nomor KK harus 16 digit angka');
      const row = { house_id: input.house_id, family_card_number: blank(input.family_card_number), status: input.status ?? 'active' };
      if (input.id) await q(sb().from('households').update(row).eq('id', input.id));
      else await q(sb().from('households').insert({ ...row, neighborhood_id: nid }));
    }, 'households.manage');
  },

  /* ---------------- Surat ---------------- */
  submitLetter(input: { letter_type_id: string; resident_id: string; purpose: string; form_data: Record<string, string> }) {
    return run(async ({ db, me, nid }) => {
      required(input.letter_type_id, 'Jenis surat');
      required(input.resident_id, 'Pemohon');
      required(input.purpose, 'Keperluan');
      if (input.purpose.trim().length < 10) throw new Error('Jelaskan keperluan minimal 10 karakter');
      const res = db.residents.find((r) => r.id === input.resident_id);
      if (!can(me.role, 'letters.review') && res?.household_id !== me.householdId) throw new Error('Anda hanya dapat mengajukan surat untuk anggota keluarga sendiri');
      const row = await q(sb().from('letter_requests').insert({
        neighborhood_id: nid, letter_type_id: input.letter_type_id, resident_id: input.resident_id, purpose: input.purpose.trim(), form_data: input.form_data,
      }).select('id, request_number').single());
      return row as { id: string; request_number: string };
    }, 'letters.request');
  },
  resubmitLetter(id: string, purpose: string, form_data: Record<string, string>) {
    return run(() => rpc('resubmit_letter_request', { p_request_id: id, p_purpose: purpose, p_form_data: form_data }));
  },
  reviewLetter(id: string, accept: boolean, note: string) {
    return run(async () => {
      if (!accept && !note.trim()) throw new Error('Tulis catatan perbaikan untuk pemohon');
      await rpc('review_letter_request', { p_request_id: id, p_accept: accept, p_note: note.trim() || null });
    }, 'letters.review');
  },
  approveLetter(id: string, approve: boolean, reason: string) {
    return run(async () => {
      if (!approve && !reason.trim()) throw new Error('Alasan penolakan wajib diisi');
      await rpc('approve_letter_request', { p_request_id: id, p_approve: approve, p_reason: reason.trim() || null });
    }, 'letters.approve');
  },
  markLetterDownloaded(id: string) {
    return run(() => rpc('mark_letter_completed', { p_request_id: id }));
  },

  /* ---------------- Iuran & tagihan ---------------- */
  saveDuesType(input: Partial<DuesType> & { name: string; amount: number; billing_period: DuesType['billing_period'] }) {
    return run(async ({ nid }) => {
      required(input.name, 'Nama iuran');
      if (!(input.amount > 0)) throw new Error('Nominal harus lebih dari 0');
      const row = { name: input.name.trim(), amount: input.amount, billing_period: input.billing_period, billing_unit: input.billing_unit ?? 'rumah', description: blank(input.description), is_active: input.is_active ?? true };
      if (input.id) await q(sb().from('dues_types').update(row).eq('id', input.id));
      else await q(sb().from('dues_types').insert({ ...row, neighborhood_id: nid }));
    }, 'dues.manage');
  },

  /** create_invoice per KK tujuan; periode yang sudah ditagih dilewati.
   *  Iuran per rumah: kirim KK penanggung jawab tiap rumah (lihat duesTargets). */
  generateInvoices(input: { dues_type_id: string; month: number | null; year: number; due_date: string; household_ids: string[] }) {
    return run(async ({ db }) => {
      const t = db.duesTypes.find((x) => x.id === input.dues_type_id && x.is_active);
      if (!t) throw new Error('Pilih jenis iuran yang aktif');
      if (t.billing_period === 'bulanan' && !input.month) throw new Error('Iuran bulanan wajib memilih bulan');
      if (!input.household_ids.length) throw new Error('Pilih minimal satu keluarga');
      required(input.due_date, 'Jatuh tempo');
      let created = 0, skipped = 0;
      for (const hh of input.household_ids) {
        const houseId = db.households.find((h) => h.id === hh)?.house_id;
        const dup = db.invoices.some((i) => (t.billing_unit === 'rumah' ? i.house_id === houseId : i.household_id === hh) && i.dues_type_id === t.id && i.period_year === input.year
          && (i.period_month ?? 0) === (t.billing_period === 'bulanan' ? input.month ?? 0 : 0) && i.status !== 'cancelled');
        if (dup) { skipped++; continue; }
        const { error } = await sb().rpc('create_invoice', {
          p_household_id: hh, p_dues_type_id: t.id, p_period_year: input.year, p_period_month: input.month, p_amount: null, p_due_date: input.due_date,
        });
        if (error) {
          if ((error as { code?: string }).code === '23505') { skipped++; continue; }
          throw error;
        }
        created++;
      }
      return { created, skipped };
    }, 'dues.manage');
  },
  cancelInvoice(id: string) {
    return run(() => rpc('cancel_invoice', { p_invoice_id: id }), 'dues.manage');
  },

  /** Upload bukti ke bucket privat → pembayaran berstatus pending (PRD §3.4). */
  submitPayment(input: { invoice_id: string; amount: number; method: PaymentMethod; date: string; note: string; proof: { blob: Blob; ext: string } | null }) {
    return run(async ({ db, me, nid }) => {
      const inv = db.invoices.find((x) => x.id === input.invoice_id);
      if (!inv) throw new Error('Tagihan tidak ditemukan');
      if (inv.household_id !== me.householdId && !can(me.role, 'payments.submitForOthers')) throw new Error('Anda hanya dapat membayar tagihan keluarga sendiri');
      const pending = db.payments.filter((p) => p.invoice_id === inv.id && p.status === 'pending').reduce((s, p) => s + p.amount, 0);
      const remaining = inv.amount - inv.paid_amount - pending;
      if (!(input.amount > 0)) throw new Error('Nominal harus lebih dari 0');
      if (input.amount > remaining) throw new Error(`Nominal melebihi sisa tagihan (${rupiah(Math.max(remaining, 0))})`);
      if (input.method === 'transfer' && !input.proof) throw new Error('Unggah bukti transfer');
      required(input.date, 'Tanggal bayar');
      let proof_path: string | null = null;
      if (input.proof) {
        // Nama file acak (UUID) — tidak memuat NIK, nama, atau nomor rekening (PRD §7.4)
        proof_path = `${nid}/${crypto.randomUUID()}.${input.proof.ext}`;
        const up = await sb().storage.from('payment-proofs').upload(proof_path, input.proof.blob, { contentType: input.proof.blob.type, upsert: false });
        if (up.error) throw up.error;
      }
      await q(sb().from('dues_payments').insert({
        neighborhood_id: nid, invoice_id: inv.id, household_id: inv.household_id, payer_user_id: me.userId, amount: input.amount,
        payment_method: input.method, payment_date: input.date, note: blank(input.note), proof_path,
      }));
    });
  },
  verifyPayment(id: string) {
    return run(() => rpc('verify_dues_payment', { p_payment_id: id }), 'payments.verify');
  },
  rejectPayment(id: string, reason: string) {
    return run(async () => {
      if (!reason.trim()) throw new Error('Alasan penolakan wajib diisi');
      await rpc('reject_dues_payment', { p_payment_id: id, p_reason: reason.trim() });
    }, 'payments.verify');
  },

  /* ---------------- Buku kas ---------------- */
  recordCash(input: { type: 'income' | 'expense'; category_id: string; amount: number; date: string; description: string }) {
    return run(async ({ nid }) => {
      if (!(input.amount > 0)) throw new Error('Nominal harus lebih dari 0');
      required(input.description, 'Keterangan');
      required(input.date, 'Tanggal');
      required(input.category_id, 'Kategori');
      const args = { p_neighborhood_id: nid, p_category_id: input.category_id, p_amount: input.amount, p_date: input.date, p_description: input.description.trim() };
      if (input.type === 'expense') await rpc('record_cash_expense', { ...args, p_proof_path: null });
      else await rpc('record_cash_income', args);
    }, 'cash.manage');
  },
  /** Koreksi = transaksi pembalik; transaksi lama tidak dihapus (PRD §4.3). */
  reverseCash(id: string, reason: string) {
    return run(async () => {
      required(reason, 'Alasan koreksi');
      await rpc('reverse_cash_transaction', { p_tx_id: id, p_reason: reason.trim() });
    }, 'cash.manage');
  },

  /* ---------------- Pengumuman ---------------- */
  saveAnnouncement(input: Partial<Announcement> & { title: string; content: string; category: string }) {
    return run(async ({ nid, me }) => {
      required(input.title, 'Judul');
      required(input.content, 'Isi pengumuman');
      const row = { title: input.title.trim(), content: input.content.trim(), category: input.category, is_pinned: !!input.is_pinned };
      if (input.id) {
        await q(sb().from('announcements').update(row).eq('id', input.id));
        return { id: input.id };
      }
      const created = await q(sb().from('announcements').insert({ ...row, neighborhood_id: nid, status: 'draft', created_by: me.userId }).select('id').single());
      return created as { id: string };
    }, 'announcements.create');
  },
  publishAnnouncement(id: string) {
    return run(() => rpc('publish_announcement', { p_announcement_id: id }), 'announcements.publish');
  },
  archiveAnnouncement(id: string) {
    return run(async () => {
      await q(sb().from('announcements').update({ status: 'archived', is_pinned: false }).eq('id', id));
    }, 'announcements.publish');
  },
  markAnnouncementRead(id: string) {
    const s = useDb.getState().db;
    const uid = useAuth.getState().userId;
    // Sudah tercatat dibaca: jangan memuat ulang seluruh data hanya untuk tidak mengubah apa pun.
    if (s?.announcementReads.some((r) => r.announcement_id === id && r.user_id === uid)) return Promise.resolve(ok(undefined));
    return run(async ({ db, me, nid }) => {
      if (db.announcementReads.some((r) => r.announcement_id === id && r.user_id === me.userId)) return;
      await q(sb().from('announcement_reads').upsert({ neighborhood_id: nid, announcement_id: id, user_id: me.userId }, { onConflict: 'announcement_id,user_id', ignoreDuplicates: true }));
    });
  },

  /* ---------------- Notifikasi ---------------- */
  markNotificationRead(id: string) {
    if (useDb.getState().db?.notifications.find((n) => n.id === id)?.read_at) return Promise.resolve(ok(undefined));
    return run(async ({ db, me }) => {
      if (db.notifications.find((n) => n.id === id)?.read_at) return;
      await q(sb().from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).eq('user_id', me.userId));
    });
  },
  markAllNotificationsRead() {
    return run(async ({ me }) => {
      await q(sb().from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', me.userId).is('read_at', null));
    });
  },

  /* ---------------- Pengaduan ---------------- */
  fileComplaint(input: { category_id: string; title: string; description: string; location: string; priority: ComplaintPriority }) {
    return run(async ({ me, nid }) => {
      required(input.title, 'Judul laporan');
      required(input.description, 'Uraian');
      required(input.category_id, 'Kategori');
      if (!me.residentId) throw new Error('Akun Anda belum terhubung ke data warga. Hubungi Sekretaris RT.');
      const row = await q(sb().from('complaints').insert({
        neighborhood_id: nid, resident_id: me.residentId, category_id: input.category_id, title: input.title.trim(),
        description: input.description.trim(), location: blank(input.location), priority: input.priority, created_by: me.userId,
      }).select('id, ticket_number').single());
      return row as { id: string; ticket_number: string };
    });
  },
  assignComplaint(id: string, assignee: string, note: string) {
    return run(async () => {
      required(assignee, 'Petugas');
      await rpc('assign_complaint', { p_complaint_id: id, p_assignee: assignee, p_note: note.trim() || null });
    }, 'complaints.assign');
  },
  updateComplaint(id: string, status: ComplaintStatus, message: string) {
    return run(async () => {
      if (!message.trim()) throw new Error('Tulis tanggapan untuk pelapor');
      await rpc('update_complaint_status', { p_complaint_id: id, p_status: status, p_message: message.trim() });
    }, 'complaints.handle');
  },

  /* ---------------- Kegiatan ---------------- */
  saveActivity(input: Partial<Activity> & { title: string; start_at: string; location: string; category: Activity['category'] }) {
    return run(async ({ nid, me }) => {
      required(input.title, 'Nama kegiatan');
      required(input.start_at, 'Waktu mulai');
      required(input.location, 'Lokasi');
      if (input.end_at && input.end_at < input.start_at) throw new Error('Waktu selesai harus setelah waktu mulai');
      const mode = input.meeting_mode ?? 'offline';
      if (mode !== 'offline') {
        const err = meetingUrlError(input.meeting_url ?? '');
        if (err) throw new Error(err);
      }
      const row = {
        title: input.title.trim(), category: input.category, location: input.location.trim(), description: blank(input.description),
        start_at: input.start_at, end_at: input.end_at ?? null,
        meeting_mode: mode, meeting_url: mode === 'offline' ? null : input.meeting_url!.trim(),
      };
      if (input.id) await q(sb().from('activities').update(row).eq('id', input.id));
      else await q(sb().from('activities').insert({ ...row, neighborhood_id: nid, created_by: me.userId }));
    }, 'activities.manage');
  },
  /** Catat kehadiran "Hadir online" (RPC join_online_meeting). Tautan dibuka oleh pemanggil. */
  joinOnlineMeeting(activityId: string, residentId?: string) {
    return run(() => rpc<string>('join_online_meeting', { p_activity_id: activityId, p_resident_id: residentId ?? null }));
  },
  /** Bagikan notulen & tautan rekaman ke seluruh warga. */
  publishMinutes(activityId: string, minutes: string, recordingUrl: string) {
    return run(async () => {
      required(minutes, 'Notulen');
      const rec = recordingUrl.trim();
      if (rec && !/^https:\/\//i.test(rec)) throw new Error('Tautan rekaman harus diawali https://');
      await rpc('publish_meeting_minutes', { p_activity_id: activityId, p_minutes: minutes.trim(), p_recording_url: rec || null });
    }, 'activities.manage');
  },
  setActivityStatus(id: string, status: Activity['status']) {
    return run(async () => {
      await q(sb().from('activities').update({ status }).eq('id', id));
    }, 'activities.manage');
  },
  toggleJoin(activityId: string, residentId: string) {
    return run(async ({ db, me, nid }) => {
      const res = db.residents.find((r) => r.id === residentId);
      if (!res || (res.household_id !== me.householdId && !can(me.role, 'activities.manage'))) throw new Error('Hanya untuk anggota keluarga sendiri');
      const a = db.activities.find((x) => x.id === activityId);
      if (a?.status !== 'planned') throw new Error('Pendaftaran kegiatan sudah ditutup');
      const joined = db.participants.some((p) => p.activity_id === activityId && p.resident_id === residentId);
      if (joined) {
        await q(sb().from('activity_participants').delete().eq('activity_id', activityId).eq('resident_id', residentId));
        return false;
      }
      await q(sb().from('activity_participants').insert({ neighborhood_id: nid, activity_id: activityId, resident_id: residentId }));
      return true;
    });
  },
  setAttendance(activityId: string, residentId: string, status: AttendanceStatus) {
    return run(async ({ nid }) => {
      await q(sb().from('activity_participants').upsert({ neighborhood_id: nid, activity_id: activityId, resident_id: residentId, attendance_status: status }, { onConflict: 'activity_id,resident_id' }));
    }, 'activities.manage');
  },

  /* ---------------- Keamanan ---------------- */
  logGuest(input: Omit<GuestLog, 'id' | 'arrival_at' | 'departure_at' | 'recorded_by'>) {
    return run(async ({ nid, me }) => {
      required(input.visitor_name, 'Nama tamu');
      required(input.destination, 'Tujuan');
      await q(sb().from('guest_logs').insert({
        neighborhood_id: nid, visitor_name: input.visitor_name.trim(), destination: input.destination.trim(), visitor_phone: blank(input.visitor_phone),
        purpose: blank(input.purpose), vehicle_plate: blank(input.vehicle_plate), recorded_by: me.userId,
      }));
    }, 'security.manage');
  },
  checkoutGuest(id: string) {
    return run(async () => {
      await q(sb().from('guest_logs').update({ departure_at: new Date().toISOString() }).eq('id', id));
    }, 'security.manage');
  },
  reportIncident(input: Omit<SecurityIncident, 'id' | 'status' | 'reported_by' | 'created_at'>) {
    return run(async ({ nid, me }) => {
      required(input.title, 'Judul kejadian');
      required(input.description, 'Kronologi');
      required(input.incident_date, 'Waktu kejadian');
      await q(sb().from('security_incidents').insert({
        neighborhood_id: nid, title: input.title.trim(), description: input.description.trim(), incident_date: input.incident_date,
        location: blank(input.location), severity: input.severity, reported_by: me.userId,
      }));
    });
  },
  setIncidentStatus(id: string, status: SecurityIncident['status']) {
    return run(async () => {
      await q(sb().from('security_incidents').update({ status }).eq('id', id));
    }, 'security.manage');
  },
  /** Simpan regu (baru/ubah) + anggota, lalu buat jadwal 4 minggu ke depan untuk hari jaganya. */
  savePatrolTeam(input: { id?: string; name: string; weekdays: number[]; leader: string | null; members: string[] }) {
    return run(async ({ nid }) => {
      required(input.name, 'Nama regu');
      if (!input.weekdays.length) throw new Error('Pilih minimal satu hari jaga');
      if (!input.members.length) throw new Error('Pilih minimal satu anggota regu');
      if (input.leader && !input.members.includes(input.leader)) throw new Error('Ketua regu harus termasuk anggota regu');
      const id = await rpc<string>('save_patrol_team', {
        p_neighborhood_id: nid, p_team_id: input.id ?? null, p_name: input.name.trim(), p_weekdays: [...input.weekdays].sort(),
        p_leader: input.leader, p_members: input.members,
      });
      const created = await rpc<number>('generate_patrol_schedules', { p_neighborhood_id: nid, p_from: null, p_weeks: 4 });
      return { id, created };
    }, 'security.manage');
  },
  /** Buat jadwal untuk semua regu aktif; mulai dari tanggal tertentu (default hari ini). */
  generatePatrolSchedules(weeks: number, from?: string) {
    return run(({ nid }) => rpc<number>('generate_patrol_schedules', { p_neighborhood_id: nid, p_from: from ?? null, p_weeks: weeks }), 'security.manage');
  },
  deactivatePatrolTeam(id: string) {
    return run(() => rpc('deactivate_patrol_team', { p_team_id: id }), 'security.manage');
  },
  submitPatrolReport(scheduleId: string, status: 'aman' | 'ada_kejadian' | 'tidak_terlaksana', report: string) {
    return run(async ({ nid, me }) => {
      required(report, 'Catatan ronda');
      await q(sb().from('patrol_reports').insert({ neighborhood_id: nid, schedule_id: scheduleId, status, report: report.trim(), submitted_by: me.userId }));
    }, 'security.manage');
  },

  /* ---------------- Pengguna & role ---------------- */
  assignRole(userId: string, role: Role) {
    return run(async ({ db, me, nid }) => {
      if (userId === me.userId && role !== 'ketua_rt') throw new Error('Ketua RT tidak dapat menurunkan role dirinya sendiri');
      if (role === 'ketua_rt' && db.memberships.some((x) => x.role === 'ketua_rt' && x.is_active && x.user_id !== userId))
        throw new Error('Hanya boleh ada satu Ketua RT aktif. Ubah role Ketua RT saat ini terlebih dahulu.');
      await rpc('assign_member_role', { p_neighborhood_id: nid, p_user: userId, p_role: role, p_resident: null });
    }, 'users.manage');
  },
  setUserActive(userId: string, active: boolean) {
    return run(async ({ me, nid }) => {
      if (userId === me.userId) throw new Error('Tidak dapat menonaktifkan akun sendiri');
      await rpc('set_member_active', { p_neighborhood_id: nid, p_user: userId, p_active: active });
    }, 'users.manage');
  },
  /** Undangan akun lewat Edge Function invite-user (memakai service role di server). */
  createAccount(residentId: string, role: Role, email: string) {
    return run(async () => {
      required(residentId, 'Warga');
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Format email tidak valid');
      if (role === 'ketua_rt') throw new Error('Ketua RT baru ditetapkan lewat perubahan role, bukan akun baru');
      const { data, error } = await sb().functions.invoke('invite-user', { body: { residentId, role, email: email.trim() } });
      if (error) {
        const ctx = (error as { context?: Response }).context;
        const body = ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) : null;
        throw new Error(body?.error ?? 'Gagal membuat akun. Pastikan Edge Function invite-user sudah di-deploy.');
      }
      return data as { userId: string; emailSent: boolean; emailError: string | null };
    }, 'users.manage');
  },

  /* ---------------- Pengaturan ---------------- */
  updateNeighborhood(patch: Partial<Database['neighborhood']>) {
    return run(async ({ nid }) => {
      required(patch.name, 'Nama lingkungan');
      const { bank_name, bank_account_name, bank_account_number, id: _id, ...rest } = patch;
      void _id;
      await q(sb().from('neighborhoods').update(rest).eq('id', nid));
      await q(sb().from('rt_settings').upsert(
        { neighborhood_id: nid, setting_key: 'bank_account', setting_value: { bank: bank_name ?? '', name: bank_account_name ?? '', number: bank_account_number ?? '' } },
        { onConflict: 'neighborhood_id,setting_key' },
      ));
    }, 'settings.rt');
  },
  updateProfile(patch: { full_name: string; phone: string }) {
    return run(async ({ me }) => {
      required(patch.full_name, 'Nama');
      await q(sb().from('profiles').update({ full_name: patch.full_name.trim(), phone: blank(patch.phone) }).eq('id', me.userId));
    });
  },
};
