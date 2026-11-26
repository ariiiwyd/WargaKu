import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { gsap, reducedMotion, EASE } from './gsap';

type Props = { open: boolean; onClose: () => void; label: string; children: ReactNode; wide?: boolean };

/** Drawer dari kanan + scrim. Simpan data yang ditampilkan terpisah dari `open` agar isi tidak hilang saat menutup. */
export function Sheet({ open, onClose, label, children, wide }: Props) {
  const [mounted, setMounted] = useState(open);
  const panel = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  if (open && !mounted) setMounted(true);

  useLayoutEffect(() => {
    if (!mounted || !panel.current || !scrim.current) return;
    const fast = reducedMotion();
    if (open) {
      gsap.fromTo(scrim.current, { opacity: 0 }, { opacity: 1, duration: fast ? 0 : 0.3 });
      gsap.fromTo(panel.current, { xPercent: 104 }, { xPercent: 0, duration: fast ? 0 : 0.55, ease: EASE.out });
      const items = panel.current.querySelectorAll('[data-sheet-item]');
      if (items.length)
        gsap.fromTo(
          items,
          { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: fast ? 0 : 0.45, stagger: fast ? 0 : 0.05, delay: fast ? 0 : 0.15, clearProps: 'transform,opacity' },
        );
      panel.current.focus();
    } else {
      gsap.to(scrim.current, { opacity: 0, duration: fast ? 0 : 0.25 });
      gsap.to(panel.current, { xPercent: 104, duration: fast ? 0 : 0.35, ease: EASE.in, onComplete: () => setMounted(false) });
    }
  }, [open, mounted]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!mounted) return null;
  return createPortal(
    <>
      <div ref={scrim} className="fixed inset-0 z-[54] bg-scrim" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={`fixed top-2 right-2 bottom-2 z-[55] flex w-[calc(100vw-16px)] flex-col overflow-hidden rounded-[20px] border border-line bg-card text-ink shadow-lg outline-none sm:top-3 sm:right-3 sm:bottom-3 ${wide ? 'sm:w-[560px]' : 'sm:w-[440px]'}`}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}
