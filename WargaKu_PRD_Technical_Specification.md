# WargaKu --- Product Requirements Document & Technical Specification

**Product:** WargaKu\
**Tagline:** Satu Aplikasi, Semua Urusan Warga.\
**Category:** Smart Neighborhood Management System\
**Status:** Final baseline --- ready for development planning\
**Target deployment:** One RT\
**Document version:** 1.0\
**Date:** 26 November 2026

------------------------------------------------------------------------

## 1. Ringkasan Produk

WargaKu adalah aplikasi pengelolaan lingkungan RT yang mengintegrasikan
administrasi warga, layanan surat, kas dan iuran, pengumuman, pengaduan,
kegiatan, keamanan lingkungan, serta laporan dalam satu platform.

Aplikasi tersedia sebagai web responsif dan Progressive Web App (PWA),
sehingga dapat digunakan melalui komputer maupun ponsel dan dipasang ke
layar utama perangkat.

### 1.1 Keputusan produk

  Area              Keputusan
  ----------------- ---------------------------------------------
  Target            Satu RT
  Bahasa            Indonesia
  Platform          Web Responsive + PWA
  Tema              Light + Dark + System
  Frontend          React + Vite + TypeScript
  UI styling        Tailwind CSS
  Backend / BaaS    Supabase
  Database          PostgreSQL
  Authentication    Supabase Auth
  File storage      Supabase Storage
  Hosting           Vercel
  Pembayaran        Pencatatan manual dan upload bukti transfer
  Payment gateway   Tidak digunakan pada tahap awal
  Zona waktu        Asia/Jakarta
  Mata uang         IDR / Rupiah

### 1.2 Visi produk

Menjadikan administrasi dan pelayanan RT lebih tertata, transparan,
mudah diakses, dan terdokumentasi tanpa menghilangkan proses persetujuan
oleh pengurus.

### 1.3 Tujuan

1.  Memusatkan data warga dan keluarga.
2.  Mempermudah pengajuan dan penerbitan surat.
3.  Mencatat tagihan, pembayaran, pemasukan, dan pengeluaran kas.
4.  Menyampaikan informasi resmi kepada warga.
5.  Mencatat dan menindaklanjuti pengaduan.
6.  Mengelola kegiatan serta keamanan lingkungan.
7.  Menyediakan laporan yang dapat diunduh.
8.  Menyimpan jejak aktivitas penting untuk audit.

------------------------------------------------------------------------

## 2. Pengguna dan Hak Akses

WargaKu menggunakan lima role utama.

  -----------------------------------------------------------------------
  Role                                Deskripsi
  ----------------------------------- -----------------------------------
  `ketua_rt`                          Administrator lingkungan dan
                                      pengambil keputusan

  `sekretaris`                        Mengelola data warga, administrasi,
                                      dan surat

  `bendahara`                         Mengelola tagihan, pembayaran, kas,
                                      dan laporan keuangan

  `pengurus`                          Mengelola kegiatan, keamanan, serta
                                      tindak lanjut pengaduan sesuai
                                      penugasan

  `warga`                             Mengakses layanan dan informasi
                                      serta data milik sendiri/keluarga
  -----------------------------------------------------------------------

### 2.1 Matriks akses modul

Keterangan: **Penuh** = seluruh tindakan; **Kelola** = membuat/mengubah
sesuai lingkup; **Terbatas** = data tertentu; **Lihat** = baca saja;
**Pribadi** = data sendiri/keluarga; **---** = tidak ada akses.

  ---------------------------------------------------------------------------------
  Modul           Ketua RT    Sekretaris    Bendahara   Pengurus     Warga
  --------------- ----------- ------------- ----------- ------------ --------------
  Dashboard       Penuh       Lihat         Lihat       Lihat        Pribadi

  Data warga      Penuh       Kelola        Terbatas    Terbatas     Pribadi

  Data keluarga   Penuh       Kelola        Terbatas    ---          Keluarga
                                                                     sendiri

  Surat           Penuh       Kelola        ---         ---          Ajukan/lihat
                                                                     sendiri

  Persetujuan     Final       Pemeriksaan   ---         ---          ---
  surat                                                              

  Iuran/tagihan   Penuh       Lihat         Kelola      ---          Tagihan
                                                                     keluarga

  Verifikasi      Penuh       ---           Kelola      ---          ---
  pembayaran                                                         

  Buku kas        Penuh       Lihat         Kelola      ---          Ringkasan
                                                                     publik

  Pengumuman      Penuh       Kelola        ---         Kelola jika  Lihat
                                                        ditugaskan   

  Pengaduan       Penuh       Lihat         ---         Kelola jika  Buat/lihat
                                                        ditugaskan   sendiri

  Kegiatan        Penuh       Kelola        ---         Kelola       Ikut serta

  Keamanan        Penuh       Lihat         ---         Kelola       Laporan
                                                                     terbatas

  Laporan         Penuh       Terbatas      Keuangan    Terbatas     Ringkasan
                                                                     publik

  Pengaturan      Penuh       Terbatas      ---         ---          Profil sendiri

  Audit log       Penuh       ---           Keuangan    ---          ---
                                            terkait                  
  ---------------------------------------------------------------------------------

Ketua RT menjadi pemegang persetujuan final surat dan administrator
role. Sekretaris dapat memeriksa kelengkapan serta menyiapkan surat,
tetapi tidak menggantikan persetujuan final Ketua RT.

### 2.2 Prinsip otorisasi

-   Hak akses harus ditegakkan di database menggunakan Row Level
    Security (RLS), bukan hanya dengan menyembunyikan menu frontend.
-   Setiap data operasional harus memiliki `neighborhood_id`.
-   Warga hanya dapat membaca data pribadi dan data keluarga yang memang
    menjadi tanggung jawab akunnya.
-   Bendahara tidak otomatis memiliki akses ke seluruh dokumen identitas
    warga.
-   NIK dan nomor KK merupakan data pribadi terbatas.
-   Perubahan role hanya dapat dilakukan oleh Ketua RT yang berwenang.
-   Pengguna non-admin tidak dapat mengubah atau menghapus audit log.
-   Akun yang dinonaktifkan tidak menghapus histori transaksi.

------------------------------------------------------------------------

## 3. Ruang Lingkup Modul

### 3.1 Dashboard dan sistem

-   Dashboard berbeda berdasarkan role.
-   Profil pengguna.
-   Pengaturan identitas RT.
-   Manajemen akun dan role.
-   Notifikasi dalam aplikasi.
-   Riwayat aktivitas.
-   Pilihan Light, Dark, dan System.
-   PWA dan instalasi ke layar utama.

### 3.2 Data warga dan keluarga

-   Data kepala keluarga.
-   Data anggota keluarga.
-   Nomor rumah dan alamat.
-   Status domisili.
-   Status aktif/nonaktif.
-   Kontak warga.
-   Foto profil.
-   Riwayat perubahan data.
-   Pencarian dan filter.
-   Import/export Excel dengan pembatasan hak akses.

### 3.3 Surat dan pelayanan digital

-   Master jenis surat.
-   Pengajuan surat oleh warga.
-   Pemeriksaan kelengkapan oleh Sekretaris.
-   Persetujuan final Ketua RT.
-   Nomor surat otomatis.
-   Template surat.
-   Lampiran dokumen.
-   Cetak/unduh PDF.
-   Arsip surat dan riwayat status.

Jenis surat awal: surat pengantar, keterangan domisili, keterangan
usaha, keterangan tidak mampu, dan jenis surat lain yang disetujui RT.

### 3.4 Kas dan iuran RT

-   Master jenis iuran.
-   Iuran bulanan, insidental, atau sekali bayar.
-   Tagihan per rumah/keluarga.
-   Pembayaran manual.
-   Upload bukti transfer.
-   Verifikasi oleh Bendahara.
-   Penolakan dengan alasan.
-   Pembayaran sebagian/cicilan.
-   Pemasukan dan pengeluaran kas.
-   Saldo kas berdasarkan buku transaksi.
-   Riwayat transaksi dan laporan.

**Aturan pembayaran:** upload bukti transfer hanya membuat pembayaran
berstatus `pending`. Saldo kas dan jumlah terbayar tidak berubah sampai
Bendahara atau Ketua RT yang berwenang memverifikasi. Pembayaran yang
ditolak tidak menambah saldo. Verifikasi harus atomik dan tidak boleh
tercatat ganda.

### 3.5 Pengumuman dan informasi

-   Pengumuman RT.
-   Kategori informasi.
-   Lampiran gambar/dokumen.
-   Draft dan publikasi.
-   Notifikasi warga.
-   Riwayat pembacaan pengumuman.

### 3.6 Pengaduan warga

-   Form laporan.
-   Kategori dan prioritas.
-   Lampiran foto.
-   Penugasan pengurus.
-   Status tindak lanjut.
-   Tanggapan.
-   Riwayat penyelesaian.
-   Warga dapat memantau pengaduan miliknya.

### 3.7 Kegiatan lingkungan

-   Kalender kegiatan.
-   Kerja bakti, rapat, kegiatan sosial, dan agenda lain.
-   Lokasi dan waktu.
-   Daftar peserta.
-   Kehadiran.
-   Dokumentasi kegiatan.

### 3.8 Keamanan lingkungan

-   Regu ronda.
-   Anggota regu.
-   Jadwal ronda.
-   Laporan pelaksanaan.
-   Catatan kejadian.
-   Buku tamu.
-   Rekap laporan keamanan.

### 3.9 Laporan dan analitik

-   Statistik warga dan keluarga.
-   Rekap surat.
-   Rekap tagihan dan pembayaran.
-   Pemasukan dan pengeluaran.
-   Saldo kas.
-   Rekap pengaduan.
-   Rekap kegiatan.
-   Rekap keamanan.
-   Export PDF dan Excel berdasarkan hak akses.

------------------------------------------------------------------------

## 4. Alur Bisnis Utama

### 4.1 Alur surat

1.  Warga memilih jenis surat dan mengisi formulir.
2.  Sistem membuat permohonan berstatus `submitted`.
3.  Sekretaris memeriksa kelengkapan dan dapat mengembalikan untuk
    perbaikan.
4.  Ketua RT menyetujui atau menolak.
5.  Setelah disetujui, sistem membuat nomor surat secara atomik.
6.  Dokumen PDF dibuat dan disimpan.
7.  Warga menerima notifikasi dan dapat mengunduh surat.

### 4.2 Alur pembayaran iuran

1.  Bendahara membuat tagihan berdasarkan keluarga dan periode.
2.  Warga melihat tagihan keluarga.
3.  Warga membayar melalui transfer di luar aplikasi atau menyerahkan
    pembayaran tunai sesuai prosedur RT.
4.  Warga/pengurus menginput pembayaran dan mengunggah bukti jika
    tersedia.
5.  Pembayaran masuk status `pending`.
6.  Bendahara memeriksa bukti, nominal, tagihan, dan tanggal.
7.  Bendahara menyetujui atau menolak dengan alasan.
8.  Jika disetujui, sistem memperbarui jumlah terbayar dan status
    tagihan serta membuat satu transaksi pemasukan kas.
9.  Sistem mengirim bukti/konfirmasi kepada warga.

Semua langkah verifikasi harus berada dalam satu transaksi database.
Gunakan row locking (`FOR UPDATE`) pada tagihan dan unique constraint
pada referensi pembayaran untuk mencegah race condition dan duplikasi.

### 4.3 Alur pengeluaran kas

1.  Bendahara menginput pengeluaran.
2.  Mengisi kategori, tanggal, nominal, keterangan, dan bukti.
3.  Pengeluaran mengikuti kebijakan persetujuan RT.
4.  Setelah dicatat/disetujui, transaksi menjadi bagian buku kas.
5.  Koreksi dilakukan melalui transaksi pembalik atau penyesuaian, bukan
    menghapus transaksi lama.

### 4.4 Alur pengaduan

Warga mengirim laporan → pengurus menerima/ditugaskan → diproses →
diberi tanggapan → diselesaikan → warga melihat hasil dan riwayatnya.

### 4.5 Alur pengumuman

Pengurus berwenang membuat draft → petugas berwenang memublikasikan →
warga menerima notifikasi → status pembacaan dapat direkam.

------------------------------------------------------------------------

## 5. Persyaratan Nonfungsional

-   Web responsif untuk desktop, tablet, dan ponsel.
-   PWA dapat diinstal melalui browser.
-   HTTPS wajib untuk deployment.
-   Autentikasi menggunakan Supabase Auth.
-   Password tidak disimpan dalam tabel profil.
-   Data sensitif dibatasi dengan RLS.
-   Bucket dokumen privat menggunakan signed URL berumur pendek.
-   Audit trail untuk aktivitas penting.
-   Backup database terjadwal dan prosedur pemulihan diuji.
-   Zona waktu tampilan `Asia/Jakarta`; timestamp disimpan sebagai
    `timestamptz`.
-   Nominal keuangan menggunakan `numeric(14,2)` dan mata uang IDR.
-   Tersedia loading, empty, error, dan success state pada halaman.
-   Data keuangan dan dokumen privat tidak dimasukkan ke cache offline
    yang dapat diakses tanpa autentikasi.
-   Transaksi dan verifikasi pembayaran memerlukan koneksi internet.

------------------------------------------------------------------------

# 6. Desain Database Supabase

## 6.1 Prinsip database

-   PostgreSQL relasional.
-   Primary key menggunakan UUID.
-   Setiap tabel operasional memiliki `neighborhood_id`.
-   Timestamp menggunakan `timestamptz`.
-   Nominal uang menggunakan `numeric(14,2)`.
-   Gunakan foreign key, check constraint, unique constraint, dan
    indeks.
-   Data historis tidak dihapus jika sudah menjadi bagian transaksi.
-   Perubahan penting disimpan di audit log.
-   Hindari menyimpan nilai saldo sebagai angka yang diubah manual;
    saldo dihitung dari buku transaksi atau dipelihara melalui mekanisme
    ledger yang tervalidasi.

## 6.2 Daftar tabel

### A. Core dan autentikasi

  Tabel                Fungsi
  -------------------- --------------------------------------------
  `neighborhoods`      Identitas RT
  `profiles`           Profil akun yang terhubung ke `auth.users`
  `user_memberships`   Relasi akun, RT, dan role
  `households`         Data keluarga/rumah
  `residents`          Data individu warga

### B. Administrasi surat

  Tabel                       Fungsi
  --------------------------- ---------------------
  `letter_types`              Master jenis surat
  `letter_requests`           Pengajuan surat
  `letter_templates`          Template surat
  `letter_number_sequences`   Counter nomor surat
  `letter_attachments`        Lampiran permohonan

### C. Keuangan

  Tabel                 Fungsi
  --------------------- ---------------------------
  `dues_types`          Master jenis iuran
  `dues_invoices`       Tagihan keluarga
  `dues_payments`       Pembayaran dan bukti
  `cash_categories`     Kategori kas
  `cash_transactions`   Buku kas masuk/keluar
  `financial_periods`   Periode laporan/penutupan

### D. Informasi dan notifikasi

  Tabel                  Fungsi
  ---------------------- ---------------------
  `announcements`        Pengumuman
  `announcement_reads`   Riwayat pembacaan
  `notifications`        Notifikasi pengguna

### E. Pengaduan

  Tabel                     Fungsi
  ------------------------- -----------------------
  `complaint_categories`    Kategori pengaduan
  `complaints`              Laporan pengaduan
  `complaint_updates`       Riwayat tindak lanjut
  `complaint_attachments`   Lampiran pengaduan

### F. Kegiatan

  Tabel                     Fungsi
  ------------------------- -----------------------
  `activities`              Agenda lingkungan
  `activity_participants`   Peserta dan kehadiran
  `activity_attachments`    Dokumentasi

### G. Keamanan

  Tabel                  Fungsi
  ---------------------- ------------------
  `patrol_teams`         Regu ronda
  `patrol_members`       Anggota regu
  `patrol_schedules`     Jadwal ronda
  `patrol_reports`       Laporan ronda
  `security_incidents`   Catatan kejadian
  `guest_logs`           Buku tamu

### H. Sistem dan audit

  Tabel                 Fungsi
  --------------------- ------------------------------
  `audit_logs`          Jejak aktivitas
  `rt_settings`         Pengaturan RT
  `resident_history`    Riwayat perubahan data warga
  `document_counters`   Counter dokumen
  `user_preferences`    Tema dan preferensi pengguna

## 6.3 Struktur kolom tabel inti

### `neighborhoods`

  Kolom           Tipe          Keterangan
  --------------- ------------- -----------------
  `id`            UUID          Primary key
  `name`          TEXT          Nama lingkungan
  `rt_number`     VARCHAR(10)   Nomor RT
  `rw_number`     VARCHAR(10)   Nomor RW
  `village`       TEXT          Kelurahan
  `district`      TEXT          Kecamatan
  `city`          TEXT          Kota
  `province`      TEXT          Provinsi
  `postal_code`   VARCHAR(10)   Kode pos
  `address`       TEXT          Alamat
  `logo_url`      TEXT          Logo
  `created_at`    TIMESTAMPTZ   Waktu dibuat

### `profiles`

  Kolom          Tipe          Keterangan
  -------------- ------------- ---------------------------------
  `id`           UUID          PK sekaligus FK `auth.users.id`
  `full_name`    TEXT          Nama lengkap
  `phone`        VARCHAR(30)   Nomor HP
  `email`        TEXT          Email
  `avatar_url`   TEXT          Foto profil
  `is_active`    BOOLEAN       Status akun
  `created_at`   TIMESTAMPTZ   Waktu dibuat
  `updated_at`   TIMESTAMPTZ   Waktu diubah

### `user_memberships`

  Kolom               Tipe          Keterangan
  ------------------- ------------- --------------------
  `id`                UUID          PK
  `neighborhood_id`   UUID          FK RT
  `user_id`           UUID          FK profil
  `role`              ENUM          Role pengguna
  `resident_id`       UUID          FK warga, nullable
  `is_active`         BOOLEAN       Status keanggotaan
  `created_at`        TIMESTAMPTZ   Waktu dibuat

Constraint: satu user hanya memiliki satu membership aktif per RT untuk
rancangan awal. Jika kelak perlu riwayat role, gunakan tabel riwayat
terpisah atau ubah constraint.

### `households`

  Kolom                  Tipe          Keterangan
  ---------------------- ------------- -------------------------
  `id`                   UUID          PK
  `neighborhood_id`      UUID          FK RT
  `house_number`         VARCHAR(30)   Nomor rumah
  `address`              TEXT          Alamat
  `head_resident_id`     UUID          Kepala keluarga
  `family_card_number`   TEXT          Nomor KK, data terbatas
  `status`               TEXT          Status rumah
  `created_at`           TIMESTAMPTZ   Waktu dibuat

### `residents`

  Kolom                   Tipe          Keterangan
  ----------------------- ------------- --------------------
  `id`                    UUID          PK
  `neighborhood_id`       UUID          FK RT
  `household_id`          UUID          FK keluarga
  `user_id`               UUID          FK akun, nullable
  `nik`                   TEXT          NIK, data terbatas
  `full_name`             TEXT          Nama
  `gender`                TEXT/ENUM     Jenis kelamin
  `birth_place`           TEXT          Tempat lahir
  `birth_date`            DATE          Tanggal lahir
  `family_relationship`   TEXT          Hubungan keluarga
  `occupation`            TEXT          Pekerjaan
  `phone`                 VARCHAR(30)   Nomor HP
  `resident_status`       ENUM          Status domisili
  `joined_at`             DATE          Tanggal masuk
  `left_at`               DATE          Tanggal keluar
  `created_at`            TIMESTAMPTZ   Waktu dibuat

NIK dan nomor KK perlu perlindungan khusus, termasuk pembatasan
kolom/akses, tidak dimasukkan ke notifikasi, serta tidak diekspor tanpa
kewenangan.

### `letter_requests`

  Kolom                Tipe          Keterangan
  -------------------- ------------- -------------------
  `id`                 UUID          PK
  `neighborhood_id`    UUID          FK RT
  `resident_id`        UUID          Pemohon
  `letter_type_id`     UUID          Jenis surat
  `request_number`     VARCHAR       Nomor permohonan
  `purpose`            TEXT          Keperluan
  `form_data`          JSONB         Data tambahan
  `status`             ENUM          Status proses
  `reviewed_by`        UUID          Pemeriksa
  `approved_by`        UUID          Ketua RT
  `letter_number`      VARCHAR       Nomor surat
  `document_url`       TEXT          Lokasi file
  `rejection_reason`   TEXT          Alasan penolakan
  `created_at`         TIMESTAMPTZ   Tanggal pengajuan
  `completed_at`       TIMESTAMPTZ   Tanggal selesai

### `dues_types`

  Kolom               Tipe            Keterangan
  ------------------- --------------- ------------------------
  `id`                UUID            PK
  `neighborhood_id`   UUID            FK RT
  `name`              TEXT            Nama iuran
  `description`       TEXT            Keterangan
  `amount`            NUMERIC(14,2)   Nominal
  `billing_period`    ENUM/TEXT       Bulanan/tahunan/sekali
  `is_active`         BOOLEAN         Status

### `dues_invoices`

  Kolom               Tipe            Keterangan
  ------------------- --------------- ----------------------------------
  `id`                UUID            PK
  `neighborhood_id`   UUID            FK RT
  `household_id`      UUID            FK keluarga
  `dues_type_id`      UUID            FK jenis iuran
  `invoice_number`    VARCHAR(50)     Nomor tagihan
  `period_month`      SMALLINT        Bulan, nullable untuk nonbulanan
  `period_year`       SMALLINT        Tahun
  `amount`            NUMERIC(14,2)   Nominal tagihan
  `paid_amount`       NUMERIC(14,2)   Terbayar terverifikasi
  `status`            ENUM            unpaid/partial/paid/cancelled
  `due_date`          DATE            Jatuh tempo
  `created_at`        TIMESTAMPTZ     Waktu dibuat

### `dues_payments`

  Kolom                Tipe            Keterangan
  -------------------- --------------- ---------------------------
  `id`                 UUID            PK
  `neighborhood_id`    UUID            FK RT
  `invoice_id`         UUID            FK tagihan
  `household_id`       UUID            FK keluarga
  `payer_user_id`      UUID            Pengunggah
  `amount`             NUMERIC(14,2)   Nominal
  `payment_method`     ENUM/TEXT       Transfer/tunai
  `proof_url`          TEXT            Bukti transfer
  `payment_date`       DATE            Tanggal bayar
  `status`             ENUM            pending/verified/rejected
  `verified_by`        UUID            Verifikator
  `verified_at`        TIMESTAMPTZ     Waktu verifikasi
  `rejection_reason`   TEXT            Alasan penolakan
  `created_at`         TIMESTAMPTZ     Waktu dibuat

### `cash_transactions`

  Kolom                  Tipe            Keterangan
  ---------------------- --------------- ------------------------------------
  `id`                   UUID            PK
  `neighborhood_id`      UUID            FK RT
  `category_id`          UUID            FK kategori
  `payment_id`           UUID            FK pembayaran, nullable dan unique
  `transaction_number`   VARCHAR(50)     Nomor transaksi
  `transaction_type`     ENUM            income/expense
  `amount`               NUMERIC(14,2)   Nominal
  `transaction_date`     DATE            Tanggal
  `description`          TEXT            Keterangan
  `recorded_by`          UUID            Pencatat
  `created_at`           TIMESTAMPTZ     Waktu dibuat

### Tabel operasional lain

  -----------------------------------------------------------------------
  Tabel                               Kolom penting
  ----------------------------------- -----------------------------------
  `announcements`                     `title`, `content`, `category`,
                                      `status`, `published_at`,
                                      `created_by`

  `announcement_reads`                `announcement_id`, `user_id`,
                                      `read_at`

  `notifications`                     `user_id`, `title`, `message`,
                                      `type`, `reference_id`, `read_at`

  `complaint_categories`              `name`, `is_active`

  `complaints`                        `resident_id`, `category_id`,
                                      `title`, `description`, `priority`,
                                      `status`, `assigned_to`

  `complaint_updates`                 `complaint_id`, `status`,
                                      `message`, `updated_by`

  `complaint_attachments`             `complaint_id`, `storage_path`,
                                      `uploaded_by`

  `activities`                        `title`, `description`, `location`,
                                      `start_at`, `end_at`, `status`

  `activity_participants`             `activity_id`, `resident_id`,
                                      `attendance_status`

  `activity_attachments`              `activity_id`, `storage_path`

  `patrol_teams`                      `name`, `neighborhood_id`

  `patrol_members`                    `team_id`, `resident_id`

  `patrol_schedules`                  `team_id`, `patrol_date`,
                                      `start_time`, `end_time`

  `patrol_reports`                    `schedule_id`, `report`, `status`,
                                      `submitted_by`

  `security_incidents`                `title`, `description`,
                                      `incident_date`, `location`,
                                      `status`

  `guest_logs`                        `visitor_name`, `destination`,
                                      `arrival_at`, `departure_at`,
                                      `recorded_by`

  `audit_logs`                        `user_id`, `action`, `table_name`,
                                      `record_id`, `old_data`,
                                      `new_data`, `created_at`

  `rt_settings`                       `neighborhood_id`, `setting_key`,
                                      `setting_value`

  `resident_history`                  `resident_id`, `change_type`,
                                      `old_data`, `new_data`,
                                      `changed_by`

  `document_counters`                 `neighborhood_id`, `document_type`,
                                      `period_key`, `last_number`

  `user_preferences`                  `user_id`, `theme`,
                                      `notification_preferences`
  -----------------------------------------------------------------------

## 6.4 Relasi dan constraint wajib

-   `profiles.id` mereferensikan `auth.users.id`.
-   `user_memberships.user_id` mereferensikan `profiles.id`.
-   `households` memiliki banyak `residents`.
-   `households.head_resident_id` mereferensikan `residents.id`;
    constraint dapat dibuat deferred untuk menangani pembuatan keluarga
    dan kepala keluarga dalam satu transaksi.
-   `dues_invoices` mereferensikan `households` dan `dues_types`.
-   `dues_payments` mereferensikan invoice dan keluarga yang sama.
-   `cash_transactions.payment_id` unique agar satu pembayaran tidak
    membuat pemasukan kas ganda.
-   Pastikan seluruh foreign key lintas tabel memeriksa
    `neighborhood_id` yang sama. Gunakan composite foreign key atau
    validasi database yang setara.
-   Tambahkan unique constraint untuk nomor surat, nomor tagihan, nomor
    transaksi, dan kombinasi periode tagihan.
-   Tambahkan indeks pada foreign key, status, tanggal transaksi, dan
    kolom pencarian yang sering digunakan.

## 6.5 Migration SQL fondasi

SQL berikut merupakan titik awal migration core. Ini bukan keseluruhan
schema production; tabel operasional, constraint lintas RT, fungsi
transaksi, dan policy lengkap perlu ditambahkan melalui migration
terpisah.

``` sql
create extension if not exists pgcrypto;

create type public.app_role as enum (
  'ketua_rt',
  'sekretaris',
  'bendahara',
  'pengurus',
  'warga'
);

create type public.resident_status as enum (
  'tetap',
  'kontrak',
  'pendatang',
  'pindah',
  'meninggal'
);

create type public.invoice_status as enum (
  'unpaid',
  'partial',
  'paid',
  'cancelled'
);

create type public.payment_status as enum (
  'pending',
  'verified',
  'rejected'
);

create type public.transaction_type as enum (
  'income',
  'expense'
);

create type public.request_status as enum (
  'submitted',
  'review',
  'approved',
  'rejected',
  'completed'
);

create table public.neighborhoods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rt_number varchar(10) not null,
  rw_number varchar(10),
  village text,
  district text,
  city text,
  province text,
  postal_code varchar(10),
  address text,
  logo_url text,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  full_name text not null,
  phone varchar(30),
  email text,
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_memberships (
  id uuid primary key default gen_random_uuid(),
  neighborhood_id uuid not null references public.neighborhoods(id),
  user_id uuid not null references public.profiles(id),
  role public.app_role not null,
  resident_id uuid,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (neighborhood_id, user_id)
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  neighborhood_id uuid not null references public.neighborhoods(id),
  house_number varchar(30) not null,
  address text not null,
  head_resident_id uuid,
  family_card_number text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique (neighborhood_id, house_number)
);

create table public.residents (
  id uuid primary key default gen_random_uuid(),
  neighborhood_id uuid not null references public.neighborhoods(id),
  household_id uuid not null references public.households(id),
  user_id uuid references public.profiles(id),
  nik text,
  full_name text not null,
  gender text,
  birth_place text,
  birth_date date,
  family_relationship text,
  occupation text,
  phone varchar(30),
  resident_status public.resident_status not null default 'tetap',
  joined_at date,
  left_at date,
  created_at timestamptz not null default now()
);

alter table public.households
  add constraint households_head_fk
  foreign key (head_resident_id)
  references public.residents(id)
  deferrable initially deferred;

alter table public.user_memberships
  add constraint memberships_resident_fk
  foreign key (resident_id)
  references public.residents(id);

create table public.dues_types (
  id uuid primary key default gen_random_uuid(),
  neighborhood_id uuid not null references public.neighborhoods(id),
  name text not null,
  description text,
  amount numeric(14,2) not null check (amount >= 0),
  billing_period text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.dues_invoices (
  id uuid primary key default gen_random_uuid(),
  neighborhood_id uuid not null references public.neighborhoods(id),
  household_id uuid not null references public.households(id),
  dues_type_id uuid not null references public.dues_types(id),
  invoice_number varchar(50) not null,
  period_month smallint,
  period_year smallint not null,
  amount numeric(14,2) not null check (amount > 0),
  paid_amount numeric(14,2) not null default 0,
  status public.invoice_status not null default 'unpaid',
  due_date date,
  created_at timestamptz not null default now(),
  unique (neighborhood_id, invoice_number),
  check (paid_amount >= 0 and paid_amount <= amount)
);

create table public.dues_payments (
  id uuid primary key default gen_random_uuid(),
  neighborhood_id uuid not null references public.neighborhoods(id),
  invoice_id uuid not null references public.dues_invoices(id),
  household_id uuid not null references public.households(id),
  payer_user_id uuid not null references public.profiles(id),
  amount numeric(14,2) not null check (amount > 0),
  payment_method text not null,
  proof_url text,
  payment_date date not null,
  status public.payment_status not null default 'pending',
  verified_by uuid references public.profiles(id),
  verified_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now()
);

create table public.cash_categories (
  id uuid primary key default gen_random_uuid(),
  neighborhood_id uuid not null references public.neighborhoods(id),
  name text not null,
  transaction_type public.transaction_type not null,
  is_active boolean not null default true
);

create table public.cash_transactions (
  id uuid primary key default gen_random_uuid(),
  neighborhood_id uuid not null references public.neighborhoods(id),
  category_id uuid references public.cash_categories(id),
  payment_id uuid unique references public.dues_payments(id),
  transaction_number varchar(50) not null,
  transaction_type public.transaction_type not null,
  amount numeric(14,2) not null check (amount > 0),
  transaction_date date not null,
  description text,
  recorded_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (neighborhood_id, transaction_number)
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  neighborhood_id uuid not null references public.neighborhoods(id),
  title text not null,
  content text not null,
  category text,
  status text not null default 'draft',
  published_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  neighborhood_id uuid not null references public.neighborhoods(id),
  user_id uuid not null references public.profiles(id),
  title text not null,
  message text not null,
  type text,
  reference_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.complaints (
  id uuid primary key default gen_random_uuid(),
  neighborhood_id uuid not null references public.neighborhoods(id),
  resident_id uuid not null references public.residents(id),
  title text not null,
  description text not null,
  category_id uuid,
  priority text not null default 'normal',
  status text not null default 'submitted',
  assigned_to uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  neighborhood_id uuid not null references public.neighborhoods(id),
  title text not null,
  description text,
  location text,
  start_at timestamptz not null,
  end_at timestamptz,
  status text not null default 'planned',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  neighborhood_id uuid not null references public.neighborhoods(id),
  user_id uuid references public.profiles(id),
  action text not null,
  table_name text not null,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index idx_residents_neighborhood
  on public.residents(neighborhood_id);

create index idx_residents_household
  on public.residents(household_id);

create index idx_invoices_household
  on public.dues_invoices(household_id);

create index idx_invoices_status
  on public.dues_invoices(neighborhood_id, status);

create index idx_payments_status
  on public.dues_payments(neighborhood_id, status);

create index idx_cash_date
  on public.cash_transactions(neighborhood_id, transaction_date);

create index idx_notifications_user
  on public.notifications(user_id, read_at);
```

**Peringatan implementasi:** SQL di atas belum boleh dianggap sebagai
migration production lengkap. Tambahkan validasi konsistensi
`neighborhood_id` di setiap relasi, unique constraint periode tagihan,
aturan cicilan, trigger/RPC verifikasi atomik, seluruh tabel yang
tercantum, grants, dan policy RLS. Jangan menjalankan aplikasi dengan
RLS aktif tetapi tanpa policy yang sudah diuji, atau membuka tabel
sensitif untuk semua role.

------------------------------------------------------------------------

## 7. Keamanan dan Row Level Security

### 7.1 Kebijakan wajib

1.  Aktifkan RLS pada semua tabel yang dapat diakses client.
2.  Buat policy terpisah untuk `SELECT`, `INSERT`, `UPDATE`, dan
    `DELETE`.
3.  Batasi akses berdasarkan membership aktif dan `neighborhood_id`.
4.  Batasi warga berdasarkan `resident_id`, `user_id`, dan/atau relasi
    keluarga yang tervalidasi.
5.  Batasi kolom NIK dan nomor KK melalui view/RPC atau akses server
    terkontrol.
6.  Jangan memberi akses langsung ke `service_role` dari browser.
7.  Jangan mengizinkan pengguna biasa mengubah `role`,
    `neighborhood_id`, `verified_by`, atau status verifikasi secara
    langsung.
8.  Simpan bukti transfer dan dokumen identitas pada bucket privat.
9.  Gunakan signed URL berumur pendek.
10. Audit setiap perubahan role, pembayaran, kas, surat, dan data warga
    yang penting.

### 7.2 Helper function role

Contoh pola helper function. Fungsi ini hanya pemeriksaan role dasar;
policy lengkap tetap harus membatasi operasi dan kepemilikan record.

``` sql
create or replace function public.has_rt_role(
  p_neighborhood_id uuid,
  p_roles public.app_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_memberships m
    where m.neighborhood_id = p_neighborhood_id
      and m.user_id = (select auth.uid())
      and m.is_active = true
      and m.role = any(p_roles)
  );
$$;

revoke all on function public.has_rt_role(
  uuid, public.app_role[]
) from public;

grant execute on function public.has_rt_role(
  uuid, public.app_role[]
) to authenticated;
```

Sebelum digunakan, pastikan owner fungsi tepercaya, akses `EXECUTE`
dibatasi, dan fungsi tidak menjadi jalur eskalasi hak akses. Fungsi
`SECURITY DEFINER` harus menggunakan `search_path` aman dan query yang
sepenuhnya terkualifikasi.

### 7.3 Contoh policy terbatas

``` sql
alter table public.residents enable row level security;

create policy "resident managers can read residents"
on public.residents
for select to authenticated
using (
  public.has_rt_role(
    neighborhood_id,
    array['ketua_rt','sekretaris']::public.app_role[]
  )
);

create policy "resident managers can insert residents"
on public.residents
for insert to authenticated
with check (
  public.has_rt_role(
    neighborhood_id,
    array['ketua_rt','sekretaris']::public.app_role[]
  )
);
```

Policy ini hanya contoh akses pengelola. Tambahkan policy update/delete
yang sesuai dan policy warga untuk data miliknya. Jangan menggunakan
satu policy `FOR ALL` secara luas untuk mengatasi seluruh kebutuhan
akses.

### 7.4 Storage buckets

  Bucket                 Akses
  ---------------------- ----------------------------------------------
  `avatars`              Terkontrol; foto profil
  `payment-proofs`       Privat
  `resident-documents`   Privat
  `letters`              Privat
  `complaint-files`      Privat/terkontrol
  `announcements`        Publik atau terkontrol sesuai jenis lampiran
  `activity-media`       Terkontrol

Gunakan path file berbasis UUID dan jangan memasukkan NIK, nomor KK,
atau nomor rekening ke nama file.

------------------------------------------------------------------------

## 8. Service dan API Design

CRUD standar dapat menggunakan Supabase Client dengan RLS. Operasi
sensitif menggunakan PostgreSQL RPC atau Supabase Edge Functions.

  Service           Tanggung jawab
  ----------------- ------------------------------------------
  `auth`            Login, logout, profil, sesi
  `residents`       Data warga
  `households`      Data keluarga
  `letters`         Pengajuan, review, approval, nomor surat
  `dues`            Jenis iuran dan tagihan
  `payments`        Pembayaran dan verifikasi
  `cash`            Pemasukan, pengeluaran, saldo
  `announcements`   Informasi warga
  `complaints`      Pengaduan
  `activities`      Agenda dan peserta
  `security`        Ronda, tamu, kejadian
  `reports`         Rekap dan export
  `notifications`   Notifikasi
  `audit`           Riwayat aktivitas

### 8.1 Fungsi database sensitif

-   `verify_dues_payment(payment_id)` --- verifikasi pembayaran dan
    pembuatan transaksi kas dalam satu transaksi.
-   `reject_dues_payment(payment_id, reason)` --- penolakan pembayaran.
-   `create_invoice(...)` --- membuat tagihan dengan validasi periode
    dan duplikasi.
-   `issue_letter_number(...)` --- membuat nomor surat atomik.
-   `record_cash_expense(...)` --- mencatat pengeluaran dengan validasi
    role dan bukti.
-   `publish_announcement(...)` --- memublikasikan pengumuman dan
    menyiapkan notifikasi.

### 8.2 Aturan verifikasi pembayaran

Fungsi verifikasi wajib: 1. Memeriksa role Ketua RT/Bendahara. 2.
Mengunci record pembayaran dan invoice. 3. Memastikan status pembayaran
masih `pending`. 4. Memastikan invoice dan pembayaran berasal dari RT
serta keluarga yang sama. 5. Memastikan jumlah pembayaran tidak
melampaui sisa tagihan. 6. Mengubah status pembayaran menjadi
`verified`. 7. Memperbarui `paid_amount` dan status invoice. 8. Membuat
satu transaksi `income` yang terhubung ke pembayaran. 9. Menulis audit
log. 10. Membuat notifikasi warga.

Semua langkah dilakukan dalam satu transaksi. Jika satu langkah gagal,
seluruh perubahan harus rollback.

### 8.3 Nomor surat

Format awal yang disarankan:

`001/RT.001/XI/2026`

Format dapat disesuaikan melalui pengaturan RT. Nomor diterbitkan secara
atomik menggunakan counter per RT, jenis dokumen, dan periode. Nomor
yang sudah diterbitkan tidak boleh digunakan kembali.

------------------------------------------------------------------------

## 9. Struktur Folder Proyek

Nama repository/folder: `WargaKu`

``` text
WargaKu/
│
├── public/
│   ├── icons/
│   ├── images/
│   ├── favicon.ico
│   ├── manifest.webmanifest
│   └── offline.html
│
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   ├── router.tsx
│   │   ├── providers.tsx
│   │   └── permissions.ts
│   │
│   ├── assets/
│   │   ├── logo/
│   │   └── illustrations/
│   │
│   ├── components/
│   │   ├── ui/
│   │   ├── forms/
│   │   ├── tables/
│   │   ├── charts/
│   │   ├── dialogs/
│   │   └── layouts/
│   │
│   ├── layouts/
│   │   ├── AdminLayout.tsx
│   │   ├── ResidentLayout.tsx
│   │   ├── AuthLayout.tsx
│   │   └── MobileLayout.tsx
│   │
│   ├── modules/
│   │   ├── dashboard/
│   │   ├── residents/
│   │   ├── households/
│   │   ├── letters/
│   │   ├── dues/
│   │   ├── payments/
│   │   ├── cash/
│   │   ├── announcements/
│   │   ├── complaints/
│   │   ├── activities/
│   │   ├── security/
│   │   ├── reports/
│   │   ├── notifications/
│   │   ├── users/
│   │   └── settings/
│   │
│   ├── hooks/
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── utils.ts
│   │   └── constants.ts
│   │
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── residents.service.ts
│   │   ├── letters.service.ts
│   │   ├── payments.service.ts
│   │   ├── cash.service.ts
│   │   └── reports.service.ts
│   │
│   ├── stores/
│   │   ├── auth.store.ts
│   │   ├── ui.store.ts
│   │   └── notification.store.ts
│   │
│   ├── types/
│   │   ├── database.types.ts
│   │   ├── resident.types.ts
│   │   ├── finance.types.ts
│   │   └── common.types.ts
│   │
│   ├── styles/
│   │   ├── globals.css
│   │   ├── themes.css
│   │   └── components.css
│   │
│   └── main.tsx
│
├── supabase/
│   ├── migrations/
│   ├── functions/
│   │   ├── send-notification/
│   │   ├── generate-letter/
│   │   └── export-report/
│   ├── seed.sql
│   └── config.toml
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

### 9.1 Dependencies yang disarankan

  Package                   Fungsi
  ------------------------- ---------------------
  `react`                   UI framework
  `typescript`              Type safety
  `vite`                    Build tool
  `tailwindcss`             Styling
  `@supabase/supabase-js`   Supabase client
  `react-router-dom`        Routing
  `lucide-react`            Ikon
  `react-hook-form`         Form
  `zod`                     Validasi
  `@tanstack/react-query`   Server state/cache
  `recharts`                Grafik
  `date-fns`                Pengolahan tanggal
  `zustand`                 State management
  `vite-plugin-pwa`         PWA
  `jspdf`                   PDF sederhana
  `xlsx`                    Import/export Excel

Gunakan versi stabil yang saling kompatibel saat inisialisasi proyek.

### 9.2 Environment variables

`.env.example`:

``` bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Gunakan publishable key atau anon key sesuai konfigurasi Supabase.
Jangan pernah menaruh `service_role` key di frontend, repository publik,
atau file yang dikirim ke browser.

------------------------------------------------------------------------

## 10. Identitas Visual dan UI/UX

### 10.1 Brand

-   Nama: **WargaKu**
-   Kategori: Smart Neighborhood Management System
-   Tagline: **Satu Aplikasi, Semua Urusan Warga.**
-   Karakter: modern, ramah, terpercaya, praktis.
-   Konsep logo: rumah, simbol warga, dan konektivitas.

### 10.2 Palet warna

  Token          Hex         Penggunaan
  -------------- ----------- ------------------------------
  Primary Blue   `#2563EB`   Tombol utama, navigasi aktif
  Fresh Green    `#10B981`   Status berhasil
  Modern Navy    `#0F172A`   Teks utama/sidebar dark
  Soft Gray      `#F1F5F9`   Background
  Warm Orange    `#F59E0B`   Peringatan dan perhatian

### 10.3 Light Mode

-   Background: `#F8FAFC`
-   Card: `#FFFFFF`
-   Primary: `#2563EB`
-   Text: `#0F172A`
-   Border: `#E2E8F0`

### 10.4 Dark Mode

-   Background: `#0F172A`
-   Card: `#1E293B`
-   Primary: `#3B82F6`
-   Text: `#F8FAFC`
-   Border: `#334155`

### 10.5 Tipografi dan komponen

-   Font utama: Plus Jakarta Sans.
-   Alternatif: Inter.
-   Judul: Bold/Semibold.
-   Isi: Regular.
-   Sidebar desktop dapat diperkecil.
-   Mobile memakai navigasi yang mudah disentuh.
-   Tabel memiliki pencarian, filter, dan pagination.
-   Form memiliki validasi.
-   Aksi approval memerlukan konfirmasi.
-   Status memakai badge konsisten.
-   Setiap halaman memiliki loading, empty, error, dan success state.
-   Tema tersedia sebagai Light, Dark, dan System; preferensi disimpan
    per pengguna.

### 10.6 Navigasi utama

**Admin:** - Dashboard - Data Warga - Data Keluarga - Surat & Layanan -
Kas & Iuran - Pengumuman - Pengaduan - Kegiatan - Keamanan - Laporan -
Pengguna - Pengaturan

**Warga:** - Beranda - Data Keluarga - Surat Saya - Tagihan &
Pembayaran - Pengumuman - Pengaduan - Kegiatan - Notifikasi - Profil

------------------------------------------------------------------------

## 11. PWA dan Perilaku Offline

-   Manifest berisi nama, short name, ikon, warna tema, dan display
    mode.
-   Service worker meng-cache aset statis dan shell aplikasi.
-   Sediakan halaman offline yang menjelaskan koneksi diperlukan untuk
    transaksi.
-   Jangan cache dokumen pribadi, bukti transfer, data NIK, atau respons
    keuangan sensitif.
-   Notifikasi web push hanya setelah pengguna memberikan izin.
-   Perubahan data dan pembayaran memerlukan koneksi internet.
-   Jangan menganggap PWA sebagai aplikasi offline penuh.

------------------------------------------------------------------------

## 12. Roadmap Development

### Tahap 1 --- Foundation

-   Setup React, Vite, TypeScript.
-   Setup Supabase.
-   Authentication.
-   Role dan membership.
-   Database core.
-   RLS dan pengujian akses.
-   Layout desktop/mobile.
-   Light/Dark/System.
-   PWA dasar.

### Tahap 2 --- Master Data

-   Identitas RT.
-   Data keluarga.
-   Data warga.
-   Akun warga.
-   Import/export data dengan pembatasan akses.
-   Riwayat perubahan.

### Tahap 3 --- Administrasi Surat

-   Master surat.
-   Form pengajuan.
-   Pemeriksaan.
-   Approval.
-   Nomor otomatis.
-   PDF dan arsip.

### Tahap 4 --- Keuangan

-   Master iuran.
-   Tagihan.
-   Upload bukti.
-   Verifikasi pembayaran.
-   Buku kas.
-   Pengeluaran.
-   Rekap saldo.

### Tahap 5 --- Informasi dan Komunikasi

-   Pengumuman.
-   Notifikasi.
-   Pengaduan.
-   Tanggapan pengurus.

### Tahap 6 --- Kegiatan dan Keamanan

-   Kalender.
-   Peserta dan kehadiran.
-   Jadwal ronda.
-   Buku tamu.
-   Catatan kejadian.

### Tahap 7 --- Laporan

-   Statistik warga.
-   Laporan surat.
-   Laporan keuangan.
-   Laporan kegiatan.
-   Laporan pengaduan.
-   Export PDF dan Excel.

### Tahap 8 --- Testing dan Deployment

-   Uji RLS antar-akun.
-   Uji alur pembayaran.
-   Uji nomor surat bersamaan.
-   Uji mobile.
-   Uji PWA.
-   Backup dan restore.
-   Deployment Vercel.
-   Domain dan SSL.
-   Uji coba dengan pengurus dan warga.

------------------------------------------------------------------------

## 13. Acceptance Criteria

  Area             Kriteria selesai
  ---------------- ---------------------------------------------------
  Authentication   Pengguna hanya dapat masuk dengan akun valid
  Role             Pengguna tidak dapat mengakses modul di luar izin
  Data warga       CRUD dan relasi keluarga berjalan benar
  Surat            Approval dan nomor surat tidak duplikat
  Iuran            Tagihan terhubung ke keluarga dan periode
  Pembayaran       Bukti diverifikasi; tidak ada pencatatan ganda
  Kas              Saldo sama dengan hasil buku transaksi
  Pengaduan        Status dan riwayat tindak lanjut tersimpan
  Notifikasi       Penerima sesuai sasaran
  PWA              Bisa diinstal dan dibuka di perangkat
  Security         RLS diuji menggunakan akun dari role berbeda
  Laporan          Total laporan cocok dengan data sumber

------------------------------------------------------------------------

## 14. Checklist Implementasi Awal

-   [ ] Buat project Supabase.
-   [ ] Buat project React + Vite + TypeScript.
-   [ ] Konfigurasi environment variables.
-   [ ] Buat migration database core.
-   [ ] Aktifkan RLS dan buat policy.
-   [ ] Siapkan bucket Storage privat.
-   [ ] Buat autentikasi dan role.
-   [ ] Buat layout dashboard desktop dan mobile.
-   [ ] Implementasikan Light + Dark + System.
-   [ ] Konfigurasi PWA dan manifest.

------------------------------------------------------------------------

## 15. Risiko dan Catatan Keputusan

1.  **Data pribadi:** NIK, KK, alamat, dan kontak harus dibatasi sesuai
    kebutuhan dan kewenangan.
2.  **Keuangan:** jangan mengubah saldo secara manual; semua saldo harus
    dapat ditelusuri ke transaksi.
3.  **Pembayaran:** verifikasi harus atomik, idempotent, dan mencegah
    pembayaran melebihi sisa tagihan.
4.  **Nomor dokumen:** counter harus aman dari permintaan bersamaan.
5.  **Multi-RT di masa depan:** `neighborhood_id` dipertahankan sejak
    awal meskipun deployment pertama hanya satu RT.
6.  **PWA:** data sensitif tidak disimpan di cache offline.
7.  **Backup:** jadwalkan backup dan lakukan uji pemulihan, bukan hanya
    mengandalkan backup otomatis.
8.  **Kebijakan RT:** format surat, jenis iuran, persetujuan
    pengeluaran, dan informasi publik harus dikonfirmasi oleh pengurus.
9.  **Kepatuhan:** pengelolaan data warga harus mengikuti ketentuan
    perlindungan data pribadi yang berlaku.
10. **Production readiness:** schema awal dan contoh policy dalam
    dokumen ini adalah fondasi desain, bukan pengganti audit keamanan
    dan pengujian menyeluruh.

------------------------------------------------------------------------

## 16. Urutan Pekerjaan Berikutnya

Urutan implementasi yang direkomendasikan:

1.  Finalisasi detail kolom dan relasi seluruh tabel.
2.  Buat seluruh migration Supabase.
3.  Buat RLS per tabel dan per operasi.
4.  Buat RPC transaksi pembayaran dan penerbitan nomor surat.
5.  Buat seed data master.
6.  Buat autentikasi dan layout aplikasi.
7.  Implementasikan modul Data Warga dan Keluarga.
8.  Lanjutkan modul surat, keuangan, komunikasi, kegiatan, keamanan, dan
    laporan.
9.  Jalankan pengujian keamanan dan alur bisnis.
10. Deploy dan uji coba terbatas.

**Status dokumen:** baseline PRD dan technical specification WargaKu
telah ditetapkan untuk menjadi acuan development. Perubahan terhadap
role, alur persetujuan, dan aturan keuangan harus dicatat sebagai revisi
spesifikasi.
