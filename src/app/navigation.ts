import {
  Bell, BookUser, ChartColumn, FileText, House, LayoutDashboard, Megaphone, MessageSquareWarning, Settings, ShieldCheck,
  CalendarDays, UserCog, Users, Wallet, UserRound, type LucideIcon,
} from 'lucide-react';
import type { Role } from '@/types/models';
import { can, type Action } from './permissions';

export interface NavItem {
  to: string;
  label: string;
  short?: string;
  icon: LucideIcon;
  need?: Action;
  roles?: Role[];
}

/** Navigasi admin (PRD §10.6) */
const ADMIN: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/warga', label: 'Data Warga', icon: Users, need: 'residents.view' },
  { to: '/keluarga', label: 'Data Keluarga', icon: BookUser, need: 'households.view' },
  { to: '/surat', label: 'Surat & Layanan', short: 'Surat', icon: FileText },
  { to: '/iuran', label: 'Kas & Iuran', short: 'Iuran', icon: Wallet },
  { to: '/pengumuman', label: 'Pengumuman', icon: Megaphone },
  { to: '/pengaduan', label: 'Pengaduan', icon: MessageSquareWarning },
  { to: '/kegiatan', label: 'Kegiatan', icon: CalendarDays },
  { to: '/keamanan', label: 'Keamanan', icon: ShieldCheck, need: 'security.view' },
  { to: '/laporan', label: 'Laporan', icon: ChartColumn, need: 'reports.view' },
  { to: '/pengguna', label: 'Pengguna', icon: UserCog, need: 'users.manage' },
  { to: '/pengaturan', label: 'Pengaturan', icon: Settings },
];

/** Navigasi warga (PRD §10.6) */
const RESIDENT: NavItem[] = [
  { to: '/', label: 'Beranda', icon: House },
  { to: '/keluarga', label: 'Data Keluarga', short: 'Keluarga', icon: BookUser },
  { to: '/surat', label: 'Surat Saya', short: 'Surat', icon: FileText },
  { to: '/iuran', label: 'Tagihan & Pembayaran', short: 'Tagihan', icon: Wallet },
  { to: '/pengumuman', label: 'Pengumuman', icon: Megaphone },
  { to: '/pengaduan', label: 'Pengaduan', icon: MessageSquareWarning },
  { to: '/kegiatan', label: 'Kegiatan', icon: CalendarDays },
  { to: '/notifikasi', label: 'Notifikasi', icon: Bell },
  { to: '/pengaturan', label: 'Profil', icon: UserRound },
];

export function navFor(role: Role): NavItem[] {
  const list = role === 'warga' ? RESIDENT : ADMIN;
  return list.filter((i) => !i.need || can(role, i.need));
}

/** 4 item utama + "Lainnya" untuk tab bar HP */
export function bottomNavFor(role: Role): NavItem[] {
  if (role === 'warga')
    return [
      { to: '/', label: 'Beranda', icon: House },
      { to: '/iuran', label: 'Tagihan', icon: Wallet },
      { to: '/surat', label: 'Surat', icon: FileText },
      { to: '/notifikasi', label: 'Notifikasi', icon: Bell },
    ];
  const base: NavItem[] = [{ to: '/', label: 'Dashboard', icon: LayoutDashboard }];
  if (role === 'bendahara') base.push({ to: '/iuran', label: 'Iuran', icon: Wallet }, { to: '/laporan', label: 'Laporan', icon: ChartColumn });
  else if (role === 'pengurus') base.push({ to: '/keamanan', label: 'Keamanan', icon: ShieldCheck }, { to: '/pengaduan', label: 'Aduan', icon: MessageSquareWarning });
  else base.push({ to: '/warga', label: 'Warga', icon: Users }, { to: '/surat', label: 'Surat', icon: FileText });
  base.push({ to: '/notifikasi', label: 'Notifikasi', icon: Bell });
  return base;
}
