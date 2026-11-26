-- =====================================================================
-- WargaKu · Migration 0006 · Hak akses tabel untuk Data API
-- Project Supabase baru tidak lagi otomatis memberi hak tabel ke peran
-- anon/authenticated. Hak diberikan eksplisit di sini; baris mana yang
-- boleh dibaca/diubah tetap ditentukan RLS (migration 0002).
-- anon tidak mendapat akses tabel apa pun.
-- =====================================================================

grant usage on schema public to authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ---------- Pembatasan khusus (diterapkan ulang setelah grant massal) --
-- Counter nomor dokumen hanya disentuh RPC SECURITY DEFINER.
revoke all on public.document_counters from anon, authenticated;
revoke all on public.letter_number_sequences from anon, authenticated;

-- Audit log: baca saja (sesuai RLS); ditulis oleh trigger/RPC.
revoke insert, update, delete on public.audit_logs from authenticated;

-- Notifikasi: pengguna hanya boleh menandai sudah dibaca.
revoke insert, update, delete on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Profil: pengguna mengubah nama/HP/foto sendiri; email & status aktif lewat Auth/RPC.
revoke insert, update, delete on public.profiles from authenticated;
grant update (full_name, phone, avatar_url) on public.profiles to authenticated;

-- Keanggotaan & role hanya lewat RPC assign_member_role / set_member_active.
revoke insert, update, delete on public.user_memberships from authenticated;

-- Riwayat perubahan warga ditulis trigger.
revoke insert, update, delete on public.resident_history from authenticated;
revoke insert, update, delete on public.letter_request_history from authenticated;
revoke insert, update, delete on public.complaint_updates from authenticated;

-- View: baca saja. households_safe/residents_directory berjalan dengan hak pemilik
-- (security_invoker = false), jadi tulis lewat view harus ditutup.
revoke insert, update, delete on public.households_safe, public.residents_directory, public.cash_balance from authenticated;

-- Tabel yang ditulis hanya lewat RPC (status/penomoran/keuangan).
revoke insert, update, delete on public.dues_invoices from authenticated;
revoke update, delete on public.dues_payments from authenticated;
revoke insert, update, delete on public.cash_transactions from authenticated;
revoke update, delete on public.letter_requests from authenticated;
revoke update, delete on public.complaints from authenticated;

-- ---------- Tabel baru di masa depan ----------------------------------
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant usage, select on sequences to authenticated;
