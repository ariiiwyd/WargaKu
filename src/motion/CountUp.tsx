import { useRef } from 'react';
import { gsap, useGSAP, reducedMotion, EASE } from './gsap';

type Props = { value: number; format?: (n: number) => string; duration?: number; delay?: number; from?: number; className?: string };
const defaultFormat = (n: number) => Math.round(n).toLocaleString('id-ID');

/** Angka berjalan; saat value berubah, bergerak dari nilai lama ke nilai baru. */
export function CountUp({ value, format = defaultFormat, duration = 1.3, delay = 0, from = 0, className }: Props) {
  const el = useRef<HTMLSpanElement>(null);
  const current = useRef({ v: from });
  const tween = useRef<gsap.core.Tween | null>(null);

  useGSAP(
    () => {
      const node = el.current;
      if (!node) return;
      tween.current?.kill();
      const obj = current.current;
      if (reducedMotion()) {
        obj.v = value;
        node.textContent = format(value);
        return;
      }
      node.textContent = format(obj.v);
      tween.current = gsap.to(obj, {
        v: value,
        duration,
        delay,
        ease: EASE.out,
        onUpdate: () => {
          node.textContent = format(obj.v);
        },
      });
    },
    { dependencies: [value] },
  );

  return (
    <span className={className}>
      <span className="sr-only">{format(value)}</span>
      <span aria-hidden="true" ref={el} />
    </span>
  );
}
