# WargaKu

**Satu Aplikasi, Semua Urusan Warga.** — Smart Neighborhood Management System untuk satu RT.

Pusat pelayanan digital warga: data warga & keluarga, surat & layanan, kas & iuran, pengumuman, pengaduan, kegiatan, keamanan, dan laporan. Web responsif + PWA, tema Terang/Gelap/Sistem. Spesifikasi lengkap: [`WargaKu_PRD_Technical_Specification.md`](WargaKu_PRD_Technical_Specification.md).

Stack: React + Vite + TypeScript + Tailwind CSS, Supabase (PostgreSQL, Auth, Storage, Edge Functions, Realtime), Vercel.

## 1. Siapkan Supabase

1. Buat project di [supabase.com](https://supabase.com) (region terdekat, mis. Singapore).
2. **SQL Editor** → jalankan file berikut **berurutan**:
   | File | Isi |
   |---|---|
   | `supabase/migrations/20261126000100_core.sql` | Enum, seluruh tabel, composite FK lintas RT, unique & indeks |
   | `supabase/migrations/20261126000200_rls.sql` | Helper `has_rt_role`, RLS per tabel per operasi, view tanpa NIK/KK |
   | `supabase/migrations/20261126000300_rpc.sql` | Verifikasi pembayaran atomik, nomor surat, kas, pengumuman, role, audit trigger |
   | `supabase/migrations/20261126000400_storage.sql` | Bucket privat & policy Storage |
   | `supabase/migrations/20261126000500_production.sql` | Profil otomatis, nomor otomatis, notifikasi via trigger, validasi pembayaran, RPC tambahan |
   | `supabase/migrations/20261126000600_grants.sql` | Hak tabel eksplisit untuk Data API (project baru tidak memberi hak otomatis) |
   | `supabase/migrations/20261127000700_online_meeting.sql` | Rapat online (tautan Google Meet/Zoom), absensi online, notulen & rekaman |
   | `supabase/seed.sql` | Identitas RT + data master (jenis surat, iuran, kategori kas & pengaduan) |

   Atau dengan Supabase CLI: `supabase link --project-ref <ref>` lalu `supabase db push`.
3. Ubah identitas RT di `seed.sql` (nama perumahan, nomor RT/RW, kelurahan, rekening) sebelum dijalankan, atau ubah nanti dari menu **Pengaturan → Identitas RT**.
4. **Authentication → URL Configuration**: isi *Site URL* dengan alamat aplikasi (mis. `https://wargaku.vercel.app`) dan tambahkan `https://<alamat>/atur-sandi` ke *Redirect URLs*.
5. **Authentication → Providers → Email**: matikan *Allow new users to sign up* (akun hanya dibuat lewat undangan pengurus).

## 2. Buat Ketua RT pertama

1. **Authentication → Users → Add user** → isi email & kata sandi Ketua RT (centang *Auto Confirm*).
2. SQL Editor (ganti `<user_id>` dengan UUID user tersebut):
   ```sql
   -- data warga Ketua RT
   insert into public.households (neighborhood_id, house_number, address)
   values ('00000000-0000-4000-8000-000000000001', 'A-01', 'Jl. Melati No. 1') returning id;
   insert into public.residents (neighborhood_id, household_id, full_name, family_relationship, user_id)
   values ('00000000-0000-4000-8000-000000000001', '<household_id>', 'Nama Ketua RT', 'Kepala Keluarga', '<user_id>') returning id;
   -- keanggotaan & role
   insert into public.user_memberships (neighborhood_id, user_id, role, resident_id)
   values ('00000000-0000-4000-8000-000000000001', '<user_id>', 'ketua_rt', '<resident_id>');
   ```
3. Masuk ke aplikasi sebagai Ketua RT. Data warga, akun pengurus/warga, iuran, dan lainnya dikelola dari aplikasi.

## 3. Edge Function undangan akun

Akun warga/pengurus dibuat dari menu **Pengguna → Buat akun warga**, yang memanggil Edge Function `invite-user` (memakai service role di server — tidak pernah di browser).

```bash
supabase functions deploy invite-user
supabase secrets set SITE_URL=https://wargaku.vercel.app
```

Fungsi membuat akun lalu mengirim email **"Atur kata sandi"** (tautan recovery). Warga membuka tautan → membuat kata sandi di halaman `/atur-sandi`. Tautan bertipe *invite* tidak dipakai karena ditolak server (`otp_expired`) pada project ini.

> **Email:** project ini memakai SMTP Brevo (diatur di dashboard Supabase → Authentication → SMTP Settings, bukan di `config.toml`, agar password tidak tersimpan di repo) dan template Indonesia `supabase/templates/recovery.html`. Pengirim bawaan Supabase hanya mengizinkan beberapa email per jam dan tidak mengizinkan template kustom.

## 4. Jalankan & deploy aplikasi

```bash
cp .env.example .env      # isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY (Project Settings → API)
npm install
npm run dev               # http://localhost:5173
npm run build             # type-check + build produksi + service worker
```

**Vercel:** import repo, framework *Vite*, tambahkan environment variable `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`. Jangan pernah memasukkan `service_role` key ke frontend. File `vercel.json` sudah mengatur rewrite SPA.

Tanpa `.env`, aplikasi menampilkan halaman masuk dengan pemberitahuan bahwa server belum dikonfigurasi.

## Struktur

```
src/
  app/          router, permissions (matriks akses PRD §2.1), navigasi per role
  components/   ui (Button, Badge, Tabs, Sheet…), layouts, charts
  modules/      auth, dashboard, residents, households, letters, dues, announcements,
                complaints, activities, security, reports, users, settings, notifications
  motion/       lapisan animasi GSAP
  services/     loader (memuat data RT dari Supabase), export Excel, PDF surat
  stores/       auth (sesi Supabase), db (data + aksi ke Supabase), ui (tema)
supabase/       migrations, seed.sql, functions/invite-user, config.toml
```

## Aturan penting yang ditegakkan di database

- Upload bukti transfer hanya membuat pembayaran `pending`; trigger menolak nominal yang melebihi sisa tagihan (termasuk pembayaran lain yang masih menunggu). Verifikasi Bendahara/Ketua berjalan atomik: tagihan, satu transaksi kas, audit, dan notifikasi dalam satu transaksi; verifikasi ulang ditolak.
- Koreksi kas lewat transaksi pembalik, bukan hapus. Saldo selalu dihitung dari buku kas; warga hanya melihat ringkasan publik.
- Surat: Sekretaris memeriksa, Ketua RT menyetujui; nomor `001/RT.001/XI/2026` diterbitkan dari counter terkunci dan tidak dipakai ulang.
- NIK & No. KK hanya dapat dibaca Ketua RT/Sekretaris; Bendahara/Pengurus memakai view tanpa kolom tersebut. Bukti transfer di bucket privat dengan signed URL 60 detik.
- Role hanya diubah Ketua RT lewat RPC; akun nonaktif kehilangan akses tanpa menghapus histori.
- PWA hanya meng-cache aset statis; respons Supabase memakai `NetworkOnly`.

Semua aturan di atas sudah diuji terhadap migration (79 skenario RLS/RPC) di Postgres lokal. Tetap uji sekali lagi di project Supabase Anda dengan akun dari tiap role sebelum dipakai warga (PRD §13).

## Ikon PWA

`npm run icons` membuat ulang PNG di `public/icons/` dari `public/favicon.svg`.

## Lisensi

[MIT](LICENSE) © 2026 ariiiwyd
