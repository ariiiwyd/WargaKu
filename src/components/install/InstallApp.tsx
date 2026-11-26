import { useId, useState } from 'react';
import { CircleCheckBig, Download, EllipsisVertical, Globe, Share, SquarePlus, type LucideIcon } from 'lucide-react';
import { Modal, useToast } from '@/motion';
import { Button, IconButton, cx } from '@/components/ui/primitives';
import { DialogShell } from '@/components/ui/DialogShell';
import { LogoMark } from '@/components/ui/Logo';
import { useInstall, type InstallPlatform } from '@/stores/install.store';

/** Logika tombol "Pasang aplikasi": dialog bawaan bila tersedia, kalau tidak tampilkan panduan. */
function useInstallAction() {
  const { prompt, standalone, installed } = useInstall();
  const toast = useToast();
  const [guide, setGuide] = useState(false);
  const run = async () => {
    const r = await prompt();
    if (r === 'accepted') toast('WargaKu dipasang di layar utama');
    else if (r === 'unavailable') setGuide(true);
  };
  return { run, guide, setGuide, hidden: standalone || installed };
}

/** Kartu ajakan pasang (halaman masuk & beranda). */
export function InstallCard({ className }: { className?: string }) {
  const { run, guide, setGuide, hidden } = useInstallAction();
  if (hidden) return null;
  return (
    <>
      <div className={cx('flex items-center gap-3 rounded-2xl border border-line bg-card p-3.5 shadow-sm', className)}>
        <LogoMark className="size-11 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold text-ink">Pasang WargaKu di HP</p>
          <p className="text-[12.5px] text-muted">Buka lebih cepat dari layar utama, seperti aplikasi.</p>
        </div>
        <Button size="sm" icon={Download} onClick={run}>Pasang</Button>
      </div>
      <InstallGuide open={guide} onClose={() => setGuide(false)} />
    </>
  );
}

/** Tombol ikon di bilah atas. */
export function InstallIconButton() {
  const { run, guide, setGuide, hidden } = useInstallAction();
  if (hidden) return null;
  return (
    <>
      <IconButton icon={Download} label="Pasang aplikasi" onClick={run} />
      <InstallGuide open={guide} onClose={() => setGuide(false)} />
    </>
  );
}

/** Tombol penuh (menu Lainnya & Pengaturan). */
export function InstallButton({ className }: { className?: string }) {
  const { run, guide, setGuide, hidden } = useInstallAction();
  if (hidden) {
    return (
      <p className={cx('inline-flex items-center gap-2 text-[13px] font-semibold text-success-ink', className)}>
        <CircleCheckBig className="size-4" /> WargaKu sudah terpasang di perangkat ini
      </p>
    );
  }
  return (
    <>
      <Button variant="secondary" icon={Download} onClick={run} className={className}>Pasang aplikasi</Button>
      <InstallGuide open={guide} onClose={() => setGuide(false)} />
    </>
  );
}

const STEPS: Record<InstallPlatform, { title: string; steps: [LucideIcon, string][]; note?: string }> = {
  android: {
    title: 'Pasang di Android',
    steps: [
      [Globe, 'Pastikan halaman ini dibuka di Google Chrome.'],
      [EllipsisVertical, 'Ketuk menu ⋮ di pojok kanan atas.'],
      [SquarePlus, 'Pilih "Instal aplikasi" atau "Tambahkan ke layar utama", lalu ketuk Instal.'],
    ],
    note: 'Kalau pilihan itu tidak ada, muat ulang halaman sekali lalu coba lagi.',
  },
  ios: {
    title: 'Pasang di iPhone',
    steps: [
      [Globe, 'Buka halaman ini di Safari.'],
      [Share, 'Ketuk tombol Bagikan (kotak dengan panah ke atas) di bawah layar.'],
      [SquarePlus, 'Pilih "Tambah ke Layar Utama", lalu ketuk Tambah.'],
    ],
  },
  inapp: {
    title: 'Buka di browser dulu',
    steps: [
      [EllipsisVertical, 'Halaman ini sedang dibuka di dalam aplikasi lain (mis. Facebook atau Instagram). Ketuk menu ⋮ atau ··· di pojok kanan atas.'],
      [Globe, 'Pilih "Buka di Chrome" (Android) atau "Buka di Safari" (iPhone).'],
      [Download, 'Setelah terbuka di browser, ketuk lagi tombol Pasang aplikasi di WargaKu.'],
    ],
  },
  desktop: {
    title: 'Pasang di komputer',
    steps: [
      [Globe, 'Gunakan Google Chrome atau Microsoft Edge.'],
      [Download, 'Klik ikon pasang di ujung kanan kolom alamat, atau menu ⋮ → "Instal WargaKu".'],
    ],
  },
};

export function InstallGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const id = useId();
  const platform = useInstall((s) => s.platform);
  const g = STEPS[platform];
  return (
    <Modal open={open} onClose={onClose} labelledBy={id}>
      <DialogShell id={id} title={g.title} sub="Cukup sekali. Setelah itu WargaKu ada di layar utama HP Anda." icon={Download} onClose={onClose}
        footer={<Button onClick={onClose}>Mengerti</Button>}>
        <ol className="space-y-3">
          {g.steps.map(([Icon, text], i) => (
            <li key={i} className="flex items-start gap-3" data-field>
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                <Icon className="size-[18px]" />
              </span>
              <p className="pt-1.5 text-[14px] leading-relaxed text-ink-2"><b className="text-ink">{i + 1}.</b> {text}</p>
            </li>
          ))}
        </ol>
        {g.note ? <p className="mt-4 rounded-xl bg-panel px-3.5 py-2.5 text-[12.5px] text-muted" data-field>{g.note}</p> : null}
      </DialogShell>
    </Modal>
  );
}
