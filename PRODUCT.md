# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Pinned by PRD (`WargaKu_PRD_Technical_Specification.md` §1.1, §9): React + Vite + TypeScript, Tailwind CSS, Supabase (Postgres, Auth, Storage, RLS), PWA via vite-plugin-pwa, Vercel hosting. Motion via GSAP (user-requested skill `react-gsap-motion`).

First build runs in **demo mode** (user decision, 26 Nov 2026): local seeded data in the browser so every flow is usable without a backend; the full Supabase migrations, RLS policies, and RPCs ship alongside, and the app switches to Supabase when `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are set.

## Users

One RT (rukun tetangga) in Indonesia. Five roles: Ketua RT (final approver, role admin), Sekretaris (resident data, letters), Bendahara (dues, payments, cash book), Pengurus (activities, security, assigned complaints), Warga (own family data, requests, bills). Pengurus use a laptop for admin work; warga mostly use a phone, often installing the PWA.

## Product Purpose

Pusat pelayanan digital warga: administrasi, layanan surat, iuran dan kas, pengumuman, pengaduan, kegiatan, keamanan, dan laporan dalam satu aplikasi. Success = RT administration that is orderly, transparent, accessible and documented, without removing pengurus approval steps.

## Positioning

Not a generic admin template: approval chains mirror how an RT actually works (Sekretaris checks, Ketua RT signs; Bendahara verifies before kas moves), and money is a ledger, never an editable balance.

## Operating Context

Letters numbered `001/RT.001/XI/2026`; dues paid by bank transfer outside the app or cash, then proof uploaded and verified; ronda schedules, kerja bakti, rapat warga, buku tamu. Timezone Asia/Jakarta, currency IDR.

## Capabilities and Constraints

- Language: Bahasa Indonesia throughout.
- Light / Dark / System theme, saved per user.
- Uploading proof only creates a `pending` payment; balance changes only on verification, atomically, never twice.
- NIK and nomor KK are restricted personal data: masked by default, never in notifications or file names.
- Corrections to kas are reversing entries, never deletes.
- PWA must not cache financial data or private documents offline.
- No payment gateway in this phase.

## Brand Commitments

- Name **WargaKu**; tagline **"Satu Aplikasi, Semua Urusan Warga."**
- Category line: Smart Neighborhood Management System.
- Character: modern, ramah, terpercaya, praktis. Values shown in the brand sheet: Rukun & Peduli, Mudah & Cepat, Aman & Terpercaya, Bersama Lebih Baik.
- Logo: house roof over a family of three with a green leaf swoosh, white on a blue rounded-square tile (recreated as SVG from the user's brand sheet).
- Palette (PRD §10.2–10.4): Primary Blue #2563EB, Fresh Green #10B981, Modern Navy #0F172A, Soft Gray #F1F5F9, Warm Orange #F59E0B; dark mode bg #0F172A / card #1E293B / primary #3B82F6.
- Typeface: Plus Jakarta Sans (pinned by PRD §10.5).
- Reference layout: user's brand sheet (navy sidebar desktop dashboard, blue hero greeting, stat row, phone home with icon grid and bottom nav).

## Evidence on Hand

- PRD: `WargaKu_PRD_Technical_Specification.md`.
- Brand sheet image supplied in chat (not in repo).
- No real resident data: all demo names, numbers and amounts are synthetic and must be labelled as demo data.

## Product Principles

1. Approval is a feature, not friction: every state change shows who did it and when.
2. Money is traceable: every rupiah on screen can be traced to a transaction.
3. Privacy by default: personal identifiers are hidden unless the role needs them.
4. Phone-first for warga, desk-first for pengurus.
5. Plain Indonesian over jargon.

## Accessibility & Inclusion

Users include older residents on mid-range Android phones: large touch targets, readable type, sufficient contrast in both themes, respects reduced motion.
