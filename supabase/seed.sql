-- =====================================================================
-- WargaKu · Seed data master (aman dijalankan ulang)
-- Data RT di bawah adalah CONTOH. Ganti dengan identitas RT Anda.
-- Akun pengguna dibuat lewat Supabase Auth, lalu jalankan
--   select public.assign_member_role('<neighborhood_id>', '<user_id>', 'ketua_rt');
-- memakai service role dari SQL editor untuk Ketua RT pertama.
-- =====================================================================

insert into public.neighborhoods (id, name, rt_number, rw_number, village, district, city, province, postal_code, address)
values ('00000000-0000-4000-8000-000000000001', 'Perumahan Griya Asri', '001', '001',
        'Sukamaju', 'Cibodas', 'Kota Tangerang', 'Banten', '15138', 'Jl. Melati Raya, Griya Asri')
on conflict (id) do nothing;

insert into public.letter_types (neighborhood_id, code, name, description) values
  ('00000000-0000-4000-8000-000000000001', 'SP',  'Surat Pengantar',            'Pengantar ke kelurahan/instansi'),
  ('00000000-0000-4000-8000-000000000001', 'SKD', 'Surat Keterangan Domisili',  'Keterangan tempat tinggal'),
  ('00000000-0000-4000-8000-000000000001', 'SKU', 'Surat Keterangan Usaha',     'Keterangan memiliki usaha'),
  ('00000000-0000-4000-8000-000000000001', 'SKTM','Surat Keterangan Tidak Mampu','Untuk keringanan biaya')
on conflict (neighborhood_id, code) do nothing;

insert into public.dues_types (neighborhood_id, name, description, amount, billing_period) values
  ('00000000-0000-4000-8000-000000000001', 'Iuran Kebersihan & Keamanan', 'Sampah, ronda, penerangan jalan', 50000, 'bulanan'),
  ('00000000-0000-4000-8000-000000000001', 'Iuran Sosial',               'Santunan duka & sakit',              10000, 'bulanan'),
  ('00000000-0000-4000-8000-000000000001', 'Iuran HUT RI',               'Lomba & dekorasi Agustusan',          75000, 'insidental');

insert into public.cash_categories (neighborhood_id, name, transaction_type) values
  ('00000000-0000-4000-8000-000000000001', 'Iuran Warga',        'income'),
  ('00000000-0000-4000-8000-000000000001', 'Donasi',             'income'),
  ('00000000-0000-4000-8000-000000000001', 'Kebersihan',         'expense'),
  ('00000000-0000-4000-8000-000000000001', 'Keamanan',           'expense'),
  ('00000000-0000-4000-8000-000000000001', 'Kegiatan Warga',     'expense'),
  ('00000000-0000-4000-8000-000000000001', 'Sosial',             'expense'),
  ('00000000-0000-4000-8000-000000000001', 'Perbaikan Fasilitas','expense'),
  ('00000000-0000-4000-8000-000000000001', 'Administrasi',       'expense')
on conflict do nothing;

insert into public.complaint_categories (neighborhood_id, name) values
  ('00000000-0000-4000-8000-000000000001', 'Kebersihan'),
  ('00000000-0000-4000-8000-000000000001', 'Keamanan'),
  ('00000000-0000-4000-8000-000000000001', 'Fasilitas Umum'),
  ('00000000-0000-4000-8000-000000000001', 'Ketertiban'),
  ('00000000-0000-4000-8000-000000000001', 'Lainnya')
on conflict do nothing;

insert into public.rt_settings (neighborhood_id, setting_key, setting_value) values
  ('00000000-0000-4000-8000-000000000001', 'letter_number_format', '"{no}/RT.{rt}/{bulan_romawi}/{tahun}"'),
  ('00000000-0000-4000-8000-000000000001', 'bank_account', '{"bank":"","name":"","number":""}'),
  ('00000000-0000-4000-8000-000000000001', 'expense_approval', '"bendahara_catat_ketua_lihat"')
on conflict do nothing;
