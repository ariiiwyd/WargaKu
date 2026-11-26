# WargaKu — panduan kerja

Aplikasi RT berbasis React + Vite + TypeScript + Tailwind v4 + Supabase (mode demo saat `.env` kosong).

## Acuan wajib sebelum mengubah apa pun

1. **`DESIGN.md`** — sistem visual yang normatif (token warna, tipografi, radius, komponen, Do's & Don'ts). Setiap perbaikan atau fitur baru **harus mengikuti DESIGN.md**: pakai token & komponen yang ada, jangan menambah warna/font/kurva animasi baru, jangan mengubah tampilan yang sudah disepakati. Bila perubahan sistem memang perlu, minta persetujuan dulu lalu perbarui `DESIGN.md` dan `.impeccable/design.json` dalam perubahan yang sama.
2. **`PRODUCT.md`** — pengguna, peran, batasan produk.
3. **`WargaKu_PRD_Technical_Specification.md`** — aturan bisnis (alur surat, pembayaran atomik, RLS, privasi NIK/KK).

## Konvensi kode

- Token warna lewat kelas Tailwind dari `src/styles/globals.css` (`bg-primary`, `text-muted`, `border-line`…), bukan hex.
- Komponen dasar ada di `src/components/ui/` (`Button`, `Card`, `Badge`, `Tabs`, `Field`, `ConfirmDialog`, `StatusBadge`); `Sheet`, `Modal`, `useToast` di `src/motion/`.
- Tiap halaman: `usePageEnter(ref)` + `PageHeader`, elemen ditandai `data-card` / `data-row` / `data-fade`.
- Hak akses lewat `can(role, action)` di `src/app/permissions.ts`; aksi data di `src/stores/db.store.ts` (demo) meniru RPC di `supabase/migrations/`.
- Teks antarmuka dalam Bahasa Indonesia sederhana.

## Verifikasi

`npm run typecheck`, `npm run build`, lalu cek di 390px dan 1440px, terang & gelap.
