import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { gsap, reducedMotion, EASE } from './gsap';

/** Pill yang meluncur ke item [data-active="true"] dan sedikit memanjang di tengah jalan. */
export function useSlidingPill(container: RefObject<HTMLElement | null>, activeKey: unknown, stretch = 0.3) {
  const pill = useRef<HTMLSpanElement>(null);
  const first = useRef(true);

  const place = (animate: boolean) => {
    const box = container.current;
    const p = pill.current;
    if (!box || !p) return;
    const active = box.querySelector<HTMLElement>('[data-active="true"]');
    if (!active || !active.offsetWidth) {
      gsap.to(p, { opacity: 0, duration: 0.2 });
      return;
    }
    const x = active.offsetLeft,
      y = active.offsetTop,
      w = active.offsetWidth,
      h = active.offsetHeight;
    const visible = Number(gsap.getProperty(p, 'opacity')) > 0;
    if (!animate || !visible || reducedMotion()) {
      gsap.set(p, { x, y, width: w, height: h, opacity: 1 });
      return;
    }
    const fromX = Number(gsap.getProperty(p, 'x'));
    const fromY = Number(gsap.getProperty(p, 'y'));
    const fromW = p.offsetWidth;
    const extra = Math.abs(x - fromX) * stretch;
    gsap.to(p, { x, y, height: h, opacity: 1, duration: 0.55, ease: EASE.inOut, overwrite: 'auto' });
    if (Math.abs(y - fromY) < 2)
      gsap.to(p, { keyframes: { width: [fromW, Math.max(w, fromW) + extra, w] }, duration: 0.55, ease: 'power2.inOut', overwrite: 'auto' });
    else gsap.to(p, { width: w, duration: 0.55, ease: EASE.inOut });
    if (box.scrollWidth > box.clientWidth) box.scrollTo({ left: x - box.clientWidth / 2 + w / 2, behavior: 'smooth' });
  };

  useLayoutEffect(() => {
    place(!first.current);
    first.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]);

  useEffect(() => {
    const box = container.current;
    if (!box) return;
    const ro = new ResizeObserver(() => place(false));
    ro.observe(box);
    document.fonts?.ready.then(() => place(false));
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return pill;
}
