import { useEffect, type RefObject } from 'react';
import { gsap, canHover, reducedMotion, EASE } from './gsap';

/** Elemen sedikit tertarik mengikuti kursor. Nonaktif di layar sentuh. */
export function useMagnetic(ref: RefObject<HTMLElement | null>, enabled = true, strength = { x: 0.25, y: 0.3 }) {
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el || !canHover() || reducedMotion()) return;
    const toX = gsap.quickTo(el, 'x', { duration: 0.5, ease: EASE.out });
    const toY = gsap.quickTo(el, 'y', { duration: 0.5, ease: EASE.out });
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      toX((e.clientX - r.left - r.width / 2) * strength.x);
      toY((e.clientY - r.top - r.height / 2) * strength.y);
    };
    const leave = () => {
      toX(0);
      toY(0);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    return () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
      gsap.set(el, { clearProps: 'transform' });
    };
  }, [ref, enabled, strength.x, strength.y]);
}
