import type { Role } from '@/types/models';

/**
 * Matriks hak akses (PRD §2.1). Ini hanya untuk tampilan/menu di frontend —
 * penegakan sesungguhnya ada di RLS + RPC (supabase/migrations) dan di
 * pemeriksaan role yang sama di src/stores/db.store.ts.
 */
export type Action =
  | 'dashboard.admin'
  | 'residents.view'
  | 'residents.manage'
  | 'residents.viewSensitive'
  | 'residents.export'
  | 'households.view'
  | 'households.manage'
  | 'letters.viewAll'
  | 'letters.review'
  | 'letters.approve'
  | 'letters.request'
  | 'dues.viewAll'
  | 'dues.manage'
  | 'payments.verify'
  | 'payments.submitForOthers'
  | 'cash.view'
  | 'cash.manage'
  | 'announcements.create'
  | 'announcements.publish'
  | 'complaints.viewAll'
  | 'complaints.assign'
  | 'complaints.handle'
  | 'activities.manage'
  | 'security.view'
  | 'security.manage'
  | 'reports.view'
  | 'reports.finance'
  | 'reports.residents'
  | 'users.manage'
  | 'settings.rt'
  | 'audit.view'
  | 'audit.finance';

const M: Record<Action, Role[]> = {
  'dashboard.admin': ['ketua_rt', 'sekretaris', 'bendahara', 'pengurus'],
  'residents.view': ['ketua_rt', 'sekretaris', 'bendahara', 'pengurus'],
  'residents.manage': ['ketua_rt', 'sekretaris'],
  'residents.viewSensitive': ['ketua_rt', 'sekretaris'],
  'residents.export': ['ketua_rt', 'sekretaris'],
  'households.view': ['ketua_rt', 'sekretaris', 'bendahara'],
  'households.manage': ['ketua_rt', 'sekretaris'],
  'letters.viewAll': ['ketua_rt', 'sekretaris'],
  'letters.review': ['ketua_rt', 'sekretaris'],
  'letters.approve': ['ketua_rt'],
  'letters.request': ['ketua_rt', 'sekretaris', 'bendahara', 'pengurus', 'warga'],
  'dues.viewAll': ['ketua_rt', 'sekretaris', 'bendahara'],
  'dues.manage': ['ketua_rt', 'bendahara'],
  'payments.verify': ['ketua_rt', 'bendahara'],
  'payments.submitForOthers': ['ketua_rt', 'bendahara', 'pengurus'],
  'cash.view': ['ketua_rt', 'sekretaris', 'bendahara'],
  'cash.manage': ['ketua_rt', 'bendahara'],
  'announcements.create': ['ketua_rt', 'sekretaris', 'pengurus'],
  'announcements.publish': ['ketua_rt', 'sekretaris'],
  'complaints.viewAll': ['ketua_rt', 'sekretaris'],
  'complaints.assign': ['ketua_rt'],
  'complaints.handle': ['ketua_rt', 'pengurus'],
  'activities.manage': ['ketua_rt', 'sekretaris', 'pengurus'],
  'security.view': ['ketua_rt', 'sekretaris', 'pengurus'],
  'security.manage': ['ketua_rt', 'pengurus'],
  'reports.view': ['ketua_rt', 'sekretaris', 'bendahara', 'pengurus'],
  'reports.finance': ['ketua_rt', 'bendahara'],
  'reports.residents': ['ketua_rt', 'sekretaris'],
  'users.manage': ['ketua_rt'],
  'settings.rt': ['ketua_rt'],
  'audit.view': ['ketua_rt'],
  'audit.finance': ['ketua_rt', 'bendahara'],
};

export const can = (role: Role | undefined | null, action: Action) => !!role && M[action].includes(role);

export const ROLE_LABEL: Record<Role, string> = {
  ketua_rt: 'Ketua RT',
  sekretaris: 'Sekretaris',
  bendahara: 'Bendahara',
  pengurus: 'Pengurus',
  warga: 'Warga',
};

/** "Ketua RT 001", "Bendahara RT 001", ... tanpa pengulangan "RT RT". */
export const roleWithRt = (role: Role, rt: string) => (role === 'ketua_rt' ? `Ketua RT ${rt}` : role === 'warga' ? `Warga RT ${rt}` : `${ROLE_LABEL[role]} RT ${rt}`);

export const ROLE_DESC: Record<Role, string> = {
  ketua_rt: 'Persetujuan final surat, kelola role & seluruh modul',
  sekretaris: 'Data warga, administrasi, pemeriksaan surat',
  bendahara: 'Tagihan, verifikasi pembayaran, buku kas',
  pengurus: 'Kegiatan, keamanan, tindak lanjut pengaduan',
  warga: 'Layanan surat, tagihan keluarga, pengaduan',
};
