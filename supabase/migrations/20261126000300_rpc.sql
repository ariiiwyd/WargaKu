-- =====================================================================
-- WargaKu · Migration 0003 · RPC transaksi sensitif, audit trigger
-- Semua fungsi: SECURITY DEFINER, search_path kosong, nama terkualifikasi,
-- pemeriksaan role eksplisit, dan satu transaksi (rollback bila gagal).
-- =====================================================================

-- ---------- Penomoran atomik ----------------------------------------
create or replace function public.next_document_number(p_neighborhood_id uuid, p_type text, p_period text)
returns int language plpgsql security definer set search_path = '' as $$
declare v int;
begin
  insert into public.document_counters as c (neighborhood_id, document_type, period_key, last_number)
  values (p_neighborhood_id, p_type, p_period, 1)
  on conflict (neighborhood_id, document_type, period_key)
  do update set last_number = c.last_number + 1
  returning c.last_number into v;     -- baris terkunci sampai transaksi selesai
  return v;
end $$;
revoke all on function public.next_document_number(uuid, text, text) from public, authenticated;

create or replace function public.roman_month(p_month int)
returns text language sql immutable set search_path = '' as $$
  select (array['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'])[p_month];
$$;

-- ---------- Audit helper --------------------------------------------
create or replace function public.write_audit(p_neighborhood_id uuid, p_action text, p_table text,
  p_record uuid, p_old jsonb, p_new jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_logs (neighborhood_id, user_id, action, table_name, record_id, old_data, new_data)
  values (p_neighborhood_id, (select auth.uid()), p_action, p_table, p_record,
          p_old - 'nik' - 'family_card_number', p_new - 'nik' - 'family_card_number');
$$;
revoke all on function public.write_audit(uuid, text, text, uuid, jsonb, jsonb) from public, authenticated;

create or replace function public.audit_row_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.write_audit(
    coalesce(new.neighborhood_id, old.neighborhood_id),
    lower(tg_op), tg_table_name,
    coalesce(new.id, old.id),
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

create trigger audit_residents after insert or update or delete on public.residents
  for each row execute function public.audit_row_change();
create trigger audit_households after insert or update or delete on public.households
  for each row execute function public.audit_row_change();
create trigger audit_memberships after insert or update or delete on public.user_memberships
  for each row execute function public.audit_row_change();
create trigger audit_dues_types after insert or update or delete on public.dues_types
  for each row execute function public.audit_row_change();
create trigger audit_letters after update on public.letter_requests
  for each row execute function public.audit_row_change();

-- Riwayat perubahan data warga
create or replace function public.track_resident_history()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.resident_history (neighborhood_id, resident_id, change_type, old_data, new_data, changed_by)
  values (new.neighborhood_id, new.id, lower(tg_op),
          case when tg_op = 'UPDATE' then to_jsonb(old) - 'nik' end, to_jsonb(new) - 'nik', (select auth.uid()));
  return new;
end $$;
create trigger history_residents after insert or update on public.residents
  for each row execute function public.track_resident_history();

-- ---------- Notifikasi helper ---------------------------------------
create or replace function public.notify_user(p_neighborhood_id uuid, p_user uuid, p_title text,
  p_message text, p_type text, p_ref uuid)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (neighborhood_id, user_id, title, message, type, reference_id)
  select p_neighborhood_id, p_user, p_title, p_message, p_type, p_ref where p_user is not null;
$$;
revoke all on function public.notify_user(uuid, uuid, text, text, text, uuid) from public, authenticated;

-- Kirim ke semua akun di keluarga tertentu
create or replace function public.notify_household(p_household uuid, p_title text, p_message text, p_type text, p_ref uuid)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (neighborhood_id, user_id, title, message, type, reference_id)
  select distinct r.neighborhood_id, r.user_id, p_title, p_message, p_type, p_ref
  from public.residents r where r.household_id = p_household and r.user_id is not null;
$$;
revoke all on function public.notify_household(uuid, text, text, text, uuid) from public, authenticated;

-- =====================================================================
-- KEUANGAN
-- =====================================================================

-- Membuat tagihan dengan validasi periode & duplikasi
create or replace function public.create_invoice(p_household_id uuid, p_dues_type_id uuid,
  p_period_year int, p_period_month int default null, p_amount numeric default null, p_due_date date default null)
returns public.dues_invoices language plpgsql security definer set search_path = '' as $$
declare
  v_type public.dues_types;
  v_hh public.households;
  v_no int;
  v_inv public.dues_invoices;
begin
  select * into v_hh from public.households where id = p_household_id;
  if not found then raise exception 'Keluarga tidak ditemukan'; end if;
  if not public.has_rt_role(v_hh.neighborhood_id, array['ketua_rt','bendahara']::public.app_role[]) then
    raise exception 'Tidak berwenang membuat tagihan' using errcode = '42501';
  end if;
  select * into v_type from public.dues_types where id = p_dues_type_id and neighborhood_id = v_hh.neighborhood_id and is_active;
  if not found then raise exception 'Jenis iuran tidak aktif atau berbeda RT'; end if;
  if v_type.billing_period = 'bulanan' and p_period_month is null then
    raise exception 'Iuran bulanan wajib mencantumkan bulan';
  end if;

  v_no := public.next_document_number(v_hh.neighborhood_id, 'invoice', p_period_year::text);
  insert into public.dues_invoices (neighborhood_id, household_id, dues_type_id, invoice_number,
    period_month, period_year, amount, due_date, created_by)
  values (v_hh.neighborhood_id, v_hh.id, v_type.id,
    format('INV/%s/%s', p_period_year, lpad(v_no::text, 5, '0')),
    case when v_type.billing_period = 'bulanan' then p_period_month end,
    p_period_year, coalesce(p_amount, v_type.amount), p_due_date, (select auth.uid()))
  returning * into v_inv;   -- uq_invoice_period menolak duplikat periode

  perform public.write_audit(v_inv.neighborhood_id, 'create_invoice', 'dues_invoices', v_inv.id, null, to_jsonb(v_inv));
  perform public.notify_household(v_hh.id, 'Tagihan baru',
    format('%s · Rp%s', v_type.name, to_char(v_inv.amount, 'FM999G999G999')), 'invoice', v_inv.id);
  return v_inv;
end $$;

-- Verifikasi pembayaran: atomik, idempotent, tidak melebihi sisa tagihan (PRD §8.2)
create or replace function public.verify_dues_payment(p_payment_id uuid)
returns public.dues_payments language plpgsql security definer set search_path = '' as $$
declare
  v_pay public.dues_payments;
  v_inv public.dues_invoices;
  v_cat uuid;
  v_no int;
  v_new_paid numeric(14,2);
begin
  -- 2. Kunci pembayaran
  select * into v_pay from public.dues_payments where id = p_payment_id for update;
  if not found then raise exception 'Pembayaran tidak ditemukan'; end if;

  -- 1. Role
  if not public.has_rt_role(v_pay.neighborhood_id, array['ketua_rt','bendahara']::public.app_role[]) then
    raise exception 'Tidak berwenang memverifikasi' using errcode = '42501';
  end if;

  -- 3. Masih pending
  if v_pay.status <> 'pending' then
    raise exception 'Pembayaran sudah diproses (%)', v_pay.status;
  end if;

  -- 2 & 4. Kunci invoice, cek RT & keluarga sama
  select * into v_inv from public.dues_invoices where id = v_pay.invoice_id for update;
  if v_inv.neighborhood_id <> v_pay.neighborhood_id or v_inv.household_id <> v_pay.household_id then
    raise exception 'Pembayaran dan tagihan tidak cocok';
  end if;
  if v_inv.status = 'cancelled' then raise exception 'Tagihan sudah dibatalkan'; end if;

  -- 5. Tidak melampaui sisa
  v_new_paid := v_inv.paid_amount + v_pay.amount;
  if v_new_paid > v_inv.amount then
    raise exception 'Nominal melebihi sisa tagihan (sisa Rp%)', v_inv.amount - v_inv.paid_amount;
  end if;

  -- 6. Status pembayaran
  update public.dues_payments
     set status = 'verified', verified_by = (select auth.uid()), verified_at = now(), rejection_reason = null
   where id = v_pay.id returning * into v_pay;

  -- 7. Invoice
  update public.dues_invoices
     set paid_amount = v_new_paid,
         status = case when v_new_paid = amount then 'paid'::public.invoice_status else 'partial'::public.invoice_status end
   where id = v_inv.id;

  -- 8. Satu transaksi income (payment_id unique mencegah ganda)
  select id into v_cat from public.cash_categories
   where neighborhood_id = v_pay.neighborhood_id and transaction_type = 'income' and name = 'Iuran Warga' limit 1;
  v_no := public.next_document_number(v_pay.neighborhood_id, 'cash', to_char(now() at time zone 'Asia/Jakarta', 'YYYY'));
  insert into public.cash_transactions (neighborhood_id, category_id, payment_id, transaction_number,
    transaction_type, amount, transaction_date, description, recorded_by)
  values (v_pay.neighborhood_id, v_cat, v_pay.id,
    format('KAS/%s/%s', to_char(now() at time zone 'Asia/Jakarta', 'YYYY'), lpad(v_no::text, 5, '0')),
    'income', v_pay.amount, v_pay.payment_date,
    format('Pembayaran %s', v_inv.invoice_number), (select auth.uid()));

  -- 9. Audit
  perform public.write_audit(v_pay.neighborhood_id, 'verify_payment', 'dues_payments', v_pay.id,
    jsonb_build_object('status','pending'), to_jsonb(v_pay));

  -- 10. Notifikasi
  perform public.notify_household(v_pay.household_id, 'Pembayaran diverifikasi',
    format('Pembayaran Rp%s untuk %s telah diterima.', to_char(v_pay.amount, 'FM999G999G999'), v_inv.invoice_number),
    'payment', v_pay.id);
  return v_pay;
end $$;

create or replace function public.reject_dues_payment(p_payment_id uuid, p_reason text)
returns public.dues_payments language plpgsql security definer set search_path = '' as $$
declare v_pay public.dues_payments;
begin
  if coalesce(trim(p_reason), '') = '' then raise exception 'Alasan penolakan wajib diisi'; end if;
  select * into v_pay from public.dues_payments where id = p_payment_id for update;
  if not found then raise exception 'Pembayaran tidak ditemukan'; end if;
  if not public.has_rt_role(v_pay.neighborhood_id, array['ketua_rt','bendahara']::public.app_role[]) then
    raise exception 'Tidak berwenang' using errcode = '42501';
  end if;
  if v_pay.status <> 'pending' then raise exception 'Pembayaran sudah diproses'; end if;
  update public.dues_payments set status = 'rejected', rejection_reason = trim(p_reason),
         verified_by = (select auth.uid()), verified_at = now()
   where id = v_pay.id returning * into v_pay;
  perform public.write_audit(v_pay.neighborhood_id, 'reject_payment', 'dues_payments', v_pay.id, null, to_jsonb(v_pay));
  perform public.notify_household(v_pay.household_id, 'Pembayaran ditolak', trim(p_reason), 'payment', v_pay.id);
  return v_pay;
end $$;

create or replace function public.record_cash_expense(p_neighborhood_id uuid, p_category_id uuid,
  p_amount numeric, p_date date, p_description text, p_proof_path text default null)
returns public.cash_transactions language plpgsql security definer set search_path = '' as $$
declare v_tx public.cash_transactions; v_no int;
begin
  if not public.has_rt_role(p_neighborhood_id, array['ketua_rt','bendahara']::public.app_role[]) then
    raise exception 'Tidak berwenang' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Nominal harus lebih dari 0'; end if;
  if coalesce(trim(p_description), '') = '' then raise exception 'Keterangan wajib diisi'; end if;
  if not exists (select 1 from public.cash_categories where id = p_category_id
                 and neighborhood_id = p_neighborhood_id and transaction_type = 'expense') then
    raise exception 'Kategori pengeluaran tidak valid';
  end if;
  if exists (select 1 from public.financial_periods where neighborhood_id = p_neighborhood_id
             and period_year = extract(year from p_date) and period_month = extract(month from p_date)
             and closed_at is not null) then
    raise exception 'Periode keuangan sudah ditutup';
  end if;
  v_no := public.next_document_number(p_neighborhood_id, 'cash', extract(year from p_date)::text);
  insert into public.cash_transactions (neighborhood_id, category_id, transaction_number, transaction_type,
    amount, transaction_date, description, proof_path, recorded_by)
  values (p_neighborhood_id, p_category_id, format('KAS/%s/%s', extract(year from p_date), lpad(v_no::text,5,'0')),
    'expense', p_amount, p_date, trim(p_description), p_proof_path, (select auth.uid()))
  returning * into v_tx;
  perform public.write_audit(p_neighborhood_id, 'record_expense', 'cash_transactions', v_tx.id, null, to_jsonb(v_tx));
  return v_tx;
end $$;

-- Koreksi = transaksi pembalik, bukan hapus (PRD §4.3)
create or replace function public.reverse_cash_transaction(p_tx_id uuid, p_reason text)
returns public.cash_transactions language plpgsql security definer set search_path = '' as $$
declare v_old public.cash_transactions; v_tx public.cash_transactions; v_no int;
begin
  select * into v_old from public.cash_transactions where id = p_tx_id for update;
  if not found then raise exception 'Transaksi tidak ditemukan'; end if;
  if not public.has_rt_role(v_old.neighborhood_id, array['ketua_rt','bendahara']::public.app_role[]) then
    raise exception 'Tidak berwenang' using errcode = '42501';
  end if;
  if v_old.payment_id is not null then raise exception 'Pemasukan iuran dikoreksi lewat pembatalan pembayaran'; end if;
  v_no := public.next_document_number(v_old.neighborhood_id, 'cash', to_char(now() at time zone 'Asia/Jakarta','YYYY'));
  insert into public.cash_transactions (neighborhood_id, category_id, reverses_id, transaction_number,
    transaction_type, amount, transaction_date, description, recorded_by)
  values (v_old.neighborhood_id, null, v_old.id,
    format('KAS/%s/%s', to_char(now() at time zone 'Asia/Jakarta','YYYY'), lpad(v_no::text,5,'0')),
    case when v_old.transaction_type = 'income' then 'expense'::public.transaction_type else 'income'::public.transaction_type end,
    v_old.amount, (now() at time zone 'Asia/Jakarta')::date,
    format('Koreksi %s: %s', v_old.transaction_number, p_reason), (select auth.uid()))
  returning * into v_tx;
  perform public.write_audit(v_old.neighborhood_id, 'reverse_transaction', 'cash_transactions', v_tx.id, to_jsonb(v_old), to_jsonb(v_tx));
  return v_tx;
end $$;

-- =====================================================================
-- SURAT
-- =====================================================================
create or replace function public.review_letter_request(p_request_id uuid, p_accept boolean, p_note text default null)
returns public.letter_requests language plpgsql security definer set search_path = '' as $$
declare v public.letter_requests; v_user uuid;
begin
  select * into v from public.letter_requests where id = p_request_id for update;
  if not found then raise exception 'Permohonan tidak ditemukan'; end if;
  if not public.has_rt_role(v.neighborhood_id, array['ketua_rt','sekretaris']::public.app_role[]) then
    raise exception 'Tidak berwenang' using errcode = '42501';
  end if;
  if v.status not in ('submitted','revision') then raise exception 'Status tidak dapat diperiksa'; end if;
  if not p_accept and coalesce(trim(p_note),'') = '' then raise exception 'Catatan perbaikan wajib diisi'; end if;
  update public.letter_requests
     set status = case when p_accept then 'review'::public.request_status else 'revision'::public.request_status end,
         reviewed_by = (select auth.uid()), reviewed_at = now(), review_note = p_note
   where id = v.id returning * into v;
  insert into public.letter_request_history (neighborhood_id, request_id, status, note, changed_by)
  values (v.neighborhood_id, v.id, v.status, p_note, (select auth.uid()));
  select user_id into v_user from public.residents where id = v.resident_id;
  perform public.notify_user(v.neighborhood_id, v_user,
    case when p_accept then 'Surat sedang menunggu tanda tangan' else 'Permohonan surat perlu diperbaiki' end,
    coalesce(p_note, v.request_number), 'letter', v.id);
  return v;
end $$;

-- Persetujuan final Ketua RT + nomor surat atomik
create or replace function public.approve_letter_request(p_request_id uuid, p_approve boolean, p_reason text default null)
returns public.letter_requests language plpgsql security definer set search_path = '' as $$
declare
  v public.letter_requests; v_no int; v_rt text; v_user uuid;
  v_now timestamp := now() at time zone 'Asia/Jakarta';
begin
  select * into v from public.letter_requests where id = p_request_id for update;
  if not found then raise exception 'Permohonan tidak ditemukan'; end if;
  if not public.has_rt_role(v.neighborhood_id, array['ketua_rt']::public.app_role[]) then
    raise exception 'Hanya Ketua RT yang dapat memberi persetujuan final' using errcode = '42501';
  end if;
  if v.status <> 'review' then raise exception 'Permohonan belum diperiksa Sekretaris'; end if;

  if p_approve then
    select lpad(rt_number, 3, '0') into v_rt from public.neighborhoods where id = v.neighborhood_id;
    v_no := public.next_document_number(v.neighborhood_id, 'letter', to_char(v_now, 'YYYY'));
    update public.letter_requests
       set status = 'approved', approved_by = (select auth.uid()), approved_at = now(),
           letter_number = format('%s/RT.%s/%s/%s', lpad(v_no::text,3,'0'), v_rt,
                                  public.roman_month(extract(month from v_now)::int), to_char(v_now,'YYYY'))
     where id = v.id returning * into v;
  else
    if coalesce(trim(p_reason),'') = '' then raise exception 'Alasan penolakan wajib diisi'; end if;
    update public.letter_requests set status = 'rejected', rejection_reason = trim(p_reason),
           approved_by = null, completed_at = now()
     where id = v.id returning * into v;
  end if;
  insert into public.letter_request_history (neighborhood_id, request_id, status, note, changed_by)
  values (v.neighborhood_id, v.id, v.status, coalesce(p_reason, v.letter_number), (select auth.uid()));
  select user_id into v_user from public.residents where id = v.resident_id;
  perform public.notify_user(v.neighborhood_id, v_user,
    case when p_approve then 'Surat disetujui' else 'Surat ditolak' end,
    case when p_approve then format('Nomor %s siap diunduh.', v.letter_number) else p_reason end, 'letter', v.id);
  return v;
end $$;

-- Alias sesuai PRD §8.1
create or replace function public.issue_letter_number(p_request_id uuid)
returns text language sql security definer set search_path = '' as $$
  select (public.approve_letter_request(p_request_id, true)).letter_number;
$$;

-- =====================================================================
-- PENGUMUMAN, PENGADUAN, ROLE
-- =====================================================================
create or replace function public.publish_announcement(p_announcement_id uuid)
returns public.announcements language plpgsql security definer set search_path = '' as $$
declare v public.announcements;
begin
  select * into v from public.announcements where id = p_announcement_id for update;
  if not found then raise exception 'Pengumuman tidak ditemukan'; end if;
  if not public.has_rt_role(v.neighborhood_id, array['ketua_rt','sekretaris']::public.app_role[]) then
    raise exception 'Tidak berwenang memublikasikan' using errcode = '42501';
  end if;
  if v.status = 'published' then return v; end if;   -- idempotent
  update public.announcements set status = 'published', published_at = now(), published_by = (select auth.uid())
   where id = v.id returning * into v;
  insert into public.notifications (neighborhood_id, user_id, title, message, type, reference_id)
  select v.neighborhood_id, m.user_id, 'Pengumuman: ' || v.title, left(v.content, 140), 'announcement', v.id
  from public.user_memberships m where m.neighborhood_id = v.neighborhood_id and m.is_active;
  perform public.write_audit(v.neighborhood_id, 'publish_announcement', 'announcements', v.id, null, to_jsonb(v));
  return v;
end $$;

create or replace function public.assign_complaint(p_complaint_id uuid, p_assignee uuid, p_note text default null)
returns public.complaints language plpgsql security definer set search_path = '' as $$
declare v public.complaints;
begin
  select * into v from public.complaints where id = p_complaint_id for update;
  if not public.has_rt_role(v.neighborhood_id, array['ketua_rt']::public.app_role[]) then
    raise exception 'Hanya Ketua RT yang menugaskan pengaduan' using errcode = '42501';
  end if;
  if not exists (select 1 from public.user_memberships where user_id = p_assignee
                 and neighborhood_id = v.neighborhood_id and is_active and role <> 'warga') then
    raise exception 'Petugas tidak valid';
  end if;
  update public.complaints set assigned_to = p_assignee, status = 'assigned' where id = v.id returning * into v;
  insert into public.complaint_updates (neighborhood_id, complaint_id, status, message, updated_by)
  values (v.neighborhood_id, v.id, 'assigned', coalesce(p_note, 'Pengaduan ditugaskan'), (select auth.uid()));
  perform public.notify_user(v.neighborhood_id, p_assignee, 'Pengaduan ditugaskan ke Anda', v.title, 'complaint', v.id);
  return v;
end $$;

create or replace function public.update_complaint_status(p_complaint_id uuid,
  p_status public.complaint_status, p_message text)
returns public.complaints language plpgsql security definer set search_path = '' as $$
declare v public.complaints;
begin
  select * into v from public.complaints where id = p_complaint_id for update;
  if not (public.has_rt_role(v.neighborhood_id, array['ketua_rt']::public.app_role[])
          or v.assigned_to = (select auth.uid())) then
    raise exception 'Tidak berwenang' using errcode = '42501';
  end if;
  if coalesce(trim(p_message),'') = '' then raise exception 'Tanggapan wajib diisi'; end if;
  update public.complaints set status = p_status,
    completed_at = case when p_status in ('resolved','closed') then now() end
   where id = v.id returning * into v;
  insert into public.complaint_updates (neighborhood_id, complaint_id, status, message, updated_by)
  values (v.neighborhood_id, v.id, p_status, trim(p_message), (select auth.uid()));
  perform public.notify_user(v.neighborhood_id, v.created_by, 'Pengaduan diperbarui', trim(p_message), 'complaint', v.id);
  return v;
end $$;

create or replace function public.assign_member_role(p_neighborhood_id uuid, p_user uuid,
  p_role public.app_role, p_resident uuid default null)
returns public.user_memberships language plpgsql security definer set search_path = '' as $$
declare v public.user_memberships;
begin
  if not public.has_rt_role(p_neighborhood_id, array['ketua_rt']::public.app_role[]) then
    raise exception 'Hanya Ketua RT yang dapat mengubah role' using errcode = '42501';
  end if;
  if p_user = (select auth.uid()) and p_role <> 'ketua_rt' then
    raise exception 'Ketua RT tidak dapat menurunkan role dirinya sendiri';
  end if;
  insert into public.user_memberships (neighborhood_id, user_id, role, resident_id)
  values (p_neighborhood_id, p_user, p_role, p_resident)
  on conflict (neighborhood_id, user_id) do update
    set role = excluded.role, resident_id = coalesce(excluded.resident_id, public.user_memberships.resident_id), is_active = true
  returning * into v;
  return v;
end $$;

create or replace function public.set_member_active(p_neighborhood_id uuid, p_user uuid, p_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_rt_role(p_neighborhood_id, array['ketua_rt']::public.app_role[]) then
    raise exception 'Tidak berwenang' using errcode = '42501';
  end if;
  if p_user = (select auth.uid()) then raise exception 'Tidak dapat menonaktifkan akun sendiri'; end if;
  update public.user_memberships set is_active = p_active where neighborhood_id = p_neighborhood_id and user_id = p_user;
  -- Histori transaksi tetap utuh; hanya akses yang dicabut.
end $$;

-- Hak eksekusi RPC publik
do $$
declare f text;
begin
  foreach f in array array[
    'public.create_invoice(uuid, uuid, int, int, numeric, date)',
    'public.verify_dues_payment(uuid)',
    'public.reject_dues_payment(uuid, text)',
    'public.record_cash_expense(uuid, uuid, numeric, date, text, text)',
    'public.reverse_cash_transaction(uuid, text)',
    'public.review_letter_request(uuid, boolean, text)',
    'public.approve_letter_request(uuid, boolean, text)',
    'public.issue_letter_number(uuid)',
    'public.publish_announcement(uuid)',
    'public.assign_complaint(uuid, uuid, text)',
    'public.update_complaint_status(uuid, public.complaint_status, text)',
    'public.assign_member_role(uuid, uuid, public.app_role, uuid)',
    'public.set_member_active(uuid, uuid, boolean)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
