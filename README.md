# WargaKu

**Satu Aplikasi, Semua Urusan Warga.** — Smart Neighborhood Management System untuk satu RT.

Pusat pelayanan digital warga: data warga & keluarga, surat & layanan, kas & iuran, pengumuman, pengaduan, kegiatan, keamanan, dan laporan. Web responsif + PWA, tema Terang/Gelap/Sistem. Spesifikasi lengkap: [`WargaKu_PRD_Technical_Specification.md`](WargaKu_PRD_Technical_Specification.md).

## Menjalankan

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # type-check + build produksi + service worker
```

Tanpa `.env`, aplikasi berjalan dalam **mode demo**: data contoh (fiktif) dibuat dan disimpan di `localStorage` browser. Di halaman masuk, pilih salah satu akun demo:

| Akun | Peran | Email demo |
|---|---|---|
| Budi Santoso | Ketua RT | `budi@contoh.wargaku.id` |
| Siti Rahmawati | Sekretaris | `siti@contoh.wargaku.id` |
| Andi Wijaya | Bendahara | `andi@contoh.wargaku.id` |
| Dedi Kurniawan | Pengurus | `dedi@contoh.wargaku.id` |
| Ani Lestari | Warga | `ani@contoh.wargaku.id` |

Kata sandi demo: `demo1234`. Data demo bisa dikembalikan di **Pengaturan → Aplikasi**.

## Supabase

1. Buat project Supabase, salin `.env.example` → `.env`, isi `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` (jangan pernah `service_role`).
2. Jalankan migration berurutan di `supabase/migrations/`:
   - `…0100_core.sql` — enum, seluruh tabel, composite FK lintas RT, unique & indeks
   - `…0200_rls.sql` — helper `has_rt_role`, RLS per tabel per operasi, view tanpa NIK/KK
   - `…0300_rpc.sql` — `verify_dues_payment`, `reject_dues_payment`, `create_invoice`, `approve_letter_request` (nomor surat atomik), `record_cash_expense`, `reverse_cash_transaction`, `publish_announcement`, `assign_member_role`, audit trigger
   - `…0400_storage.sql` — bucket privat & policy Storage
3. `supabase/seed.sql` untuk data master (jenis surat, iuran, kategori kas).
4. Buat akun Ketua RT pertama lewat Supabase Auth, lalu dari SQL editor: `select public.assign_member_role('<neighborhood_id>', '<user_id>', 'ketua_rt');`

> **Status integrasi:** tampilan saat ini membaca/menulis store demo (`src/stores/db.store.ts`) yang meniru aturan RLS/RPC yang sama. Pemanggilan Supabase yang siap pakai ada di `src/services/supabase.service.ts`; langkah berikutnya adalah mengganti `actions.*` di tiap halaman dengan service tersebut (+ React Query). Uji RLS dengan akun dari setiap role sebelum produksi (PRD §13).

## Struktur

```
src/
  app/          router, permissions (matriks akses PRD §2.1), navigasi per role
  components/   ui (Button, Badge, Tabs, Sheet…), layouts, charts
  modules/      dashboard, residents, households, letters, dues, announcements,
                complaints, activities, security, reports, users, settings, notifications
  motion/       lapisan animasi GSAP (transisi halaman, count-up, pill, Flip, modal, drawer)
  services/     export Excel, PDF surat, wrapper RPC Supabase
  stores/       auth, ui (tema), db (mode demo)
supabase/       migrations, seed.sql, config.toml
```

## Aturan penting yang ditegakkan

- Upload bukti transfer hanya membuat pembayaran `pending`; saldo & tagihan berubah saat Bendahara/Ketua memverifikasi — atomik, satu pembayaran satu transaksi kas, tidak boleh melebihi sisa tagihan.
- Koreksi kas lewat transaksi pembalik, bukan hapus. Saldo selalu dihitung dari buku kas.
- Surat: Sekretaris memeriksa, Ketua RT menyetujui; nomor `001/RT.001/XI/2026` diterbitkan dari counter dan tidak dipakai ulang.
- NIK & nomor KK disamarkan secara bawaan, hanya Ketua RT/Sekretaris yang dapat membukanya, tidak masuk notifikasi atau nama file.
- PWA hanya meng-cache aset statis; respons Supabase memakai `NetworkOnly`.

## Ikon PWA

`npm run icons` membuat ulang PNG di `public/icons/` dari `public/favicon.svg`.

## Lisensi

[MIT](LICENSE) © 2026 ariiiwyd
