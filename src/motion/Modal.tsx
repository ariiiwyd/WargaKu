import { useEffect, useRef, useState, type ReactNode } from 'react';
import { gsap, reducedMotion, EASE } from './gsap';

type Props = { open: boolean; onClose: () => void; labelledBy?: string; wide?: boolean; children: ReactNode };

/** <dialog> bawaan + masuk/keluar beranimasi; isi [data-field] muncul bertahap. */
export function Modal({ open, onClose, labelledBy, wide, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [render, setRender] = useState(open);
  if (open && !render) setRender(true);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      if (reducedMotion()) return;
      gsap.fromTo(d, { opacity: 0, y: 14, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: 0.35, ease: EASE.out });
      gsap.fromTo(
        d.querySelectorAll('[data-field]'),
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.4, stagger: 0.04, delay: 0.06, ease: EASE.out, clearProps: 'transform,opacity' },
      );
    } else if (!open && d.open) {
      const finish = () => {
        d.close();
        gsap.set(d, { clearProps: 'opacity,transform' });
        setRender(false);
      };
      if (reducedMotion()) return finish();
      gsap.to(d, { opacity: 0, y: 8, scale: 0.98, duration: 0.2, ease: EASE.in, onComplete: finish });
    }
  }, [open, render]);

  return (
    <dialog
      ref={ref}
      className={`dlg ${wide ? 'dlg-wide' : ''}`}
      aria-labelledby={labelledBy}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {render ? children : null}
    </dialog>
  );
}
