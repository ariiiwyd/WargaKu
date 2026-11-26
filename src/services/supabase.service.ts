/**
 * Lapisan layanan Supabase (siap disambungkan). Saat ini tampilan memakai
 * store demo (src/stores/db.store.ts) yang meniru aturan yang sama. Untuk
 * produksi, ganti pemanggilan `actions.*` di halaman dengan fungsi di bawah.
 *
 * CRUD biasa → Supabase client + RLS.
 * Operasi sensitif → RPC SECURITY DEFINER (supabase/migrations/*_rpc.sql).
 */
import { supabase } from '@/lib/supabase';

function db() {
  if (!supabase) throw new Error('Supabase belum dikonfigurasi (.env)');
  return supabase;
}
async function rpc<T>(fn: string, args: Record<string, unknown>) {
  const { data, error } = await db().rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

/* ---------------- auth ---------------- */
export const authService = {
  signIn: (email: string, password: string) => db().auth.signInWithPassword({ email, password }),
  signOut: () => db().auth.signOut(),
  session: () => db().auth.getSession(),
  /** Membership aktif + role untuk akun yang sedang login */
  membership: async () => {
    const { data: u } = await db().auth.getUser();
    if (!u.user) return null;
    const { data, error } = await db().from('user_memberships').select('id, role, neighborhood_id, resident_id, is_active').eq('user_id', u.user.id).eq('is_active', true).maybeSingle();
    if (error) throw error;
    return data;
  },
};

/* ---------------- keuangan ---------------- */
export const paymentsService = {
  verify: (paymentId: string) => rpc('verify_dues_payment', { p_payment_id: paymentId }),
  reject: (paymentId: string, reason: string) => rpc('reject_dues_payment', { p_payment_id: paymentId, p_reason: reason }),
  /** Upload bukti ke bucket privat lalu buat pembayaran pending (RLS memaksa status pending). */
  submit: async (o: { neighborhoodId: string; invoiceId: string; householdId: string; amount: number; method: 'transfer' | 'tunai'; date: string; file?: File }) => {
    let proof_path: string | null = null;
    if (o.file) {
      const ext = o.file.name.split('.').pop() ?? 'jpg';
      proof_path = `${o.neighborhoodId}/${crypto.randomUUID()}.${ext}`; // tanpa NIK/no. rekening di nama file
      const up = await db().storage.from('payment-proofs').upload(proof_path, o.file, { upsert: false });
      if (up.error) throw up.error;
    }
    const { data, error } = await db().from('dues_payments').insert({
      neighborhood_id: o.neighborhoodId, invoice_id: o.invoiceId, household_id: o.householdId,
      amount: o.amount, payment_method: o.method, payment_date: o.date, proof_path,
    }).select().single();
    if (error) throw error;
    return data;
  },
};

export const cashService = {
  balance: (neighborhoodId: string) => rpc<{ total_income: number; total_expense: number; balance: number }[]>('public_cash_summary', { p_neighborhood_id: neighborhoodId }),
  recordExpense: (o: { neighborhoodId: string; categoryId: string; amount: number; date: string; description: string; proofPath?: string }) =>
    rpc('record_cash_expense', { p_neighborhood_id: o.neighborhoodId, p_category_id: o.categoryId, p_amount: o.amount, p_date: o.date, p_description: o.description, p_proof_path: o.proofPath ?? null }),
  reverse: (txId: string, reason: string) => rpc('reverse_cash_transaction', { p_tx_id: txId, p_reason: reason }),
};

export const duesService = {
  createInvoice: (o: { householdId: string; duesTypeId: string; year: number; month?: number; dueDate?: string }) =>
    rpc('create_invoice', { p_household_id: o.householdId, p_dues_type_id: o.duesTypeId, p_period_year: o.year, p_period_month: o.month ?? null, p_amount: null, p_due_date: o.dueDate ?? null }),
};

/* ---------------- surat ---------------- */
export const lettersService = {
  review: (id: string, accept: boolean, note?: string) => rpc('review_letter_request', { p_request_id: id, p_accept: accept, p_note: note ?? null }),
  approve: (id: string, approve: boolean, reason?: string) => rpc('approve_letter_request', { p_request_id: id, p_approve: approve, p_reason: reason ?? null }),
};

/* ---------------- komunikasi & role ---------------- */
export const announcementsService = { publish: (id: string) => rpc('publish_announcement', { p_announcement_id: id }) };
export const complaintsService = {
  assign: (id: string, assignee: string, note?: string) => rpc('assign_complaint', { p_complaint_id: id, p_assignee: assignee, p_note: note ?? null }),
  update: (id: string, status: string, message: string) => rpc('update_complaint_status', { p_complaint_id: id, p_status: status, p_message: message }),
};
export const usersService = {
  assignRole: (neighborhoodId: string, userId: string, role: string) => rpc('assign_member_role', { p_neighborhood_id: neighborhoodId, p_user: userId, p_role: role, p_resident: null }),
  setActive: (neighborhoodId: string, userId: string, active: boolean) => rpc('set_member_active', { p_neighborhood_id: neighborhoodId, p_user: userId, p_active: active }),
};
