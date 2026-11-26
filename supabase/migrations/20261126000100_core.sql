-- =====================================================================
-- WargaKu · Migration 0001 · Core schema
-- Semua tabel operasional memiliki neighborhood_id. Relasi lintas tabel
-- memakai composite foreign key (neighborhood_id, id) supaya data dari RT
-- berbeda tidak bisa saling terhubung (PRD §6.4).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Enums ----------------------------------------------------
create type public.app_role as enum ('ketua_rt','sekretaris','bendahara','pengurus','warga');
create type public.resident_status as enum ('tetap','kontrak','pendatang','pindah','meninggal');
create type public.invoice_status as enum ('unpaid','partial','paid','cancelled');
create type public.payment_status as enum ('pending','verified','rejected');
create type public.payment_method as enum ('transfer','tunai');
create type public.transaction_type as enum ('income','expense');
create type public.request_status as enum ('submitted','review','revision','approved','rejected','completed');
create type public.billing_period as enum ('bulanan','tahunan','sekali','insidental');
create type public.complaint_status as enum ('submitted','assigned','in_progress','resolved','closed');
create type public.complaint_priority as enum ('rendah','normal','tinggi','darurat');
create type public.announcement_status as enum ('draft','published','archived');
create type public.activity_status as enum ('planned','ongoing','done','cancelled');
create type public.attendance_status as enum ('registered','present','absent','excused');
create type public.theme_pref as enum ('light','dark','system');

-- ---------- updated_at helper ---------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------- A. Core & autentikasi -----------------------------------
create table public.neighborhoods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rt_number varchar(10) not null,
  rw_number varchar(10),
  village text,
  district text,
  city text,
  province text,
  postal_code varchar(10),
  address text,
  logo_url text,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  full_name text not null,
  phone varchar(30),
  email text,
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.touch_updated_at();

create table public.households (
  id uuid primary key default gen_random_uuid(),
  neighborhood_id uuid not null references public.neighborhoods(id),
  house_number varchar(30) not null,
  address text not null,
  head_resident_id uuid,
  family_card_number text,                          -- data terbatas
  status text not null default 'active' check (status in ('active','vacant','inactive')),
  created_at timestamptz not null default now(),
  unique (neighborhood_id, house_number),
  unique (neighborhood_id, id)
);

create table public.residents (
  id uuid primary key default gen_random_uuid(),
  neighborhood_id uuid not null references public.neighborhoods(id),
  household_id uuid not null,
  user_id uuid references public.profiles(id),
  nik text check (nik is null or nik ~ '^[0-9]{16}$'), -- data terbatas
  full_name text not null,
  gender text check (gender in ('L','P')),
  birth_place text,
  birth_date date,
  family_relationship text,
  occupation text,
  phone varchar(30),
  resident_status public.resident_status not null default 'tetap',
  is_active boolean not null default true,
  joined_at date,
  left_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (neighborhood_id, id),
  foreign key (neighborhood_id, household_id) references public.households(neighborhood_id, id),
  check (left_at is null or joined_at is null or left_at >= joined_at)
);
create unique index uq_residents_nik on public.residents(neighborhood_id, nik) where nik is not null;
create trigger trg_residents_updated before update on public.residents
  for each row execute function public.touch_updated_at();

alter table public.households
  add constraint households_head_fk
  foreign key (neighborhood_id, head_resident_id)
  references public.residents(neighborhood_id, id)
  deferrable initially deferred;

create table public.user_memberships (
  id uuid primary key default gen_random_uuid(),
  neighborhood_id uuid not null references public.neighborhoods(id),
  user_id uuid not null references public.profiles(id),
  role public.app_role not null,
  resident_id uuid,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (neighborhood_id, user_id),
  foreign key (neighborhood_id, resident_id) references public.residents(neighborhood_id, id)
);

-- ---------- B. Administrasi surat -----------------------------------
create table public.letter_types (
  id uuid primary key default gen_random_uuid(),
  neighborhood_id uuid not null references public.neighborhoods(id),
  code varchar(20) not null,
  name text not null,
  description text,
  required_fields jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (neighborhood_id, code),
  unique (neighborhood_id, id)
);

create table public.letter_templates (
  id uuid primary key default gen_random_uuid(),
  neighborhood_id uuid not null references public.neighborhoods(id),
  letter_type_id uuid not null,
  body text not null,
  version int not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  foreign key (neighborhood_id, letter_type_id) references public.letter_types(neighborhood_id, id)
);

create table public.letter_requests (
  id uuid primary key default gen_random_uuid(),
  neighborhood_id uuid not null references public.neighborhoods(id),
  resident_id uuid not null,
  letter_type_id uuid not null,
  request_number varchar(40) not null,
  purpose text not null,
  form_data jsonb not null default '{}'::jsonb,
  status public.request_status not null default 'submitted',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  review_note text,
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  letter_number varchar(60),
  document_path text,
  rejection_reason text,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (neighborhood_id, request_number),
  unique (neighborhood_id, letter_number),
  unique (neighborhood_id, id),
  foreign key (neighborhood_id, resident_id) references public.residents(neighborhood_id, id),
  foreign key (neighborhood_id, letter_type_id) references public.letter_types(neighborhood_id, id),
  check (status <> 'rejected' or rejection_reason is not null),
  check (status not in ('approved','completed') or (letter_number is not null and approved_by is not null))
);

create table public.letter_request_history (
  id uuid primary key default gen_random_uuid(),
  neighborhood_id uuid not null references public.neighborhoods(id),
  request_id uuid not null,
  status public.request_status not null,
  note text,
  changed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  foreign key (neighborhood_id, request_id) references public.letter_requests(neighborhood_id, id)
);

create table public.letter_attachments (
  id uuid primary key default gen_random_uuid(),
  neighborhood_id uuid not null references public.neighborhoods(id),
  request_id uuid not null,
  storage_path text not null,
  file_name text not null,
  uploaded_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (neighborhood_id, request_id) references public.letter_requests(neighborhood_id, id)
);

-- Counter nomor dokumen (surat, tagihan, transaksi). Dikunci per baris.
create table public.document_counters (
  neighborhood_id uuid not null references public.neighborhoods(id),
  document_type text not null,
  period_key text not null,
  last_number int not null default 0 check (last_number >= 0),
  primary key (neighborhood_id, document_type, period_key)
);
-- PRD menyebut letter_number_sequences; disediakan sebagai view atas counter.
create view public.letter_number_sequences with (security_invoker = true) as
  select neighborhood_id, period_key, last_number
  from public.document_counters where document_type = 'letter';

-- ---------- C. Keuangan ---------------------------------------------
create table public.dues_types (
  id uuid primary key default gen_random_uuid(),
  neighborhood_id uuid not null references public.neighborhoods(id),
  name text not null,
  description text,
  amount numeric(14,2) not null check (amount >= 0),
  billing_period public.billing_period not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (neighborhood_id, id)
);

create table public.dues_invoices (
  id uuid primary key default gen_random_uuid(),
  neighborhood_id uuid not null references public.neighborhoods(id),
  household_id uuid not null,
  dues_type_id uuid not null,
  invoice_number varchar(50) not null,
  period_month smallint check (period_month between 1 and 12),
  period_year smallint not null check (period_year between 2000 and 2100),
  amount numeric(14,2) not null check (amount > 0),
  paid_amount numeric(14,2) not null default 0,
  status public.invoice_status not null default 'unpaid',
  due_date date,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  unique (neighborhood_id, invoice_number),
  unique (neighborhood_id, id),
  unique (neighborhood_id, id, household_id),
  foreign key (neighborhood_id, household_id) references public.households(neighborhood_id, id),
  foreign key (neighborhood_id, dues_type_id) references public.dues_types(neighborhood_id, id),
  check (paid_amount >= 0 and paid_amount <= amount),
  check (status <> 'paid' or paid_amount = amount)
);
-- Satu tagihan per keluarga per jenis iuran per periode.
create unique index uq_invoice_period
  on public.dues_invoices(neighborhood_id, household_id, dues_type_id, period_year, coalesce(period_month, 0))
  where status <> 'cancelled';

create table public.dues_payments (
  id uuid primary key default gen_random_uuid(),
  neighborhood_id uuid not null references public.neighborhoods(id),
  invoice_id uuid not null,
  household_id uuid not null,
  payer_user_id uuid not null references public.profiles(id) default auth.uid(),
  reference_code varchar(60) not null default encode(gen_random_bytes(8), 'hex'),
  amount numeric(14,2) not null check (amount > 0),
  payment_method public.payment_method not null,
  proof_path text,
  payment_date date not null,
  status public.payment_status not null default 'pending',
  verified_by uuid references public.profiles(id),
  verified_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  unique (neighborhood_id, reference_code),
  unique (neighborhood_id, id),
  -- Pembayaran wajib merujuk invoice DAN keluarga yang sama.
  foreign key (neighborhood_id, invoice_id, household_id)
    references public.dues_invoices(neighborhood_id, id, household_id),
  check (status <> 'rejected' or rejection_reason is not null),
  check (status <> 'verified' or (verified_by is not null and verified_at is not null))
);

create table public.cash_categories (
  id uuid primary key default gen_random_uuid(),
  neighborhood_id uuid not null references public.neighborhoods(id),
  name text not null,
  transaction_type public.transaction_type not null,
  is_active boolean not null default true,
  unique (neighborhood_id, name, transaction_type),
  unique (neighborhood_id, id)
);

create table public.financial_periods (
  id uuid primary key default gen_random_uuid(),
  neighborhood_id uuid not null references public.neighborhoods(id),
  period_year smallint not null,
  period_month smallint not null check (period_month between 1 and 12),
  closed_at timestamptz,
  closed_by uuid references public.profiles(id),
  unique (neighborhood_id, period_year, period_month)
);

create table public.cash_transactions (
  id uuid primary key default gen_random_uuid(),
  neighborhood_id uuid not null references public.neighborhoods(id),
  category_id uuid,
  payment_id uuid unique,                                  -- satu pembayaran = satu pemasukan
  reverses_id uuid unique,                                 -- koreksi = transaksi pembalik
  transaction_number varchar(50) not null,
  transaction_type public.transaction_type not null,
  amount numeric(14,2) not null check (amount > 0),
  transaction_date date not null,
  description text,
  proof_path text,
  recorded_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (neighborhood_id, transaction_number),
  unique (neighborhood_id, id),
  foreign key (neighborhood_id, category_id) references public.cash_categories(neighborhood_id, id),
  foreign key (neighborhood_id, payment_id) references public.dues_payments(neighborhood_id, id),
  foreign key (neighborhood_id, reverses_id) references public.cash_transactions(neighborhood_id, id)
);

-- Saldo = hasil buku transaksi, bukan angka yang diubah manual.
create view public.cash_balance with (security_invoker = true) as
  select neighborhood_id,
         coalesce(sum(case when transaction_type = 'income' then amount else 0 end), 0) as total_income,
         coalesce(sum(case when transaction_type = 'expense' then amount else 0 end), 0) as total_expense,
         coalesce(sum(case when transaction_type = 'income' then amount else -amount end), 0) as balance
  from public.cash_transactions
  group by neighborhood_id;

-- ---------- D. Informasi & notifikasi --------------------------------
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  neighborhood_id uuid not null references public.neighborhoods(id),
  title text not null,
  content text not null,
  category text not null default 'umum',
  status public.announcement_status not null default 'draft',
  is_pinned boolean not null default false,
  attachment_path text,
  published_at timestamptz,
  published_by uuid references public.profiles(id),
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  unique (neighborhood_id, id),
  check (status <> 'published' or published_at is not null)
);

create table public.announcement_reads (
  neighborhood_id uuid not null references public.neighborhoods(id),
  announcement_id uuid not null,
  user_id uuid not null references public.profiles(id) default auth.uid(),
  read_at timestamptz not null default now(),
  primary key (announcement_id, user_id),
  foreign key (neighborhood_id, announcement_id) references public.announcements(neighborhood_id, id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  neighborhood_id uuid not null references public.neighborhoods(id),
  user_id uuid not null references public.profiles(id),
  title text not null,
  message text not null,                                    -- jangan pernah berisi NIK/KK
  type text,
  reference_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- E. Pengaduan ---------------------------------------------
create table public.complaint_categories (
  id uuid primary key default gen_random_uuid(),
  neighborhood_id uuid not null references public.neighborhoods(id),
  name text not null,
  is_active boolean not null default true,
  unique (neighborhood_id, name),
  unique (neighborhood_id, id)
);

create table public.complaints (
  id uuid primary key default gen_random_uuid(),
  neighborhood_id uuid not null references public.neighborhoods(id),
  ticket_number varchar(40) not null,
  resident_id uuid not null,
  category_id uuid,
  title text not null,
  description text not null,
  location text,
  priority public.complaint_priority not null default 'normal',
  status public.complaint_status not null default 'submitted',
  assigned_to uuid references public.profiles(id),
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (neighborhood_id, ticket_number),
  unique (neighborhood_id, id),
  foreign key (neighborhood_id, resident_id) references public.residents(neighborhood_id, id),
  foreign key (neighborhood_id, category_id) references public.complaint_categories(neighborhood_id, id)
);

create table public.complaint_updates (
  id uuid primary key default gen_random_uuid(),
  neighborhood_id uuid not null references public.neighborhoods(id),
  complaint_id uuid not null,
  status public.complaint_status not null,
  message text not null,
  updated_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (neighborhood_id, complaint_id) references public.complaints(neighborhood_id, id)
);

create table public.complaint_attachments (
  id uuid primary key default gen_random_uuid(),
  neighborhood_id uuid not null references public.neighborhoods(id),
  complaint_id uuid not null,
  storage_path text not null,
  uploaded_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (neighborhood_id, complaint_id) references public.complaints(neighborhood_id, id)
);

-- ---------- F. Kegiatan ----------------------------------------------
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  neighborhood_id uuid not null references public.neighborhoods(id),
  title text not null,
  category text not null default 'lainnya',
  description text,
  location text,
  start_at timestamptz not null,
  end_at timestamptz,
  status public.activity_status not null default 'planned',
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  unique (neighborhood_id, id),
  check (end_at is null or end_at >= start_at)
);

create table public.activity_participants (
  neighborhood_id uuid not null references public.neighborhoods(id),
  activity_id uuid not null,
  resident_id uuid not null,
  attendance_status public.attendance_status not null default 'registered',
  registered_at timestamptz not null default now(),
  primary key (activity_id, resident_id),
  foreign key (neighborhood_id, activity_id) references public.activities(neighborhood_id, id),
  foreign key (neighborhood_id, resident_id) references public.residents(neighborhood_id, id)
);

create table public.activity_attachments (
  id uuid primary key default gen_random_uuid(),
  neighborhood_id uuid not null references public.neighborhoods(id),
  activity_id uuid not null,
  storage_path text not null,
  created_at timestamptz not null default now(),
  foreign key (neighborhood_id, activity_id) references public.activities(neighborhood_id, id)
);

-- ---------- G. Keamanan ----------------------------------------------
create table public.patrol_teams (
  id uuid primary key default gen_random_uuid(),
  neighborhood_id uuid not null references public.neighborhoods(id),
  name text not null,
  leader_resident_id uuid,
  is_active boolean not null default true,
  unique (neighborhood_id, name),
  unique (neighborhood_id, id),
  foreign key (neighborhood_id, leader_resident_id) references public.residents(neighborhood_id, id)
);

create table public.patrol_members (
  neighborhood_id uuid not null references public.neighborhoods(id),
  team_id uuid not null,
  resident_id uuid not null,
  primary key (team_id, resident_id),
  foreign key (neighborhood_id, team_id) references public.patrol_teams(neighborhood_id, id),
  foreign key (neighborhood_id, resident_id) references public.residents(neighborhood_id, id)
);

create table public.patrol_schedules (
  id uuid primary key default gen_random_uuid(),
  neighborhood_id uuid not null references public.neighborhoods(id),
  team_id uuid not null,
  patrol_date date not null,
  start_time time not null default '22:00',
  end_time time not null default '04:00',
  unique (neighborhood_id, team_id, patrol_date),
  unique (neighborhood_id, id),
  foreign key (neighborhood_id, team_id) references public.patrol_teams(neighborhood_id, id)
);

create table public.patrol_reports (
  id uuid primary key default gen_random_uuid(),
  neighborhood_id uuid not null references public.neighborhoods(id),
  schedule_id uuid not null,
  report text not null,
  status text not null default 'aman' check (status in ('aman','ada_kejadian','tidak_terlaksana')),
  submitted_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  unique (schedule_id),
  foreign key (neighborhood_id, schedule_id) references public.patrol_schedules(neighborhood_id, id)
);

create table public.security_incidents (
  id uuid primary key default gen_random_uuid(),
  neighborhood_id uuid not null references public.neighborhoods(id),
  title text not null,
  description text not null,
  incident_date timestamptz not null,
  location text,
  severity text not null default 'rendah' check (severity in ('rendah','sedang','tinggi')),
  status text not null default 'open' check (status in ('open','handled','closed')),
  reported_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.guest_logs (
  id uuid primary key default gen_random_uuid(),
  neighborhood_id uuid not null references public.neighborhoods(id),
  visitor_name text not null,
  visitor_phone varchar(30),
  destination text not null,
  purpose text,
  vehicle_plate varchar(20),
  arrival_at timestamptz not null default now(),
  departure_at timestamptz,
  recorded_by uuid references public.profiles(id) default auth.uid(),
  check (departure_at is null or departure_at >= arrival_at)
);

-- ---------- H. Sistem & audit ----------------------------------------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  neighborhood_id uuid not null references public.neighborhoods(id),
  user_id uuid references public.profiles(id),
  action text not null,
  table_name text not null,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create table public.rt_settings (
  neighborhood_id uuid not null references public.neighborhoods(id),
  setting_key text not null,
  setting_value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (neighborhood_id, setting_key)
);

create table public.resident_history (
  id uuid primary key default gen_random_uuid(),
  neighborhood_id uuid not null references public.neighborhoods(id),
  resident_id uuid not null,
  change_type text not null,
  old_data jsonb,
  new_data jsonb,
  changed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  foreign key (neighborhood_id, resident_id) references public.residents(neighborhood_id, id)
);

create table public.user_preferences (
  user_id uuid primary key references public.profiles(id),
  theme public.theme_pref not null default 'system',
  notification_preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------- Indeks ---------------------------------------------------
create index idx_households_neighborhood on public.households(neighborhood_id);
create index idx_residents_neighborhood on public.residents(neighborhood_id);
create index idx_residents_household on public.residents(household_id);
create index idx_residents_user on public.residents(user_id);
create index idx_residents_name on public.residents using gin (to_tsvector('simple', full_name));
create index idx_memberships_user on public.user_memberships(user_id) where is_active;
create index idx_letters_status on public.letter_requests(neighborhood_id, status);
create index idx_letters_resident on public.letter_requests(resident_id);
create index idx_invoices_household on public.dues_invoices(household_id);
create index idx_invoices_status on public.dues_invoices(neighborhood_id, status);
create index idx_payments_invoice on public.dues_payments(invoice_id);
create index idx_payments_status on public.dues_payments(neighborhood_id, status);
create index idx_cash_date on public.cash_transactions(neighborhood_id, transaction_date);
create index idx_announcements_status on public.announcements(neighborhood_id, status, published_at desc);
create index idx_notifications_user on public.notifications(user_id, read_at);
create index idx_complaints_status on public.complaints(neighborhood_id, status);
create index idx_complaints_assigned on public.complaints(assigned_to);
create index idx_activities_start on public.activities(neighborhood_id, start_at);
create index idx_patrol_date on public.patrol_schedules(neighborhood_id, patrol_date);
create index idx_guest_arrival on public.guest_logs(neighborhood_id, arrival_at desc);
create index idx_audit_created on public.audit_logs(neighborhood_id, created_at desc);
create index idx_audit_record on public.audit_logs(table_name, record_id);
