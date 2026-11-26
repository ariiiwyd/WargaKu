import type { ReactNode } from 'react';
import { createBrowserRouter, Link } from 'react-router';
import { Lock, MapPinOff } from 'lucide-react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { LoginPage } from '@/modules/auth/LoginPage';
import { DashboardPage } from '@/modules/dashboard/DashboardPage';
import { ResidentsPage } from '@/modules/residents/ResidentsPage';
import { HouseholdsPage } from '@/modules/households/HouseholdsPage';
import { LettersPage } from '@/modules/letters/LettersPage';
import { DuesPage } from '@/modules/dues/DuesPage';
import { AnnouncementsPage } from '@/modules/announcements/AnnouncementsPage';
import { ComplaintsPage } from '@/modules/complaints/ComplaintsPage';
import { ActivitiesPage } from '@/modules/activities/ActivitiesPage';
import { SecurityPage } from '@/modules/security/SecurityPage';
import { ReportsPage } from '@/modules/reports/ReportsPage';
import { UsersPage } from '@/modules/users/UsersPage';
import { SettingsPage } from '@/modules/settings/SettingsPage';
import { NotificationsPage } from '@/modules/notifications/NotificationsPage';
import { EmptyState, Button } from '@/components/ui/primitives';
import { useMe } from '@/hooks/useData';
import { can, type Action } from './permissions';

/** Penjaga rute: menu tersembunyi saja tidak cukup (PRD §2.2). */
function Guard({ need, children }: { need?: Action; children: ReactNode }) {
  const me = useMe();
  if (need && !can(me?.role, need))
    return (
      <EmptyState
        icon={Lock}
        title="Anda tidak memiliki akses ke halaman ini"
        text="Halaman ini hanya untuk pengurus dengan peran tertentu. Hubungi Ketua RT bila Anda memerlukan akses."
        action={
          <Link to="/">
            <Button variant="secondary">Kembali ke beranda</Button>
          </Link>
        }
      />
    );
  return <>{children}</>;
}

function NotFound() {
  return (
    <EmptyState
      icon={MapPinOff}
      title="Halaman tidak ditemukan"
      text="Alamat yang Anda buka tidak ada atau sudah dipindahkan."
      action={
        <Link to="/">
          <Button>Ke beranda</Button>
        </Link>
      }
    />
  );
}

export const router = createBrowserRouter([
  { path: '/masuk', element: <LoginPage /> },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'warga', element: <Guard need="residents.view"><ResidentsPage /></Guard> },
      { path: 'keluarga', element: <HouseholdsPage /> },
      { path: 'surat', element: <LettersPage /> },
      { path: 'iuran', element: <DuesPage /> },
      { path: 'pengumuman', element: <AnnouncementsPage /> },
      { path: 'pengaduan', element: <ComplaintsPage /> },
      { path: 'kegiatan', element: <ActivitiesPage /> },
      { path: 'keamanan', element: <Guard need="security.view"><SecurityPage /></Guard> },
      { path: 'laporan', element: <Guard need="reports.view"><ReportsPage /></Guard> },
      { path: 'pengguna', element: <Guard need="users.manage"><UsersPage /></Guard> },
      { path: 'pengaturan', element: <SettingsPage /> },
      { path: 'notifikasi', element: <NotificationsPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);
