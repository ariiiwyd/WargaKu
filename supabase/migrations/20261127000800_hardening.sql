-- =====================================================================
-- WargaKu · Migration 0008 · Pengerasan hak eksekusi fungsi
-- Temuan Supabase Advisors: fungsi trigger internal tercatat bisa dipanggil
-- lewat /rest/v1/rpc oleh anon/authenticated. Trigger tetap berjalan tanpa
-- hak EXECUTE milik pengguna (hak hanya diperiksa saat CREATE TRIGGER),
-- jadi hak tersebut dicabut. RPC aplikasi tidak berubah.
-- =====================================================================

do $$
declare f text;
begin
  foreach f in array array[
    'public.touch_updated_at()',
    'public.audit_row_change()',
    'public.track_resident_history()',
    'public.handle_new_user()',
    'public.assign_request_number()',
    'public.assign_ticket_number()',
    'public.on_letter_submitted()',
    'public.on_complaint_filed()',
    'public.on_incident_reported()',
    'public.on_activity_created()',
    'public.on_announcement_draft()',
    'public.validate_payment_insert()',
    'public.on_payment_submitted()',
    'public.on_meeting_started()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;

-- Fungsi bantu nomor bulan Romawi & path storage tidak perlu dipanggil dari luar.
revoke all on function public.roman_month(int) from public, anon, authenticated;
grant execute on function public.storage_rt(text) to authenticated;
revoke all on function public.storage_rt(text) from public, anon;
