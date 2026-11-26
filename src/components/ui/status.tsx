import type {
  ActivityStatus, AnnouncementStatus, ComplaintPriority, ComplaintStatus, InvoiceStatus, PaymentStatus, RequestStatus, ResidentStatus,
} from '@/types/models';
import { Badge, type Tone } from './primitives';

type Map<K extends string> = Record<K, [string, Tone]>;

export const REQUEST: Map<RequestStatus> = {
  submitted: ['Diajukan', 'blue'],
  review: ['Menunggu TTD Ketua', 'violet'],
  revision: ['Perlu perbaikan', 'orange'],
  approved: ['Disetujui', 'green'],
  completed: ['Selesai', 'green'],
  rejected: ['Ditolak', 'red'],
};
export const INVOICE: Map<InvoiceStatus> = {
  unpaid: ['Belum bayar', 'red'],
  partial: ['Sebagian', 'orange'],
  paid: ['Lunas', 'green'],
  cancelled: ['Dibatalkan', 'gray'],
};
export const PAYMENT: Map<PaymentStatus> = {
  pending: ['Menunggu verifikasi', 'orange'],
  verified: ['Terverifikasi', 'green'],
  rejected: ['Ditolak', 'red'],
};
export const COMPLAINT: Map<ComplaintStatus> = {
  submitted: ['Baru', 'blue'],
  assigned: ['Ditugaskan', 'violet'],
  in_progress: ['Diproses', 'orange'],
  resolved: ['Selesai', 'green'],
  closed: ['Ditutup', 'gray'],
};
export const PRIORITY: Map<ComplaintPriority> = {
  rendah: ['Rendah', 'gray'],
  normal: ['Normal', 'blue'],
  tinggi: ['Tinggi', 'orange'],
  darurat: ['Darurat', 'red'],
};
export const RESIDENT: Map<ResidentStatus> = {
  tetap: ['Tetap', 'green'],
  kontrak: ['Kontrak', 'blue'],
  pendatang: ['Pendatang', 'violet'],
  pindah: ['Pindah', 'gray'],
  meninggal: ['Meninggal', 'gray'],
};
export const ANNOUNCEMENT: Map<AnnouncementStatus> = {
  draft: ['Draft', 'orange'],
  published: ['Terbit', 'green'],
  archived: ['Arsip', 'gray'],
};
export const ACTIVITY: Map<ActivityStatus> = {
  planned: ['Akan datang', 'blue'],
  ongoing: ['Berlangsung', 'orange'],
  done: ['Selesai', 'green'],
  cancelled: ['Batal', 'gray'],
};

export function StatusBadge<K extends string>({ map, value }: { map: Map<K>; value: K }) {
  const [label, tone] = map[value];
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  );
}
