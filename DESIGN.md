---
name: WargaKu
description: Satu Aplikasi, Semua Urusan Warga. Smart Neighborhood Management System untuk satu RT.
colors:
  primary-blue: "#2563EB"
  primary-blue-hover: "#1D4ED8"
  primary-blue-soft: "#E7EFFF"
  primary-blue-soft-ink: "#1D4ED8"
  hero-blue-deep: "#1E40AF"
  fresh-green: "#10B981"
  fresh-green-ink: "#047857"
  fresh-green-soft: "#E3F8F0"
  warm-orange: "#F59E0B"
  warm-orange-ink: "#B45309"
  warm-orange-soft: "#FEF3DC"
  alert-red: "#E5484D"
  alert-red-ink: "#C2262C"
  alert-red-soft: "#FDECEC"
  violet-ink: "#6D28D9"
  violet-soft: "#F0EAFE"
  modern-navy: "#0F172A"
  navy-raised: "#172238"
  navy-line: "#24324D"
  navy-ink: "#C6D1E3"
  page-mist: "#F8FAFC"
  card-white: "#FFFFFF"
  soft-gray: "#F1F5F9"
  soft-gray-deep: "#E8EEF6"
  ink: "#0F172A"
  ink-secondary: "#334155"
  muted-slate: "#5B6B82"
  hairline: "#E2E8F0"
  hairline-strong: "#CBD5E1"
  dark-page: "#0F172A"
  dark-card: "#1E293B"
  dark-primary: "#3B82F6"
  dark-text: "#F8FAFC"
  dark-hairline: "#334155"
typography:
  display:
    fontFamily: "Plus Jakarta Sans, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "52px"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Plus Jakarta Sans, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Plus Jakarta Sans, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.35
  body:
    fontFamily: "Plus Jakarta Sans, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14.5px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Plus Jakarta Sans, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 600
    lineHeight: 1.4
  figure:
    fontFamily: "Plus Jakarta Sans, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 800
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
rounded:
  sm: "10px"
  md: "12px"
  lg: "16px"
  card: "18px"
  sheet: "20px"
  hero: "24px"
  full: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "24px"
  page-mobile: "16px"
  page-tablet: "24px"
  page-desktop: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary-blue}"
    textColor: "{colors.card-white}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.primary-blue-hover}"
  button-secondary:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "44px"
  button-soft:
    backgroundColor: "{colors.primary-blue-soft}"
    textColor: "{colors.primary-blue-soft-ink}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "36px"
  button-success:
    backgroundColor: "{colors.fresh-green}"
    textColor: "{colors.card-white}"
    rounded: "{rounded.md}"
    height: "44px"
  card:
    backgroundColor: "{colors.card-white}"
    rounded: "{rounded.card}"
    padding: "20px"
  input:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "44px"
  badge-status:
    rounded: "{rounded.full}"
    typography: "{typography.label}"
    padding: "0 10px"
    height: "24px"
  sidebar:
    backgroundColor: "{colors.modern-navy}"
    textColor: "{colors.navy-ink}"
    width: "264px"
  sidebar-item-active:
    backgroundColor: "{colors.primary-blue}"
    textColor: "{colors.card-white}"
    rounded: "{rounded.md}"
    height: "44px"
  hero-banner:
    backgroundColor: "{colors.primary-blue-hover}"
    textColor: "{colors.card-white}"
    rounded: "{rounded.hero}"
  bottom-nav:
    backgroundColor: "{colors.card-white}"
    rounded: "22px"
    height: "66px"
---

# Design System: WargaKu

## Overview

**Creative North Star: "Balai Warga Digital"**

WargaKu adalah balai warga yang dipindahkan ke layar: tempat resmi tapi ramah, tempat pengurus bekerja dengan tertib dan warga datang tanpa canggung. Seluruh sistem berpijak pada biru modern dan putih bersih dari brand sheet, dengan navy sebagai "papan pengumuman" yang tegas (sidebar, kartu saldo, kartu ronda) dan hijau segar sebagai tanda urusan beres. Kepadatannya sedang: pengurus melihat antrean dan tabel di laptop, warga mengetuk ubin layanan besar di ponsel.

Suasana dibangun dari dua materi khas: **ubin ikon rumah** (logo atap + keluarga + daun hijau di ubin biru membulat) dan **ilustrasi deretan rumah komplek** berlapis putih di atas biru pada banner sapaan. Selain dua itu, antarmuka sengaja tenang: kartu putih bergaris tipis, badge status yang konsisten, angka besar yang jelas. Ekspresi merek ada di detail yang presisi, bukan dekorasi.

Gerak mengikuti satu tata bahasa GSAP (`power3`, 0,3–1,3 dtk): judul meluncur per huruf, kartu muncul bertahap, angka berjalan, pill tab meluncur. Setiap gerak bermakna (pindah halaman, data berubah, fokus) dan semuanya hilang saat "kurangi animasi" aktif.

**Key Characteristics:**
- Biru modern + putih, navy untuk permukaan berwibawa, hijau = beres, oranye = perlu perhatian, merah = ditolak/darurat.
- Satu keluarga huruf: Plus Jakarta Sans, judul ExtraBold dengan tracking rapat, angka tabular.
- Kartu putih 18px bergaris hairline; banner sapaan biru 24px dengan ilustrasi rumah.
- Bahasa Indonesia sederhana di semua label, tombol menyebut aksinya.
- Desktop: sidebar navy yang bisa diperkecil. Ponsel: tab bar melayang di bawah + menu "Lainnya".

## Colors

Palet terkendali: netral sejuk ditambah satu biru yang memimpin, dengan warna status yang hanya muncul untuk makna.

### Primary
- **Biru Modern** (primary-blue): tombol utama, item navigasi aktif, tautan, angka count-up penting, cincin fokus. Di mode gelap menjadi dark-primary.
- **Biru Tua Banner** (primary-blue-hover / hero-blue-deep): hover tombol utama dan gradasi banner sapaan serta panel brand halaman masuk.
- **Biru Embun** (primary-blue-soft): latar ubin ikon, chip terpilih, baris terpilih, tombol soft.

### Secondary
- **Hijau Segar** (fresh-green): status berhasil, lunas, terverifikasi, meter iuran terkumpul, daun pada logo dan pohon pada ilustrasi.

### Tertiary
- **Oranye Hangat** (warm-orange): peringatan, menunggu verifikasi, badge antrean di sidebar, batang pengeluaran di grafik kas.
- **Merah Waspada** (alert-red): ditolak, belum bayar, pengaduan darurat, aksi destruktif.
- **Ungu Tanda Tangan** (violet-ink / violet-soft): khusus status "Menunggu TTD Ketua" pada surat.

### Neutral
- **Navy Modern** (modern-navy): sidebar desktop, kartu saldo kas, kartu ronda malam ini, kotak rekening. Teks di atasnya memakai navy-ink.
- **Kabut Halaman** (page-mist): latar halaman mode terang.
- **Putih Kartu** (card-white): semua kartu, sheet, modal.
- **Abu Lembut** (soft-gray / soft-gray-deep): panel sekunder, rel tab, latar meter, sel kalender.
- **Tinta** (ink) / **Tinta Sekunder** (ink-secondary) / **Slate Redup** (muted-slate): teks utama, isi, keterangan.
- **Garis Rambut** (hairline / hairline-strong): batas kartu, pemisah daftar, garis input.
- **Mode gelap**: dark-page, dark-card, dark-text, dark-hairline (PRD §10.4). Semua warna dipetakan ulang lewat variabel CSS di `.dark`; komponen tidak pernah memakai hex langsung.

### Named Rules
**The Status Means Something Rule.** Hijau, oranye, merah, dan ungu hanya untuk status. Jangan dipakai sebagai hiasan atau variasi warna kartu.

**The One Blue Rule.** Hanya ada satu biru aksi. Tombol utama per area cukup satu; aksi lain memakai secondary, soft, atau ghost.

**The Token-Only Rule.** Warna selalu lewat token (`bg-primary`, `text-muted`, `var(--primary)`), tidak pernah hex di komponen, supaya mode gelap ikut otomatis. Pengecualian: banner/panel brand biru dan ilustrasi yang memang tetap biru di kedua tema.

## Typography

**Display Font:** Plus Jakarta Sans (dengan Inter, system-ui)
**Body Font:** Plus Jakarta Sans
**Label Font:** Plus Jakarta Sans (tanpa monospace kecuali NIK/nomor dokumen)

**Character:** Satu keluarga geometris yang hangat: ExtraBold rapat untuk judul terasa percaya diri, Regular untuk isi terasa ramah dan mudah dibaca warga lanjut usia.

### Hierarchy
- **Display** (800, 52px, 1.02, tracking -0.035em): hanya slogan di panel brand halaman masuk.
- **Headline** (800, 26px ponsel / 30px desktop, tracking -0.015em): judul halaman via `SplitTitle`; banner sapaan 25/32px.
- **Title** (700, 15–16px): judul kartu, nama warga di daftar, judul pengumuman.
- **Body** (400, 14–14.5px, 1.6): isi, deskripsi; isi pengumuman panjang 15px dengan line-height 1.75 dan maks 65ch.
- **Label** (600, 12.5–13.5px): label field, tab, badge (11.5px), keterangan kecil 12px.
- **Figure** (800, 22–34px, tabular): saldo, tagihan, statistik. `font-variant-numeric: tabular-nums` di body agar count-up tidak goyang.

### Named Rules
**The Plain Bahasa Rule.** Semua teks antarmuka berbahasa Indonesia sederhana. Tombol menyebut aksinya ("Verifikasi pembayaran", "Ajukan surat"), pesan galat menyebut masalah dan jalan keluarnya.

**The No Eyebrow Rule.** Tidak ada label kecil di atas judul. Judul berdiri sendiri; konteks ditulis sebagai deskripsi di bawahnya.

## Layout

- **Kerangka aplikasi:** sidebar navy tetap 264px (diperkecil 88px) mulai `lg` (1024px); top bar lengket 76px (64px ponsel) berlatar halaman 85% + blur. Konten maks 1440px dengan gutter 16 / 24 / 32px.
- **Ponsel (< 1024px):** sidebar hilang, tab bar melayang di bawah (5 kolom: 4 menu utama per peran + "Lainnya" yang membuka sheet grid menu). Konten diberi ruang bawah `108px + safe-area`.
- **Ritme:** jarak antar blok 20px (`gap-5`), antar kartu statistik 12–16px, padding kartu 20px, kepala halaman ke konten 24px.
- **Grid umum:** dashboard 2 kolom asimetris (1.35fr / 1fr) di `xl`; daftar kartu 1→2→3→4 kolom; halaman warga (beranda, tagihan) dibatasi 1100px; profil/pengaturan 980px; notifikasi 820px.
- **Tabel:** tabel penuh di `md` ke atas, berubah menjadi daftar baris kartu di ponsel. Selalu ada pencarian, filter, dan pagination.
- **Detail & form panjang** dibuka di Sheet kanan (440px, lebar 560px); konfirmasi dan form pendek di Modal (520px, lebar 760px).

## Elevation & Depth

Sistem hampir datar: kedalaman datang dari garis rambut dan pelapisan tonal (halaman → kartu putih → panel abu), dengan bayangan lembut berlapis hanya untuk mengangkat.

### Shadow Vocabulary
- **Diam** (`--shadow-sm: 0 1px 2px rgb(15 23 42 / .05), 0 1px 1px rgb(15 23 42 / .03)`): semua kartu saat diam.
- **Terangkat** (`--shadow-md: 0 8px 24px -12px rgb(15 23 42 / .18), 0 2px 6px -2px rgb(15 23 42 / .06)`): hover `card-lift` (naik 3px) pada kartu yang bisa diklik, hanya perangkat bermouse.
- **Melayang** (`--shadow-lg: 0 24px 60px -24px rgb(15 23 42 / .35), 0 6px 16px -8px rgb(15 23 42 / .12)`): modal, sheet, popover, toast, tab bar ponsel.
- **Cahaya biru** (`0 6px 16px -8px var(--primary)`): tombol utama dan pill sidebar aktif; banner sapaan memakai versi besar.

### Named Rules
**The Flat-At-Rest Rule.** Kartu diam hanya punya garis rambut + shadow-sm. Bayangan lebih besar hanya sebagai respons (hover, lapisan di atas konten).

## Shapes

Sudut membulat yang ramah, konsisten bertingkat: kecil untuk kontrol, sedang untuk kartu, besar untuk permukaan pahlawan.

- Tombol kecil 10px, tombol & input 12px, ubin ikon 12px (kecil) / 16px (besar), kartu 18px, modal & sheet 20px, tab bar ponsel 22px, banner sapaan 24px, badge & avatar bulat penuh.
- Ubin ikon: persegi membulat berisi ikon Lucide (stroke 2–2.2) di latar soft sesuai makna.
- Garis selalu 1px hairline; tidak ada garis tepi berwarna tebal di sisi kartu.
- Empty state memakai ubin ikon dengan "bayangan" ubin biru embun yang diputar 6°.

## Components

### Buttons
- **Shape:** sudut membulat 12px (10px untuk ukuran kecil); tinggi 36 / 44 / 48px.
- **Primary:** latar Biru Modern, teks putih, ikon 18px di kiri, cahaya biru di bawah; hover Biru Tua; tekan mengecil 0,98.
- **Secondary:** putih bergaris hairline; hover garis lebih tegas + latar abu lembut.
- **Soft:** Biru Embun dengan teks biru tua, untuk aksi sekunder di dalam baris (Bayar, Catat tunai).
- **Success / Danger:** hijau untuk menyetujui/verifikasi, merah untuk menolak/destruktif; selalu didahului dialog konfirmasi.
- **Ghost:** teks saja untuk aksi tersier (Detail, Tutup).
- **Magnetic:** tombol utama di kepala halaman sedikit mengikuti kursor (hanya mouse).

### Chips / Badges
- **Style:** pil 24px, label 11.5px semibold, latar soft + teks ink sesuai status, titik bulat opsional di kiri.
- **Peta status tetap** (`components/ui/status.tsx`): Diajukan/Baru = biru, Menunggu TTD = ungu, Perlu perbaikan/Menunggu verifikasi/Sebagian = oranye, Disetujui/Lunas/Terverifikasi/Selesai = hijau, Ditolak/Belum bayar/Darurat = merah, Arsip/Dibatalkan = abu. Kehadiran kegiatan: Hadir = hijau, **Hadir online = biru**, Tidak hadir = merah, Terdaftar/Izin = abu. Lencana mode rapat **Online/Hybrid** memakai biru dengan ikon kamera (`Video`).

### Cards / Containers
- **Corner Style:** 18px.
- **Background:** Putih Kartu (Dark Card di mode gelap).
- **Shadow Strategy:** Flat-At-Rest (lihat Elevation).
- **Border:** 1px hairline.
- **Internal Padding:** 20px; kepala kartu berisi ubin ikon 32px + judul 15px + aksi teks biru di kanan.
- **Varian navy:** kartu saldo kas, ronda malam ini, kotak rekening — latar navy, teks putih/navy-ink.

### Inputs / Fields
- **Style:** tinggi 44px, sudut 12px, garis hairline, latar putih, label 13px semibold di atas, petunjuk 12px di bawah.
- **Focus:** garis berubah biru + cincin biru 15% selebar 4px.
- **Error / Disabled:** garis merah + pesan merah di bawah field; disabled berlatar abu lembut. Galat form ditampilkan juga sebagai kotak merah lembut di akhir form.
- **Pilihan:** segmented `Choice` (kotak 44px, terpilih = garis biru + Biru Embun) untuk 2–4 opsi; `Select` dengan chevron kustom untuk daftar.

### Navigation
- **Sidebar desktop:** navy, logo + wordmark (Warga putih, Ku biru muda) + slogan; item 44px, ikon 19px, label 14px semibold; aktif = pill biru meluncur (`useSlidingPill`); badge antrean oranye; kartu pengguna & tombol "Perkecil menu" di bawah.
- **Top bar:** chip lokasi RT/RW, menu tema, lonceng dengan popover (bergoyang saat dibuka), menu akun.
- **Tab bar ponsel:** kartu melayang membulat 22px, 5 item 54px dengan ikon 21px + label 11px, pill Biru Embun meluncur.
- **Tabs halaman:** rel abu bergaris, pill putih meluncur, penghitung bulat (biru saat aktif); bisa digulir horizontal di ponsel.

### Banner Sapaan (signature)
Gradasi biru (radial #3B82F6 → #2563EB → #1E40AF) membulat 24px, ilustrasi `NeighborhoodScene` di kanan bawah (rumah putih bertingkat dengan jendela menyala kuning dan pohon hijau), salam "Selamat pagi/siang, Pak/Bu …", baris konteks, dan chip kaca untuk antrean tugas atau info RT.

### Ubin Layanan Warga (signature)
Grid 3 kolom ubin putih berisi ubin ikon Biru Embun 48px + label 12.5px; meniru layar beranda ponsel di brand sheet.

### Kartu Rapat Berlangsung (signature)
Pita biru (`primary`, membulat 20px, cahaya biru seperti banner kegiatan warga) yang muncul di atas beranda warga dan dashboard pengurus selama jendela gabung rapat online (15 menit sebelum mulai s.d. 30 menit setelah selesai, atau status berlangsung). Isi: ubin ikon `Radio` putih-transparan, titik hijau berdenyut (dimatikan saat "kurangi animasi"), label "Rapat sedang berlangsung", judul rapat, nama layanan (Google Meet/Zoom), dan tombol putih **Gabung sekarang** bertinta biru. Komponen: `components/meeting/LiveMeetingCard.tsx`.

### Rapat online di detail kegiatan
Kotak bergaris di atas deskripsi: abu saat belum dibuka (teks "Tombol gabung aktif 15 menit sebelum rapat"), berubah ke biru embun + ubin ikon biru saat bisa bergabung. Tombol utama "Gabung lewat Google Meet/Zoom" membuka tautan di tab baru langsung saat diklik, lalu mencatat "Hadir online". Notulen tampil sebagai panel abu muda (maks 65ch, `whitespace-pre-line`) dengan tombol biru "Tonton rekaman"; pengurus menulisnya lewat form + `ConfirmDialog` "Bagikan notulen ke warga?".

### Verifikasi 2 langkah & sesi
Layar kode dan pemasangan authenticator memakai `AuthShell` halaman masuk: ubin ikon `ShieldCheck` biru embun, judul `SplitTitle`, kolom kode 6 digit rata tengah bermonospace dengan jarak huruf lebar, galat lewat `Notice` merah. Kode QR selalu di atas kotak putih (`bg-white`, membulat 12px) agar tetap terbaca di tema gelap; kunci manual berupa monospace per 4 karakter dengan tombol Salin. Peringatan keluar otomatis memakai `Modal` + `DialogShell` ikon `Clock` dengan hitung mundur angka tabular dan tombol utama **Tetap masuk**. Komponen: `components/session/` (`TotpEnroll`, `TwoStepCard`, `IdleGuard`), `modules/auth/MfaPages.tsx`.

### Sheet & Modal
Sheet masuk dari kanan (0,55 dtk) dengan isi `data-sheet-item` bertahap; Modal `<dialog>` naik 14px (0,35 dtk) dengan field `data-field` bertahap. Kerangka: kepala (ubin ikon + judul + sub + tombol tutup), isi bergulir, kaki abu tipis berisi tombol.

## Do's and Don'ts

### Do:
- **Do** pakai token warna dan komponen yang sudah ada (`Button`, `Card`, `Badge`, `Tabs`, `Field`, `Sheet`, `Modal`, `ConfirmDialog`, `StatusBadge`) sebelum membuat yang baru.
- **Do** beri setiap halaman `usePageEnter` + `PageHeader` (SplitTitle) dan tandai elemen dengan `data-card` / `data-row` / `data-fade`.
- **Do** tampilkan nominal sebagai `rupiah()` dengan angka tabular, tanggal dalam Asia/Jakarta (`dateShort`, `dateTime` … WIB).
- **Do** samarkan NIK dan No. KK dengan `maskId()` secara bawaan; tombol "Tampilkan" hanya untuk Ketua RT/Sekretaris.
- **Do** minta konfirmasi (`ConfirmDialog`) untuk setiap persetujuan, penolakan, verifikasi, pembatalan, dan koreksi; alasan wajib saat menolak.
- **Do** sediakan state loading, kosong (`EmptyState` dengan kalimat yang menjelaskan), galat, dan sukses (toast) di setiap alur.
- **Do** uji di 390px (ponsel) dan 1440px (desktop), terang dan gelap.

### Don't:
- **Don't** menulis hex langsung di komponen atau memakai warna status sebagai hiasan.
- **Don't** menambah label kecil (eyebrow) di atas judul, teks bergradasi, atau garis tepi berwarna tebal di sisi kartu.
- **Don't** memakai emoji atau karakter unicode sebagai ikon; gunakan Lucide dengan stroke konsisten.
- **Don't** menumpuk kartu di dalam kartu.
- **Don't** menambah kurva animasi baru di luar `EASE` (`src/motion/gsap.ts`) atau menganimasikan selain transform/opacity (kecuali lebar pill).
- **Don't** mengganti font, palet, atau logo tanpa persetujuan pemilik produk; perubahan sistem dicatat di file ini.
