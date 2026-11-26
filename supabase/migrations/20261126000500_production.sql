-- =====================================================================
-- WargaKu · Migration 0005 · Production wiring
-- Melengkapi apa yang dibutuhkan aplikasi saat terhubung langsung:
-- kolom tambahan, profil otomatis, nomor otomatis, riwayat & notifikasi
-- via trigger, validasi pembayaran, RPC tambahan, perbaikan akses KK.
-- =====================================================================

-- ---------- Kolom tambahan ------------------------------------------
alter table public.dues_payments add column if not exists note text;
alter table public.patrol_teams add column if not exists weekdays smallint[] not null default '{}';

-- ---------- Profil otomatis saat akun Auth dibuat --------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, email, phone)
  values (new.id,
          coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1)),
          new.email,
          new.raw_user_meta_data->>'phone')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- No. KK hanya untuk Ketua RT & Sekretaris ------------------
-- Bendahara/Pengurus membaca rumah lewat view households_safe (tanpa No. KK).
drop policy if exists "managers read households" on public.households;
create policy "adm read households" on public.households for select to authenticated
  using (public.has_rt_role(neighborhood_id, array['ketua_rt','sekretaris']::public.app_role[]));

-- ---------- Nama anggota RT (tanpa data pribadi lain) ----------------
-- Dipakai untuk menampilkan "oleh siapa" pada riwayat surat, pengaduan,
-- pengumuman, dan audit tanpa membuka tabel profiles.
create or replace function public.member_names(p_neighborhood_id uuid)
returns table(user_id uuid, full_name text, role public.app_role, is_active boolean)
language sql stable security definer set search_path = '' as $$
  select p.id, p.full_name, m.role, (m.is_active and p.is_active)
  from public.user_memberships m join public.profiles p on p.id = m.user_id
  where m.neighborhood_id = p_neighborhood_id and public.is_rt_member(p_neighborhood_id);
$$;
revoke all on function public.member_names(uuid) from public;
grant execute on function public.member_names(uuid) to authenticated;

-- ---------- Nomor otomatis -------------------------------------------
create or replace function public.assign_request_number()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_now timestamp := now() at time zone 'Asia/Jakarta'; v_no int;
begin
  if new.request_number is null or new.request_number = '' then
    v_no := public.next_document_number(new.neighborhood_id, 'request', to_char(v_now, 'YYYY'));
    new.request_number := format('REQ/%s/%s', to_char(v_now, 'YYYYMM'), lpad(v_no::text, 4, '0'));
  end if;
  return new;
end $$;
alter table public.letter_requests alter column request_number drop not null;
drop trigger if exists trg_letter_number on public.letter_requests;
create trigger trg_letter_number before insert on public.letter_requests
  for each row execute function public.assign_request_number();
alter table public.letter_requests add constraint letter_requests_number_present check (request_number is not null) not valid;

create or replace function public.assign_ticket_number()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_now timestamp := now() at time zone 'Asia/Jakarta'; v_no int;
begin
  if new.ticket_number is null or new.ticket_number = '' then
    v_no := public.next_document_number(new.neighborhood_id, 'complaint', to_char(v_now, 'YYYY'));
    new.ticket_number := format('ADU/%s/%s', to_char(v_now, 'YYYYMM'), lpad(v_no::text, 3, '0'));
  end if;
  return new;
end $$;
alter table public.complaints alter column ticket_number drop not null;
drop trigger if exists trg_ticket_number on public.complaints;
create trigger trg_ticket_number before insert on public.complaints
  for each row execute function public.assign_ticket_number();

-- ---------- Riwayat & notifikasi saat data baru masuk -----------------
create or replace function public.notify_roles(p_neighborhood_id uuid, p_roles public.app_role[], p_title text,
  p_message text, p_type text, p_ref uuid, p_except uuid default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (neighborhood_id, user_id, title, message, type, reference_id)
  select p_neighborhood_id, m.user_id, p_title, p_message, p_type, p_ref
  from public.user_memberships m
  where m.neighborhood_id = p_neighborhood_id and m.is_active and m.role = any(p_roles)
    and (p_except is null or m.user_id <> p_except);
$$;
revoke all on function public.notify_roles(uuid, public.app_role[], text, text, text, uuid, uuid) from public, authenticated;

create or replace function public.on_letter_submitted()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_name text; v_type text;
begin
  insert into public.letter_request_history (neighborhood_id, request_id, status, note, changed_by)
  values (new.neighborhood_id, new.id, 'submitted', null, (select auth.uid()));
  select full_name into v_name from public.residents where id = new.resident_id;
  select name into v_type from public.letter_types where id = new.letter_type_id;
  perform public.notify_roles(new.neighborhood_id, array['sekretaris']::public.app_role[],
    'Permohonan surat baru', format('%s mengajukan %s.', v_name, v_type), 'letter', new.id);
  return new;
end $$;
drop trigger if exists trg_letter_submitted on public.letter_requests;
create trigger trg_letter_submitted after insert on public.letter_requests
  for each row execute function public.on_letter_submitted();

create or replace function public.on_complaint_filed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.complaint_updates (neighborhood_id, complaint_id, status, message, updated_by)
  values (new.neighborhood_id, new.id, 'submitted', 'Pengaduan diterima sistem', new.created_by);
  perform public.notify_roles(new.neighborhood_id, array['ketua_rt']::public.app_role[],
    case when new.priority = 'darurat' then 'Pengaduan darurat baru' else 'Pengaduan baru' end,
    new.title, 'complaint', new.id);
  return new;
end $$;
drop trigger if exists trg_complaint_filed on public.complaints;
create trigger trg_complaint_filed after insert on public.complaints
  for each row execute function public.on_complaint_filed();

create or replace function public.on_incident_reported()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify_roles(new.neighborhood_id, array['ketua_rt','pengurus']::public.app_role[],
    'Laporan kejadian keamanan', new.title, 'security', new.id, new.reported_by);
  return new;
end $$;
drop trigger if exists trg_incident_reported on public.security_incidents;
create trigger trg_incident_reported after insert on public.security_incidents
  for each row execute function public.on_incident_reported();

create or replace function public.on_activity_created()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify_roles(new.neighborhood_id, array['ketua_rt','sekretaris','bendahara','pengurus','warga']::public.app_role[],
    'Kegiatan baru', format('%s · %s', new.title, coalesce(new.location, '')), 'activity', new.id, new.created_by);
  return new;
end $$;
drop trigger if exists trg_activity_created on public.activities;
create trigger trg_activity_created after insert on public.activities
  for each row execute function public.on_activity_created();

create or replace function public.on_announcement_draft()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'draft' and not public.has_rt_role(new.neighborhood_id, array['ketua_rt','sekretaris']::public.app_role[]) then
    perform public.notify_roles(new.neighborhood_id, array['ketua_rt','sekretaris']::public.app_role[],
      'Draft pengumuman baru', format('"%s" menunggu publikasi.', new.title), 'announcement', new.id);
  end if;
  return new;
end $$;
drop trigger if exists trg_announcement_draft on public.announcements;
create trigger trg_announcement_draft after insert on public.announcements
  for each row execute function public.on_announcement_draft();

-- ---------- Validasi pembayaran sebelum masuk -------------------------
-- Upload bukti hanya membuat status pending; nominal tidak boleh melebihi
-- sisa tagihan dikurangi pembayaran lain yang masih menunggu.
create or replace function public.validate_payment_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_inv public.dues_invoices; v_pending numeric(14,2);
begin
  select * into v_inv from public.dues_invoices where id = new.invoice_id for update;
  if not found then raise exception 'Tagihan tidak ditemukan'; end if;
  if v_inv.status in ('paid','cancelled') then raise exception 'Tagihan ini sudah lunas atau dibatalkan'; end if;
  if new.payment_method = 'transfer' and new.proof_path is null then raise exception 'Unggah bukti transfer'; end if;
  select coalesce(sum(amount), 0) into v_pending from public.dues_payments
   where invoice_id = new.invoice_id and status = 'pending';
  if new.amount > v_inv.amount - v_inv.paid_amount - v_pending then
    raise exception 'Nominal melebihi sisa tagihan (Rp%)', greatest(v_inv.amount - v_inv.paid_amount - v_pending, 0);
  end if;
  new.status := 'pending';
  new.verified_by := null;
  new.verified_at := null;
  return new;
end $$;
drop trigger if exists trg_validate_payment on public.dues_payments;
create trigger trg_validate_payment before insert on public.dues_payments
  for each row execute function public.validate_payment_insert();

create or replace function public.on_payment_submitted()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_house text;
begin
  select house_number into v_house from public.households where id = new.household_id;
  perform public.notify_roles(new.neighborhood_id, array['bendahara']::public.app_role[],
    'Pembayaran menunggu verifikasi', format('%s · Rp%s', v_house, to_char(new.amount, 'FM999G999G999')), 'payment', new.id);
  return new;
end $$;
drop trigger if exists trg_payment_submitted on public.dues_payments;
create trigger trg_payment_submitted after insert on public.dues_payments
  for each row execute function public.on_payment_submitted();

-- ---------- RPC tambahan ---------------------------------------------
create or replace function public.resubmit_letter_request(p_request_id uuid, p_purpose text, p_form_data jsonb)
returns public.letter_requests language plpgsql security definer set search_path = '' as $$
declare v public.letter_requests;
begin
  select * into v from public.letter_requests where id = p_request_id for update;
  if not found then raise exception 'Permohonan tidak ditemukan'; end if;
  if v.status <> 'revision' then raise exception 'Permohonan tidak sedang perlu perbaikan'; end if;
  if not (v.resident_id in (select public.my_resident_ids())
          or public.has_rt_role(v.neighborhood_id, array['ketua_rt','sekretaris']::public.app_role[])) then
    raise exception 'Tidak berwenang' using errcode = '42501';
  end if;
  if coalesce(trim(p_purpose), '') = '' then raise exception 'Keperluan wajib diisi'; end if;
  update public.letter_requests set purpose = trim(p_purpose), form_data = coalesce(p_form_data, '{}'::jsonb), status = 'submitted'
   where id = v.id returning * into v;
  insert into public.letter_request_history (neighborhood_id, request_id, status, note, changed_by)
  values (v.neighborhood_id, v.id, 'submitted', 'Diperbaiki pemohon', (select auth.uid()));
  perform public.notify_roles(v.neighborhood_id, array['sekretaris']::public.app_role[],
    'Permohonan diperbaiki', format('%s siap diperiksa ulang.', v.request_number), 'letter', v.id);
  return v;
end $$;

create or replace function public.mark_letter_completed(p_request_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.letter_requests;
begin
  select * into v from public.letter_requests where id = p_request_id for update;
  if not found or v.status <> 'approved' then return; end if;
  if not (v.resident_id in (select public.my_resident_ids())) then return; end if;
  update public.letter_requests set status = 'completed' where id = v.id;
  insert into public.letter_request_history (neighborhood_id, request_id, status, note, changed_by)
  values (v.neighborhood_id, v.id, 'completed', 'Dokumen PDF diunduh', (select auth.uid()));
end $$;

create or replace function public.cancel_invoice(p_invoice_id uuid)
returns public.dues_invoices language plpgsql security definer set search_path = '' as $$
declare v public.dues_invoices;
begin
  select * into v from public.dues_invoices where id = p_invoice_id for update;
  if not found then raise exception 'Tagihan tidak ditemukan'; end if;
  if not public.has_rt_role(v.neighborhood_id, array['ketua_rt','bendahara']::public.app_role[]) then
    raise exception 'Tidak berwenang' using errcode = '42501';
  end if;
  if v.paid_amount > 0 then raise exception 'Tagihan yang sudah dibayar sebagian tidak dapat dibatalkan'; end if;
  if exists (select 1 from public.dues_payments where invoice_id = v.id and status = 'pending') then
    raise exception 'Masih ada pembayaran menunggu verifikasi';
  end if;
  update public.dues_invoices set status = 'cancelled' where id = v.id returning * into v;
  perform public.write_audit(v.neighborhood_id, 'cancel_invoice', 'dues_invoices', v.id, null, to_jsonb(v));
  return v;
end $$;

create or replace function public.record_cash_income(p_neighborhood_id uuid, p_category_id uuid,
  p_amount numeric, p_date date, p_description text)
returns public.cash_transactions language plpgsql security definer set search_path = '' as $$
declare v_tx public.cash_transactions; v_no int;
begin
  if not public.has_rt_role(p_neighborhood_id, array['ketua_rt','bendahara']::public.app_role[]) then
    raise exception 'Tidak berwenang' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Nominal harus lebih dari 0'; end if;
  if coalesce(trim(p_description), '') = '' then raise exception 'Keterangan wajib diisi'; end if;
  if not exists (select 1 from public.cash_categories where id = p_category_id and neighborhood_id = p_neighborhood_id
                 and transaction_type = 'income' and name <> 'Iuran Warga') then
    raise exception 'Kategori pemasukan tidak valid (iuran tercatat otomatis lewat verifikasi)';
  end if;
  v_no := public.next_document_number(p_neighborhood_id, 'cash', extract(year from p_date)::text);
  insert into public.cash_transactions (neighborhood_id, category_id, transaction_number, transaction_type,
    amount, transaction_date, description, recorded_by)
  values (p_neighborhood_id, p_category_id, format('KAS/%s/%s', extract(year from p_date), lpad(v_no::text,5,'0')),
    'income', p_amount, p_date, trim(p_description), (select auth.uid()))
  returning * into v_tx;
  perform public.write_audit(p_neighborhood_id, 'record_income', 'cash_transactions', v_tx.id, null, to_jsonb(v_tx));
  return v_tx;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.resubmit_letter_request(uuid, text, jsonb)',
    'public.mark_letter_completed(uuid)',
    'public.cancel_invoice(uuid)',
    'public.record_cash_income(uuid, uuid, numeric, date, text)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- ---------- Audit pengaduan & role untuk riwayat yang lengkap ----------
drop trigger if exists audit_complaints on public.complaints;
create trigger audit_complaints after update on public.complaints
  for each row execute function public.audit_row_change();

-- ---------- Realtime untuk notifikasi --------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.notifications;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
