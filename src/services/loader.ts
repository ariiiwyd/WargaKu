/**
 * Memuat seluruh data RT yang boleh dilihat akun yang sedang masuk.
 * RLS di database yang menentukan baris mana yang kembali; loader hanya
 * memilih sumber yang tepat per peran (mis. view tanpa NIK/KK untuk
 * Bendahara/Pengurus) lalu memetakannya ke model aplikasi.
 * Satu RT = ratusan baris, jadi dimuat sekaligus dan dimuat ulang setelah aksi.
 */
import { sb } from '@/lib/supabase';
import type {
  AuditLog, Database, House, Household, LetterHistory, Membership, Notification, PatrolTeam, Profile, Resident, Role,
} from '@/types/models';

export class NoMembershipError extends Error {
  constructor() {
    super('Akun Anda belum terdaftar sebagai anggota RT atau sudah dinonaktifkan. Hubungi Ketua RT.');
  }
}

type Row = Record<string, unknown>;
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));

async function rows<T = Row>(p: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const { data, error } = await p;
  if (error) throw error;
  return (data as T[]) ?? [];
}

const LINK: Record<Notification['type'], string | null> = {
  invoice: '/iuran', payment: '/iuran', letter: '/surat', announcement: '/pengumuman', complaint: '/pengaduan',
  activity: '/kegiatan', security: '/keamanan', system: null,
};

const ACTION_LABEL: Record<string, string> = {
  insert: 'Menambahkan', update: 'Memperbarui', delete: 'Menghapus', verify_payment: 'Memverifikasi pembayaran',
  reject_payment: 'Menolak pembayaran', record_expense: 'Mencatat pengeluaran', record_income: 'Mencatat pemasukan',
  reverse_transaction: 'Membuat transaksi pembalik', create_invoice: 'Membuat tagihan', cancel_invoice: 'Membatalkan tagihan',
  publish_announcement: 'Memublikasikan pengumuman', invite_user: 'Membuat akun', reset_mfa: 'Mereset verifikasi 2 langkah', approve_letter: 'Menyetujui surat',
};
const TABLE_LABEL: Record<string, string> = {
  residents: 'data warga', households: 'data keluarga', user_memberships: 'keanggotaan/role', dues_types: 'jenis iuran',
  dues_invoices: 'tagihan', dues_payments: 'pembayaran', cash_transactions: 'buku kas', letter_requests: 'permohonan surat',
  announcements: 'pengumuman', complaints: 'pengaduan', neighborhoods: 'identitas RT',
};

function describe(action: string, table: string, nd: Row | null): string {
  const d = nd ?? {};
  const name = str(d.full_name || d.title || d.invoice_number || d.transaction_number || d.request_number || d.name || d.house_number);
  const amount = d.amount ? ` (Rp${Number(d.amount).toLocaleString('id-ID')})` : '';
  if (table === 'user_memberships' && d.role) return `${ACTION_LABEL[action] ?? 'Mengubah'} ${TABLE_LABEL[table]} → ${str(d.role)}`;
  if (table === 'letter_requests' && action === 'update' && d.letter_number) return `Surat ${str(d.request_number)} → ${str(d.letter_number)} (${str(d.status)})`;
  return `${ACTION_LABEL[action] ?? action} ${TABLE_LABEL[table] ?? table}${name ? ` ${name}` : ''}${amount}`.trim();
}

function diffSummary(change: string, oldD: Row | null, newD: Row | null): string {
  if (change === 'insert') return 'Data warga ditambahkan';
  if (!oldD || !newD) return 'Memperbarui data';
  const skip = new Set(['updated_at', 'created_at', 'nik']);
  const keys = Object.keys(newD).filter((k) => !skip.has(k) && JSON.stringify(newD[k]) !== JSON.stringify(oldD[k]));
  return keys.length ? `Mengubah ${keys.join(', ')}` : 'Memperbarui data';
}

export async function loadDatabase(userId: string): Promise<Database> {
  const c = sb();
  const { data: m, error: mErr } = await c.from('user_memberships').select('*').eq('user_id', userId).eq('is_active', true).maybeSingle();
  if (mErr) throw mErr;
  if (!m) throw new NoMembershipError();
  const nid = m.neighborhood_id as string;
  const role = m.role as Role;
  const adm = role === 'ketua_rt' || role === 'sekretaris';
  const staff = role !== 'warga';
  const byNid = (t: string, cols = '*') => c.from(t).select(cols).eq('neighborhood_id', nid);

  const housesP = rows(byNid('houses').order('house_number'));
  const [
    nb, settings, names, mems, profs, hhs, residentsFull, residentsDir, rHist, lTypes, letters, lHist, dTypes, invoices,
    payments, cats, cash, pubCash, anns, reads, notifs, cCats, complaints, cUpd, acts, parts, teams, tMembers, sched,
    reports, incidents, guests, audit,
  ] = await Promise.all([
    c.from('neighborhoods').select('*').eq('id', nid).single().then((r) => { if (r.error) throw r.error; return r.data as Row; }),
    rows(byNid('rt_settings')),
    rows(c.rpc('member_names', { p_neighborhood_id: nid })),
    role === 'ketua_rt' ? rows(byNid('user_memberships')) : Promise.resolve([m as Row]),
    staff ? rows(c.from('profiles').select('*')) : rows(c.from('profiles').select('*').eq('id', userId)),
    rows(adm || !staff ? byNid('households') : byNid('households_safe')),
    rows(byNid('residents')),
    staff && !adm ? rows(byNid('residents_directory')) : Promise.resolve([] as Row[]),
    adm ? rows(byNid('resident_history').order('created_at', { ascending: false }).limit(500)) : Promise.resolve([] as Row[]),
    rows(byNid('letter_types').order('code')),
    rows(byNid('letter_requests').order('created_at', { ascending: false })),
    rows(byNid('letter_request_history').order('created_at')),
    rows(byNid('dues_types').order('name')),
    rows(byNid('dues_invoices').order('created_at')),
    rows(byNid('dues_payments').order('created_at', { ascending: false })),
    rows(byNid('cash_categories').order('name')),
    rows(byNid('cash_transactions').order('transaction_date')),
    rows(c.rpc('public_cash_summary', { p_neighborhood_id: nid })),
    rows(byNid('announcements').order('created_at', { ascending: false })),
    rows(byNid('announcement_reads')),
    rows(c.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(100)),
    rows(byNid('complaint_categories').order('name')),
    rows(byNid('complaints').order('created_at', { ascending: false })),
    rows(byNid('complaint_updates').order('created_at')),
    rows(byNid('activities').order('start_at')),
    rows(byNid('activity_participants')),
    rows(byNid('patrol_teams').order('name')),
    rows(byNid('patrol_members')),
    rows(byNid('patrol_schedules').order('patrol_date')),
    rows(byNid('patrol_reports')),
    rows(byNid('security_incidents').order('incident_date', { ascending: false })),
    rows(byNid('guest_logs').order('arrival_at', { ascending: false }).limit(200)),
    rows(byNid('audit_logs').order('created_at', { ascending: false }).limit(300)),
  ]);

  const setting = (k: string) => settings.find((s) => s.setting_key === k)?.setting_value as Row | undefined;
  const bank = setting('bank_account') ?? {};

  // Profil: nama semua anggota dari member_names, ditimpa detail profil yang boleh dibaca.
  const profMap = new Map<string, Profile>();
  for (const n of names) profMap.set(str(n.user_id), { id: str(n.user_id), full_name: str(n.full_name), phone: '', email: '', is_active: !!n.is_active, created_at: '' });
  for (const p of profs) profMap.set(str(p.id), { id: str(p.id), full_name: str(p.full_name), phone: str(p.phone), email: str(p.email), is_active: !!p.is_active, created_at: str(p.created_at) });

  const memberships: Membership[] = role === 'ketua_rt'
    ? mems.map((x) => ({ id: str(x.id), user_id: str(x.user_id), role: x.role as Role, resident_id: (x.resident_id as string) ?? null, is_active: !!x.is_active }))
    : names.map((n) => ({
        id: `m-${str(n.user_id)}`, user_id: str(n.user_id), role: n.role as Role, is_active: !!n.is_active,
        resident_id: n.user_id === userId ? ((m.resident_id as string) ?? null) : null,
      }));

  const residentMap = new Map<string, Resident>();
  for (const r of residentsDir) residentMap.set(str(r.id), {
    id: str(r.id), household_id: str(r.household_id), user_id: null, nik: '', full_name: str(r.full_name), gender: (r.gender as 'L' | 'P') ?? 'L',
    birth_place: '', birth_date: '', family_relationship: '', occupation: '', phone: str(r.phone), resident_status: r.resident_status as Resident['resident_status'],
    is_active: !!r.is_active, joined_at: '', left_at: null, created_at: '',
  });
  for (const r of residentsFull) residentMap.set(str(r.id), {
    id: str(r.id), household_id: str(r.household_id), user_id: (r.user_id as string) ?? null, nik: str(r.nik), full_name: str(r.full_name),
    gender: (r.gender as 'L' | 'P') ?? 'L', birth_place: str(r.birth_place), birth_date: str(r.birth_date), family_relationship: str(r.family_relationship),
    occupation: str(r.occupation), phone: str(r.phone), resident_status: r.resident_status as Resident['resident_status'], is_active: !!r.is_active,
    joined_at: str(r.joined_at), left_at: (r.left_at as string) ?? null, created_at: str(r.created_at),
  });

  const houses: House[] = (await housesP).map((o) => ({
    id: str(o.id), house_number: str(o.house_number), address: str(o.address), status: (o.status as House['status']) ?? 'occupied',
    billing_household_id: (o.billing_household_id as string) ?? null, created_at: str(o.created_at),
  }));
  const households: Household[] = hhs.map((h) => ({
    id: str(h.id), house_id: str(h.house_id), house_number: str(h.house_number), address: str(h.address), head_resident_id: (h.head_resident_id as string) ?? null,
    family_card_number: str(h.family_card_number), status: h.status === 'inactive' ? 'inactive' : 'active', created_at: str(h.created_at),
  }));

  const histBy = new Map<string, LetterHistory[]>();
  for (const h of lHist) {
    const k = str(h.request_id);
    histBy.set(k, [...(histBy.get(k) ?? []), { status: h.status as LetterHistory['status'], note: (h.note as string) ?? null, by: str(h.changed_by), at: str(h.created_at) }]);
  }
  const updBy = new Map<string, { status: never; message: string; by: string; at: string }[]>();
  for (const u of cUpd) {
    const k = str(u.complaint_id);
    updBy.set(k, [...(updBy.get(k) ?? []), { status: u.status as never, message: str(u.message), by: str(u.updated_by), at: str(u.created_at) }]);
  }
  const teamMembers = new Map<string, string[]>();
  for (const t of tMembers) teamMembers.set(str(t.team_id), [...(teamMembers.get(str(t.team_id)) ?? []), str(t.resident_id)]);

  const pc = pubCash[0];
  return {
    version: 1,
    neighborhood: {
      id: nid, name: str(nb.name), rt_number: str(nb.rt_number), rw_number: str(nb.rw_number), village: str(nb.village), district: str(nb.district),
      city: str(nb.city), province: str(nb.province), postal_code: str(nb.postal_code), address: str(nb.address),
      bank_name: str(bank.bank), bank_account_name: str(bank.name), bank_account_number: str(bank.number),
    },
    profiles: [...profMap.values()],
    memberships,
    houses,
    households,
    residents: [...residentMap.values()],
    residentHistory: rHist.map((h) => ({
      id: str(h.id), resident_id: str(h.resident_id), change_type: str(h.change_type), changed_by: str(h.changed_by), created_at: str(h.created_at),
      summary: diffSummary(str(h.change_type), h.old_data as Row | null, h.new_data as Row | null),
    })),
    letterTypes: lTypes.map((t) => ({ id: str(t.id), code: str(t.code), name: str(t.name), description: str(t.description), is_active: !!t.is_active })),
    letters: letters.map((l) => ({
      id: str(l.id), resident_id: str(l.resident_id), letter_type_id: str(l.letter_type_id), request_number: str(l.request_number), purpose: str(l.purpose),
      form_data: (l.form_data as Record<string, string>) ?? {}, status: l.status as never, reviewed_by: (l.reviewed_by as string) ?? null,
      review_note: (l.review_note as string) ?? null, approved_by: (l.approved_by as string) ?? null, letter_number: (l.letter_number as string) ?? null,
      rejection_reason: (l.rejection_reason as string) ?? null, created_by: str(l.created_by), created_at: str(l.created_at),
      completed_at: (l.completed_at as string) ?? (l.approved_at as string) ?? null, history: histBy.get(str(l.id)) ?? [],
    })),
    duesTypes: dTypes.map((t) => ({ id: str(t.id), name: str(t.name), description: str(t.description), amount: num(t.amount), billing_period: t.billing_period as never, billing_unit: t.billing_unit === 'kk' ? 'kk' : 'rumah', is_active: !!t.is_active })),
    invoices: invoices.map((i) => ({
      id: str(i.id), household_id: str(i.household_id), house_id: (i.house_id as string) ?? null, dues_type_id: str(i.dues_type_id), invoice_number: str(i.invoice_number),
      period_month: (i.period_month as number) ?? null, period_year: num(i.period_year), amount: num(i.amount), paid_amount: num(i.paid_amount),
      status: i.status as never, due_date: str(i.due_date), created_at: str(i.created_at),
    })),
    payments: payments.map((p) => ({
      id: str(p.id), invoice_id: str(p.invoice_id), household_id: str(p.household_id), payer_user_id: str(p.payer_user_id), reference_code: str(p.reference_code),
      amount: num(p.amount), payment_method: p.payment_method as never, proof_path: (p.proof_path as string) ?? null, payment_date: str(p.payment_date),
      note: str(p.note), status: p.status as never, verified_by: (p.verified_by as string) ?? null, verified_at: (p.verified_at as string) ?? null,
      rejection_reason: (p.rejection_reason as string) ?? null, created_at: str(p.created_at),
    })),
    cashCategories: cats.map((x) => ({ id: str(x.id), name: str(x.name), transaction_type: x.transaction_type as never })),
    cash: cash.map((t) => ({
      id: str(t.id), category_id: (t.category_id as string) ?? null, payment_id: (t.payment_id as string) ?? null, reverses_id: (t.reverses_id as string) ?? null,
      transaction_number: str(t.transaction_number), transaction_type: t.transaction_type as never, amount: num(t.amount), transaction_date: str(t.transaction_date),
      description: str(t.description), recorded_by: str(t.recorded_by), created_at: str(t.created_at),
    })),
    announcements: anns.map((a) => ({
      id: str(a.id), title: str(a.title), content: str(a.content), category: str(a.category), status: a.status as never, is_pinned: !!a.is_pinned,
      published_at: (a.published_at as string) ?? null, created_by: str(a.created_by), created_at: str(a.created_at),
    })),
    announcementReads: reads.map((r) => ({ announcement_id: str(r.announcement_id), user_id: str(r.user_id), read_at: str(r.read_at) })),
    notifications: notifs.map((n) => {
      const type = (str(n.type) || 'system') as Notification['type'];
      return { id: str(n.id), user_id: str(n.user_id), title: str(n.title), message: str(n.message), type: LINK[type] !== undefined ? type : 'system', link: LINK[type] ?? null, read_at: (n.read_at as string) ?? null, created_at: str(n.created_at) };
    }),
    complaintCategories: cCats.map((x) => ({ id: str(x.id), name: str(x.name) })),
    complaints: complaints.map((x) => ({
      id: str(x.id), ticket_number: str(x.ticket_number), resident_id: str(x.resident_id), category_id: str(x.category_id), title: str(x.title),
      description: str(x.description), location: str(x.location), priority: x.priority as never, status: x.status as never,
      assigned_to: (x.assigned_to as string) ?? null, created_by: str(x.created_by), created_at: str(x.created_at),
      completed_at: (x.completed_at as string) ?? null, updates: updBy.get(str(x.id)) ?? [],
    })),
    activities: acts.map((a) => ({
      id: str(a.id), title: str(a.title), category: (str(a.category) || 'lainnya') as never, description: str(a.description), location: str(a.location),
      start_at: str(a.start_at), end_at: (a.end_at as string) ?? null, status: a.status as never, created_by: str(a.created_by), created_at: str(a.created_at),
      meeting_mode: ((a.meeting_mode as string) ?? 'offline') as never, meeting_url: (a.meeting_url as string) ?? null,
      recording_url: (a.recording_url as string) ?? null, minutes: (a.minutes as string) ?? null,
      minutes_published_at: (a.minutes_published_at as string) ?? null,
    })),
    participants: parts.map((p) => ({ activity_id: str(p.activity_id), resident_id: str(p.resident_id), attendance_status: p.attendance_status as never, registered_at: str(p.registered_at) })),
    patrolTeams: teams.map((t): PatrolTeam => ({
      id: str(t.id), name: str(t.name), leader_resident_id: str(t.leader_resident_id), member_ids: teamMembers.get(str(t.id)) ?? [],
      weekdays: ((t.weekdays as number[]) ?? []).map(Number), is_active: t.is_active !== false,
    })),
    patrolSchedules: sched.map((s) => ({ id: str(s.id), team_id: str(s.team_id), patrol_date: str(s.patrol_date), start_time: str(s.start_time).slice(0, 5), end_time: str(s.end_time).slice(0, 5) })),
    patrolReports: reports.map((r) => ({ id: str(r.id), schedule_id: str(r.schedule_id), report: str(r.report), status: r.status as never, submitted_by: str(r.submitted_by), created_at: str(r.created_at) })),
    incidents: incidents.map((i) => ({
      id: str(i.id), title: str(i.title), description: str(i.description), incident_date: str(i.incident_date), location: str(i.location),
      severity: i.severity as never, status: i.status as never, reported_by: str(i.reported_by), created_at: str(i.created_at),
    })),
    guests: guests.map((g) => ({
      id: str(g.id), visitor_name: str(g.visitor_name), visitor_phone: str(g.visitor_phone), destination: str(g.destination), purpose: str(g.purpose),
      vehicle_plate: str(g.vehicle_plate), arrival_at: str(g.arrival_at), departure_at: (g.departure_at as string) ?? null, recorded_by: str(g.recorded_by),
    })),
    audit: audit.map((a): AuditLog => ({
      id: str(a.id), user_id: (a.user_id as string) ?? null, action: str(a.action), table_name: str(a.table_name), record_id: (a.record_id as string) ?? null,
      created_at: str(a.created_at), summary: describe(str(a.action), str(a.table_name), (a.new_data as Row) ?? null),
    })),
    counters: {},
    publicCash: pc ? { income: num(pc.total_income), expense: num(pc.total_expense), balance: num(pc.balance) } : null,
  };
}
