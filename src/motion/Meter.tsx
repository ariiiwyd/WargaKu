import { useRef } from 'react';
import { gsap, useGSAP, reducedMotion, EASE } from './gsap';

type Props = { value: number; delay?: number; className?: string; fillClassName?: string; color?: string; label?: string };

/** Progress bar 0..1 yang memanjang saat muncul dan bergerak halus saat nilainya berubah. */
export function Meter({ value, delay = 0, className = 'h-1.5 bg-panel-2', fillClassName = '', color, label }: Props) {
  const fill = useRef<HTMLSpanElement>(null);
  const first = useRef(true);
  const v = Math.max(0, Math.min(1, value));

  useGSAP(
    () => {
      if (!fill.current) return;
      if (reducedMotion()) {
        gsap.set(fill.current, { scaleX: v });
      } else if (first.current) {
        gsap.fromTo(fill.current, { scaleX: 0 }, { scaleX: v, duration: 1.1, delay, ease: EASE.out, onStart: () => void (first.current = false) });
        return;
      } else {
        gsap.to(fill.current, { scaleX: v, duration: 0.8, ease: EASE.inOut, overwrite: 'auto' });
      }
      first.current = false;
    },
    { dependencies: [v] },
  );

  return (
    <span
      className={`block overflow-hidden rounded-full ${className}`}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      aria-label={label}
    >
      <span ref={fill} className={`block h-full origin-left rounded-full ${fillClassName}`} style={{ background: color ?? 'var(--accent)', transform: 'scaleX(0)' }} />
    </span>
  );
}
