-- =====================================================================
-- WargaKu · Migration 0002 · Helper role & Row Level Security
-- Policy dipisah per operasi (SELECT/INSERT/UPDATE/DELETE). Tidak ada
-- policy FOR ALL. Perubahan sensitif (verifikasi, nomor surat, role)
-- hanya lewat RPC SECURITY DEFINER di migration 0003.
-- =====================================================================

-- ---------- Helper functions ----------------------------------------
create or replace function public.has_rt_role(p_neighborhood_id uuid, p_roles public.app_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_memberships m
    join public.profiles p on p.id = m.user_id
    where m.neighborhood_id = p_neighborhood_id
      and m.user_id = (select auth.uid())
      and m.is_active and p.is_active
      and m.role = any(p_roles)
  );
$$;

create or replace function public.is_rt_member(p_neighborhood_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_memberships m
    join public.profiles p on p.id = m.user_id
    where m.neighborhood_id = p_neighborhood_id
      and m.user_id = (select auth.uid()) and m.is_active and p.is_active
  );
$$;

-- Keluarga milik akun yang sedang login (via residents.user_id atau membership.resident_id).
create or replace function public.my_household_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select r.household_id from public.residents r where r.user_id = (select auth.uid())
  union
  select r.household_id from public.user_memberships m
    join public.residents r on r.id = m.resident_id
    where m.user_id = (select auth.uid()) and m.is_active;
$$;

create or replace function public.my_resident_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select r.id from public.residents r where r.household_id in (select public.my_household_ids());
$$;

revoke all on function public.has_rt_role(uuid, public.app_role[]) from public;
revoke all on function public.is_rt_member(uuid) from public;
revoke all on function public.my_household_ids() from public;
revoke all on function public.my_resident_ids() from public;
grant execute on function public.has_rt_role(uuid, public.app_role[]) to authenticated;
grant execute on function public.is_rt_member(uuid) to authenticated;
grant execute on function public.my_household_ids() to authenticated;
grant execute on function public.my_resident_ids() to authenticated;

-- Singkatan array role yang sering dipakai
-- admin   = ketua_rt
-- adm     = ketua_rt, sekretaris
-- fin     = ketua_rt, bendahara
-- staff   = ketua_rt, sekretaris, bendahara, pengurus

-- ---------- Enable RLS on every client table -------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'neighborhoods','profiles','user_memberships','households','residents',
    'letter_types','letter_templates','letter_requests','letter_request_history','letter_attachments',
    'document_counters','dues_types','dues_invoices','dues_payments','cash_categories',
    'financial_periods','cash_transactions','announcements','announcement_reads','notifications',
    'complaint_categories','complaints','complaint_updates','complaint_attachments',
    'activities','activity_participants','activity_attachments',
    'patrol_teams','patrol_members','patrol_schedules','patrol_reports','security_incidents','guest_logs',
    'audit_logs','rt_settings','resident_history','user_preferences'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Counter hanya disentuh oleh RPC.
revoke all on public.document_counters from anon, authenticated;

-- ---------- neighborhoods -------------------------------------------
create policy "members read neighborhood" on public.neighborhoods for select to authenticated
  using (public.is_rt_member(id));
create policy "ketua updates neighborhood" on public.neighborhoods for update to authenticated
  using (public.has_rt_role(id, array['ketua_rt']::public.app_role[]))
  with check (public.has_rt_role(id, array['ketua_rt']::public.app_role[]));

-- ---------- profiles -------------------------------------------------
create policy "read own profile" on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy "staff read member profiles" on public.profiles for select to authenticated
  using (exists (
    select 1 from public.user_memberships m
    where m.user_id = profiles.id
      and public.has_rt_role(m.neighborhood_id, array['ketua_rt','sekretaris','bendahara','pengurus']::public.app_role[])
  ));
create policy "update own profile" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- is_active hanya boleh diubah lewat RPC set_member_active.
revoke update (is_active) on public.profiles from authenticated;

-- ---------- user_memberships ----------------------------------------
create policy "read own membership" on public.user_memberships for select to authenticated
  using (user_id = (select auth.uid()));
create policy "ketua reads memberships" on public.user_memberships for select to authenticated
  using (public.has_rt_role(neighborhood_id, array['ketua_rt']::public.app_role[]));
-- INSERT/UPDATE role hanya lewat RPC assign_member_role (tidak ada policy tulis).

-- ---------- households ----------------------------------------------
-- Kolom family_card_number tidak diberikan ke role umum; pakai view households_safe.
create policy "managers read households" on public.households for select to authenticated
  using (public.has_rt_role(neighborhood_id, array['ketua_rt','sekretaris','bendahara']::public.app_role[]));
create policy "warga reads own household" on public.households for select to authenticated
  using (id in (select public.my_household_ids()));
create policy "managers insert households" on public.households for insert to authenticated
  with check (public.has_rt_role(neighborhood_id, array['ketua_rt','sekretaris']::public.app_role[]));
create policy "managers update households" on public.households for update to authenticated
  using (public.has_rt_role(neighborhood_id, array['ketua_rt','sekretaris']::public.app_role[]))
  with check (public.has_rt_role(neighborhood_id, array['ketua_rt','sekretaris']::public.app_role[]));
create policy "ketua deletes empty households" on public.households for delete to authenticated
  using (public.has_rt_role(neighborhood_id, array['ketua_rt']::public.app_role[])
         and not exists (select 1 from public.residents r where r.household_id = households.id));

-- ---------- residents -----------------------------------------------
create policy "managers read residents" on public.residents for select to authenticated
  using (public.has_rt_role(neighborhood_id, array['ketua_rt','sekretaris']::public.app_role[]));
create policy "warga reads own family" on public.residents for select to authenticated
  using (household_id in (select public.my_household_ids()));
create policy "managers insert residents" on public.residents for insert to authenticated
  with check (public.has_rt_role(neighborhood_id, array['ketua_rt','sekretaris']::public.app_role[]));
create policy "managers update residents" on public.residents for update to authenticated
  using (public.has_rt_role(neighborhood_id, array['ketua_rt','sekretaris']::public.app_role[]))
  with check (public.has_rt_role(neighborhood_id, array['ketua_rt','sekretaris']::public.app_role[]));
-- Tidak ada DELETE: warga pindah/meninggal ditandai via resident_status + is_active.

-- View terbatas tanpa NIK & No. KK untuk Bendahara/Pengurus (akses "Terbatas" di matriks).
create view public.residents_directory with (security_invoker = false) as
  select r.id, r.neighborhood_id, r.household_id, r.full_name, r.gender, r.phone,
         r.resident_status, r.is_active, h.house_number
  from public.residents r join public.households h on h.id = r.household_id
  where public.is_rt_member(r.neighborhood_id)
    and public.has_rt_role(r.neighborhood_id, array['ketua_rt','sekretaris','bendahara','pengurus']::public.app_role[]);
revoke all on public.residents_directory from anon;
grant select on public.residents_directory to authenticated;

create view public.households_safe with (security_invoker = false) as
  select h.id, h.neighborhood_id, h.house_number, h.address, h.head_resident_id, h.status, h.created_at
  from public.households h
  where public.has_rt_role(h.neighborhood_id, array['ketua_rt','sekretaris','bendahara','pengurus']::public.app_role[])
     or h.id in (select public.my_household_ids());
revoke all on public.households_safe from anon;
grant select on public.households_safe to authenticated;

-- ---------- letters --------------------------------------------------
create policy "members read letter types" on public.letter_types for select to authenticated
  using (public.is_rt_member(neighborhood_id));
create policy "adm write letter types" on public.letter_types for insert to authenticated
  with check (public.has_rt_role(neighborhood_id, array['ketua_rt','sekretaris']::public.app_role[]));
create policy "adm update letter types" on public.letter_types for update to authenticated
  using (public.has_rt_role(neighborhood_id, array['ketua_rt','sekretaris']::public.app_role[]))
  with check (public.has_rt_role(neighborhood_id, array['ketua_rt','sekretaris']::public.app_role[]));

create policy "adm read templates" on public.letter_templates for select to authenticated
  using (public.has_rt_role(neighborhood_id, array['ketua_rt','sekretaris']::public.app_role[]));
create policy "adm insert templates" on public.letter_templates for insert to authenticated
  with check (public.has_rt_role(neighborhood_id, array['ketua_rt','sekretaris']::public.app_role[]));
create policy "adm update templates" on public.letter_templates for update to authenticated
  using (public.has_rt_role(neighborhood_id, array['ketua_rt','sekretaris']::public.app_role[]))
  with check (public.has_rt_role(neighborhood_id, array['ketua_rt','sekretaris']::public.app_role[]));

create policy "adm read letter requests" on public.letter_requests for select to authenticated
  using (public.has_rt_role(neighborhood_id, array['ketua_rt','sekretaris']::public.app_role[]));
create policy "warga reads own letter requests" on public.letter_requests for select to authenticated
  using (resident_id in (select public.my_resident_ids()));
create policy "warga submits letter request" on public.letter_requests for insert to authenticated
  with check (
    public.is_rt_member(neighborhood_id)
    and status = 'submitted'
    and letter_number is null and approved_by is null and reviewed_by is null
    and (resident_id in (select public.my_resident_ids())
         or public.has_rt_role(neighborhood_id, array['ketua_rt','sekretaris']::public.app_role[]))
  );
-- Perubahan status hanya lewat RPC review_letter_request / approve_letter_request.

create policy "read letter history" on public.letter_request_history for select to authenticated
  using (public.has_rt_role(neighborhood_id, array['ketua_rt','sekretaris']::public.app_role[])
         or request_id in (select id from public.letter_requests where resident_id in (select public.my_resident_ids())));

create policy "read letter attachments" on public.letter_attachments for select to authenticated
  using (public.has_rt_role(neighborhood_id, array['ketua_rt','sekretaris']::public.app_role[])
         or uploaded_by = (select auth.uid()));
create policy "insert own letter attachment" on public.letter_attachments for insert to authenticated
  with check (uploaded_by = (select auth.uid()) and public.is_rt_member(neighborhood_id));

-- ---------- finance --------------------------------------------------
create policy "members read dues types" on public.dues_types for select to authenticated
  using (public.is_rt_member(neighborhood_id));
create policy "fin insert dues types" on public.dues_types for insert to authenticated
  with check (public.has_rt_role(neighborhood_id, array['ketua_rt','bendahara']::public.app_role[]));
create policy "fin update dues types" on public.dues_types for update to authenticated
  using (public.has_rt_role(neighborhood_id, array['ketua_rt','bendahara']::public.app_role[]))
  with check (public.has_rt_role(neighborhood_id, array['ketua_rt','bendahara']::public.app_role[]));

create policy "staff read invoices" on public.dues_invoices for select to authenticated
  using (public.has_rt_role(neighborhood_id, array['ketua_rt','sekretaris','bendahara']::public.app_role[]));
create policy "warga reads family invoices" on public.dues_invoices for select to authenticated
  using (household_id in (select public.my_household_ids()));
-- Pembuatan tagihan lewat RPC create_invoice; pembatalan lewat cancel_invoice.

create policy "fin read payments" on public.dues_payments for select to authenticated
  using (public.has_rt_role(neighborhood_id, array['ketua_rt','bendahara']::public.app_role[]));
create policy "warga reads family payments" on public.dues_payments for select to authenticated
  using (household_id in (select public.my_household_ids()));
create policy "submit pending payment" on public.dues_payments for insert to authenticated
  with check (
    payer_user_id = (select auth.uid())
    and status = 'pending' and verified_by is null and verified_at is null
    and (household_id in (select public.my_household_ids())
         or public.has_rt_role(neighborhood_id, array['ketua_rt','bendahara','pengurus']::public.app_role[]))
  );
-- Tidak ada UPDATE/DELETE langsung: status hanya berubah lewat verify/reject RPC.

create policy "fin read cash categories" on public.cash_categories for select to authenticated
  using (public.is_rt_member(neighborhood_id));
create policy "fin insert cash categories" on public.cash_categories for insert to authenticated
  with check (public.has_rt_role(neighborhood_id, array['ketua_rt','bendahara']::public.app_role[]));

create policy "fin read periods" on public.financial_periods for select to authenticated
  using (public.has_rt_role(neighborhood_id, array['ketua_rt','sekretaris','bendahara']::public.app_role[]));

create policy "fin read cash transactions" on public.cash_transactions for select to authenticated
  using (public.has_rt_role(neighborhood_id, array['ketua_rt','sekretaris','bendahara']::public.app_role[]));
-- Tulis hanya lewat RPC (verify_dues_payment, record_cash_expense, record_cash_income, reverse_cash_transaction).

-- Ringkasan publik kas untuk warga: total saja, tanpa rincian transaksi.
create or replace function public.public_cash_summary(p_neighborhood_id uuid)
returns table(total_income numeric, total_expense numeric, balance numeric)
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(case when transaction_type='income' then amount end),0),
         coalesce(sum(case when transaction_type='expense' then amount end),0),
         coalesce(sum(case when transaction_type='income' then amount else -amount end),0)
  from public.cash_transactions
  where neighborhood_id = p_neighborhood_id and public.is_rt_member(p_neighborhood_id);
$$;
revoke all on function public.public_cash_summary(uuid) from public;
grant execute on function public.public_cash_summary(uuid) to authenticated;

-- ---------- announcements & notifications ----------------------------
create policy "members read published announcements" on public.announcements for select to authenticated
  using (public.is_rt_member(neighborhood_id) and status = 'published');
create policy "editors read all announcements" on public.announcements for select to authenticated
  using (public.has_rt_role(neighborhood_id, array['ketua_rt','sekretaris','pengurus']::public.app_role[]));
create policy "editors create drafts" on public.announcements for insert to authenticated
  with check (status = 'draft' and created_by = (select auth.uid())
              and public.has_rt_role(neighborhood_id, array['ketua_rt','sekretaris','pengurus']::public.app_role[]));
create policy "editors update drafts" on public.announcements for update to authenticated
  using (public.has_rt_role(neighborhood_id, array['ketua_rt','sekretaris']::public.app_role[])
         or (created_by = (select auth.uid()) and status = 'draft'
             and public.has_rt_role(neighborhood_id, array['pengurus']::public.app_role[])))
  with check (status <> 'published' or public.has_rt_role(neighborhood_id, array['ketua_rt','sekretaris']::public.app_role[]));

create policy "read own reads" on public.announcement_reads for select to authenticated
  using (user_id = (select auth.uid())
         or public.has_rt_role(neighborhood_id, array['ketua_rt','sekretaris','pengurus']::public.app_role[]));
create policy "mark own read" on public.announcement_reads for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_rt_member(neighborhood_id));

create policy "read own notifications" on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy "mark own notification read" on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- ---------- complaints -----------------------------------------------
create policy "members read complaint categories" on public.complaint_categories for select to authenticated
  using (public.is_rt_member(neighborhood_id));

create policy "adm read all complaints" on public.complaints for select to authenticated
  using (public.has_rt_role(neighborhood_id, array['ketua_rt','sekretaris']::public.app_role[]));
create policy "pengurus reads assigned complaints" on public.complaints for select to authenticated
  using (assigned_to = (select auth.uid()));
create policy "warga reads own complaints" on public.complaints for select to authenticated
  using (created_by = (select auth.uid()) or resident_id in (select public.my_resident_ids()));
create policy "warga files complaint" on public.complaints for insert to authenticated
  with check (status = 'submitted' and assigned_to is null and created_by = (select auth.uid())
              and public.is_rt_member(neighborhood_id)
              and resident_id in (select public.my_resident_ids()));
-- Penugasan & perubahan status lewat RPC assign_complaint / update_complaint_status.

create policy "read complaint updates" on public.complaint_updates for select to authenticated
  using (complaint_id in (select id from public.complaints));  -- mewarisi policy complaints
create policy "read complaint attachments" on public.complaint_attachments for select to authenticated
  using (complaint_id in (select id from public.complaints));
create policy "attach to own complaint" on public.complaint_attachments for insert to authenticated
  with check (uploaded_by = (select auth.uid()) and complaint_id in (select id from public.complaints));

-- ---------- activities -----------------------------------------------
create policy "members read activities" on public.activities for select to authenticated
  using (public.is_rt_member(neighborhood_id));
create policy "organizers insert activities" on public.activities for insert to authenticated
  with check (public.has_rt_role(neighborhood_id, array['ketua_rt','sekretaris','pengurus']::public.app_role[]));
create policy "organizers update activities" on public.activities for update to authenticated
  using (public.has_rt_role(neighborhood_id, array['ketua_rt','sekretaris','pengurus']::public.app_role[]))
  with check (public.has_rt_role(neighborhood_id, array['ketua_rt','sekretaris','pengurus']::public.app_role[]));

create policy "members read participants" on public.activity_participants for select to authenticated
  using (public.is_rt_member(neighborhood_id));
create policy "warga joins activity" on public.activity_participants for insert to authenticated
  with check (public.is_rt_member(neighborhood_id)
              and attendance_status = 'registered'
              and (resident_id in (select public.my_resident_ids())
                   or public.has_rt_role(neighborhood_id, array['ketua_rt','sekretaris','pengurus']::public.app_role[])));
create policy "organizers mark attendance" on public.activity_participants for update to authenticated
  using (public.has_rt_role(neighborhood_id, array['ketua_rt','sekretaris','pengurus']::public.app_role[]))
  with check (public.has_rt_role(neighborhood_id, array['ketua_rt','sekretaris','pengurus']::public.app_role[]));
create policy "warga leaves activity" on public.activity_participants for delete to authenticated
  using (resident_id in (select public.my_resident_ids()) and attendance_status = 'registered');

create policy "members read activity media" on public.activity_attachments for select to authenticated
  using (public.is_rt_member(neighborhood_id));
create policy "organizers add activity media" on public.activity_attachments for insert to authenticated
  with check (public.has_rt_role(neighborhood_id, array['ketua_rt','sekretaris','pengurus']::public.app_role[]));

-- ---------- security -------------------------------------------------
create policy "members read patrol teams" on public.patrol_teams for select to authenticated
  using (public.is_rt_member(neighborhood_id));
create policy "security insert teams" on public.patrol_teams for insert to authenticated
  with check (public.has_rt_role(neighborhood_id, array['ketua_rt','pengurus']::public.app_role[]));
create policy "security update teams" on public.patrol_teams for update to authenticated
  using (public.has_rt_role(neighborhood_id, array['ketua_rt','pengurus']::public.app_role[]))
  with check (public.has_rt_role(neighborhood_id, array['ketua_rt','pengurus']::public.app_role[]));

create policy "members read patrol members" on public.patrol_members for select to authenticated
  using (public.is_rt_member(neighborhood_id));
create policy "security insert members" on public.patrol_members for insert to authenticated
  with check (public.has_rt_role(neighborhood_id, array['ketua_rt','pengurus']::public.app_role[]));
create policy "security delete members" on public.patrol_members for delete to authenticated
  using (public.has_rt_role(neighborhood_id, array['ketua_rt','pengurus']::public.app_role[]));

create policy "members read schedules" on public.patrol_schedules for select to authenticated
  using (public.is_rt_member(neighborhood_id));
create policy "security insert schedules" on public.patrol_schedules for insert to authenticated
  with check (public.has_rt_role(neighborhood_id, array['ketua_rt','pengurus']::public.app_role[]));
create policy "security update schedules" on public.patrol_schedules for update to authenticated
  using (public.has_rt_role(neighborhood_id, array['ketua_rt','pengurus']::public.app_role[]))
  with check (public.has_rt_role(neighborhood_id, array['ketua_rt','pengurus']::public.app_role[]));

create policy "staff read patrol reports" on public.patrol_reports for select to authenticated
  using (public.has_rt_role(neighborhood_id, array['ketua_rt','sekretaris','pengurus']::public.app_role[]));
create policy "members submit patrol report" on public.patrol_reports for insert to authenticated
  with check (submitted_by = (select auth.uid()) and public.is_rt_member(neighborhood_id));

create policy "staff read incidents" on public.security_incidents for select to authenticated
  using (public.has_rt_role(neighborhood_id, array['ketua_rt','sekretaris','pengurus']::public.app_role[])
         or reported_by = (select auth.uid()));
create policy "members report incident" on public.security_incidents for insert to authenticated
  with check (reported_by = (select auth.uid()) and status = 'open' and public.is_rt_member(neighborhood_id));
create policy "security update incidents" on public.security_incidents for update to authenticated
  using (public.has_rt_role(neighborhood_id, array['ketua_rt','pengurus']::public.app_role[]))
  with check (public.has_rt_role(neighborhood_id, array['ketua_rt','pengurus']::public.app_role[]));

create policy "staff read guests" on public.guest_logs for select to authenticated
  using (public.has_rt_role(neighborhood_id, array['ketua_rt','sekretaris','pengurus']::public.app_role[]));
create policy "security log guest" on public.guest_logs for insert to authenticated
  with check (public.has_rt_role(neighborhood_id, array['ketua_rt','pengurus']::public.app_role[]));
create policy "security update guest" on public.guest_logs for update to authenticated
  using (public.has_rt_role(neighborhood_id, array['ketua_rt','pengurus']::public.app_role[]))
  with check (public.has_rt_role(neighborhood_id, array['ketua_rt','pengurus']::public.app_role[]));

-- ---------- system ---------------------------------------------------
create policy "ketua reads audit" on public.audit_logs for select to authenticated
  using (public.has_rt_role(neighborhood_id, array['ketua_rt']::public.app_role[]));
create policy "bendahara reads finance audit" on public.audit_logs for select to authenticated
  using (public.has_rt_role(neighborhood_id, array['bendahara']::public.app_role[])
         and table_name in ('dues_invoices','dues_payments','cash_transactions','dues_types'));
-- audit_logs: tanpa INSERT/UPDATE/DELETE untuk client; ditulis trigger SECURITY DEFINER.
revoke insert, update, delete on public.audit_logs from anon, authenticated;

create policy "members read settings" on public.rt_settings for select to authenticated
  using (public.is_rt_member(neighborhood_id));
create policy "ketua writes settings" on public.rt_settings for insert to authenticated
  with check (public.has_rt_role(neighborhood_id, array['ketua_rt']::public.app_role[]));
create policy "ketua updates settings" on public.rt_settings for update to authenticated
  using (public.has_rt_role(neighborhood_id, array['ketua_rt']::public.app_role[]))
  with check (public.has_rt_role(neighborhood_id, array['ketua_rt']::public.app_role[]));

create policy "adm read resident history" on public.resident_history for select to authenticated
  using (public.has_rt_role(neighborhood_id, array['ketua_rt','sekretaris']::public.app_role[]));

create policy "read own preferences" on public.user_preferences for select to authenticated
  using (user_id = (select auth.uid()));
create policy "insert own preferences" on public.user_preferences for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "update own preferences" on public.user_preferences for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
