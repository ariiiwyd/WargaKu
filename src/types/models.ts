/* Model data WargaKu — padanan tabel Supabase (supabase/migrations). */

export type Role = 'ketua_rt' | 'sekretaris' | 'bendahara' | 'pengurus' | 'warga';
export type ResidentStatus = 'tetap' | 'kontrak' | 'pendatang' | 'pindah' | 'meninggal';
export type InvoiceStatus = 'unpaid' | 'partial' | 'paid' | 'cancelled';
export type PaymentStatus = 'pending' | 'verified' | 'rejected';
export type PaymentMethod = 'transfer' | 'tunai';
export type TxType = 'income' | 'expense';
export type RequestStatus = 'submitted' | 'review' | 'revision' | 'approved' | 'rejected' | 'completed';
export type BillingPeriod = 'bulanan' | 'tahunan' | 'sekali' | 'insidental';
export type ComplaintStatus = 'submitted' | 'assigned' | 'in_progress' | 'resolved' | 'closed';
export type ComplaintPriority = 'rendah' | 'normal' | 'tinggi' | 'darurat';
export type AnnouncementStatus = 'draft' | 'published' | 'archived';
export type ActivityStatus = 'planned' | 'ongoing' | 'done' | 'cancelled';
export type AttendanceStatus = 'registered' | 'present' | 'absent' | 'excused';
export type ThemePref = 'light' | 'dark' | 'system';

export interface Neighborhood {
  id: string;
  name: string;
  rt_number: string;
  rw_number: string;
  village: string;
  district: string;
  city: string;
  province: string;
  postal_code: string;
  address: string;
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
}

export interface Profile {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

export interface Membership {
  id: string;
  user_id: string;
  role: Role;
  resident_id: string | null;
  is_active: boolean;
}

export interface Household {
  id: string;
  house_number: string;
  address: string;
  head_resident_id: string | null;
  family_card_number: string;
  status: 'active' | 'vacant' | 'inactive';
  created_at: string;
}

export interface Resident {
  id: string;
  household_id: string;
  user_id: string | null;
  nik: string;
  full_name: string;
  gender: 'L' | 'P';
  birth_place: string;
  birth_date: string;
  family_relationship: string;
  occupation: string;
  phone: string;
  resident_status: ResidentStatus;
  is_active: boolean;
  joined_at: string;
  left_at: string | null;
  created_at: string;
}

export interface LetterType {
  id: string;
  code: string;
  name: string;
  description: string;
  is_active: boolean;
}

export interface LetterHistory {
  status: RequestStatus;
  note: string | null;
  by: string;
  at: string;
}

export interface LetterRequest {
  id: string;
  resident_id: string;
  letter_type_id: string;
  request_number: string;
  purpose: string;
  form_data: Record<string, string>;
  status: RequestStatus;
  reviewed_by: string | null;
  review_note: string | null;
  approved_by: string | null;
  letter_number: string | null;
  rejection_reason: string | null;
  created_by: string;
  created_at: string;
  completed_at: string | null;
  history: LetterHistory[];
}

export interface DuesType {
  id: string;
  name: string;
  description: string;
  amount: number;
  billing_period: BillingPeriod;
  is_active: boolean;
}

export interface Invoice {
  id: string;
  household_id: string;
  dues_type_id: string;
  invoice_number: string;
  period_month: number | null;
  period_year: number;
  amount: number;
  paid_amount: number;
  status: InvoiceStatus;
  due_date: string;
  created_at: string;
}

export interface Payment {
  id: string;
  invoice_id: string;
  household_id: string;
  payer_user_id: string;
  reference_code: string;
  amount: number;
  payment_method: PaymentMethod;
  proof_name: string | null;
  proof_data: string | null; // data URL (mode demo saja)
  payment_date: string;
  note: string;
  status: PaymentStatus;
  verified_by: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
  created_at: string;
}

export interface CashCategory {
  id: string;
  name: string;
  transaction_type: TxType;
}

export interface CashTransaction {
  id: string;
  category_id: string | null;
  payment_id: string | null;
  reverses_id: string | null;
  transaction_number: string;
  transaction_type: TxType;
  amount: number;
  transaction_date: string;
  description: string;
  recorded_by: string;
  created_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  category: string;
  status: AnnouncementStatus;
  is_pinned: boolean;
  published_at: string | null;
  created_by: string;
  created_at: string;
}

export interface AnnouncementRead {
  announcement_id: string;
  user_id: string;
  read_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'invoice' | 'payment' | 'letter' | 'announcement' | 'complaint' | 'activity' | 'security' | 'system';
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface ComplaintCategory {
  id: string;
  name: string;
}

export interface ComplaintUpdate {
  status: ComplaintStatus;
  message: string;
  by: string;
  at: string;
}

export interface Complaint {
  id: string;
  ticket_number: string;
  resident_id: string;
  category_id: string;
  title: string;
  description: string;
  location: string;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  assigned_to: string | null;
  created_by: string;
  created_at: string;
  completed_at: string | null;
  updates: ComplaintUpdate[];
}

export interface Activity {
  id: string;
  title: string;
  category: 'kerja_bakti' | 'rapat' | 'sosial' | 'keagamaan' | 'olahraga' | 'lainnya';
  description: string;
  location: string;
  start_at: string;
  end_at: string | null;
  status: ActivityStatus;
  created_by: string;
  created_at: string;
}

export interface ActivityParticipant {
  activity_id: string;
  resident_id: string;
  attendance_status: AttendanceStatus;
  registered_at: string;
}

export interface PatrolTeam {
  id: string;
  name: string;
  leader_resident_id: string;
  member_ids: string[];
  weekdays: number[]; // 0 = Minggu
}

export interface PatrolSchedule {
  id: string;
  team_id: string;
  patrol_date: string;
  start_time: string;
  end_time: string;
}

export interface PatrolReport {
  id: string;
  schedule_id: string;
  report: string;
  status: 'aman' | 'ada_kejadian' | 'tidak_terlaksana';
  submitted_by: string;
  created_at: string;
}

export interface SecurityIncident {
  id: string;
  title: string;
  description: string;
  incident_date: string;
  location: string;
  severity: 'rendah' | 'sedang' | 'tinggi';
  status: 'open' | 'handled' | 'closed';
  reported_by: string;
  created_at: string;
}

export interface GuestLog {
  id: string;
  visitor_name: string;
  visitor_phone: string;
  destination: string;
  purpose: string;
  vehicle_plate: string;
  arrival_at: string;
  departure_at: string | null;
  recorded_by: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  summary: string;
  created_at: string;
}

export interface ResidentHistory {
  id: string;
  resident_id: string;
  change_type: string;
  summary: string;
  changed_by: string;
  created_at: string;
}

export interface Counters {
  [key: string]: number;
}

export interface Database {
  version: number;
  neighborhood: Neighborhood;
  profiles: Profile[];
  memberships: Membership[];
  households: Household[];
  residents: Resident[];
  residentHistory: ResidentHistory[];
  letterTypes: LetterType[];
  letters: LetterRequest[];
  duesTypes: DuesType[];
  invoices: Invoice[];
  payments: Payment[];
  cashCategories: CashCategory[];
  cash: CashTransaction[];
  announcements: Announcement[];
  announcementReads: AnnouncementRead[];
  notifications: Notification[];
  complaintCategories: ComplaintCategory[];
  complaints: Complaint[];
  activities: Activity[];
  participants: ActivityParticipant[];
  patrolTeams: PatrolTeam[];
  patrolSchedules: PatrolSchedule[];
  patrolReports: PatrolReport[];
  incidents: SecurityIncident[];
  guests: GuestLog[];
  audit: AuditLog[];
  counters: Counters;
}

export type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };
