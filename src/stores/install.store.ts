import { create } from 'zustand';

/** Event Chrome/Edge untuk memunculkan dialog "Instal aplikasi" (belum ada di lib.dom). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallPlatform = 'android' | 'ios' | 'inapp' | 'desktop';

interface InstallState {
  deferred: BeforeInstallPromptEvent | null;
  installed: boolean;
  standalone: boolean;
  platform: InstallPlatform;
  /** Munculkan dialog instal bawaan browser. Mengembalikan false bila browser tidak menyediakannya. */
  prompt: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
}

function detectPlatform(): InstallPlatform {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  // Browser bawaan aplikasi lain (Facebook, Instagram, LINE, TikTok, WebView Android) tidak bisa memasang PWA.
  if (/FBAN|FBAV|Instagram|Line\/|TikTok|Twitter|MicroMessenger|; wv\)/i.test(ua)) return 'inapp';
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

export const useInstall = create<InstallState>()((set, get) => ({
  deferred: null,
  installed: false,
  standalone: isStandalone(),
  platform: detectPlatform(),
  prompt: async () => {
    const e = get().deferred;
    if (!e) return 'unavailable';
    await e.prompt();
    const { outcome } = await e.userChoice;
    set({ deferred: null, installed: outcome === 'accepted' || get().installed });
    return outcome;
  },
}));

/** Dipanggil sekali di main.tsx sebelum render, agar event tidak terlewat. */
export function initInstallListeners() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // tampilkan lewat tombol "Pasang aplikasi" di WargaKu
    useInstall.setState({ deferred: e as BeforeInstallPromptEvent });
  });
  window.addEventListener('appinstalled', () => useInstall.setState({ installed: true, deferred: null }));
  window.matchMedia('(display-mode: standalone)').addEventListener('change', (m) => useInstall.setState({ standalone: m.matches }));
}
