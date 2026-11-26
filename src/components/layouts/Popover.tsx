import { useEffect, useRef, useState, type ReactNode } from 'react';
import { gsap, reducedMotion } from '@/motion';
import { cx } from '@/components/ui/primitives';

/** Popover kecil (lonceng, tema, akun): masuk dengan back.out, tutup saat klik di luar/Escape. */
export function Popover({ trigger, children, className, align = 'right' }: { trigger: (p: { open: boolean; toggle: () => void }) => ReactNode; children: (close: () => void) => ReactNode; className?: string; align?: 'right' | 'left' }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const p = panel.current;
    if (p && !reducedMotion()) gsap.fromTo(p, { opacity: 0, y: -10, scale: 0.94 }, { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'back.out(1.6)' });
    const onDown = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={box} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open ? (
        <div
          ref={panel}
          className={cx(
            'absolute top-[calc(100%+8px)] z-50 origin-top-right rounded-2xl border border-line bg-card p-1.5 text-ink shadow-lg',
            align === 'right' ? 'right-0' : 'left-0 origin-top-left',
            className,
          )}
        >
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}
