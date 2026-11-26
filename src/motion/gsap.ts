import gsap from 'gsap';
import { Flip } from 'gsap/Flip';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP, Flip);

/** Kurva gerak yang dipakai di seluruh app — konsistensi = terasa "satu produk". */
export const EASE = {
  out: 'power3.out',
  inOut: 'power3.inOut',
  in: 'power2.in',
  title: 'power4.out',
  pop: 'back.out(1.7)',
} as const;

gsap.defaults({ ease: EASE.out, duration: 0.6 });

const reduceQuery = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
const hoverQuery = typeof window !== 'undefined' ? window.matchMedia('(hover: hover) and (pointer: fine)') : null;

export const reducedMotion = () => !!reduceQuery?.matches;
export const canHover = () => !!hoverQuery?.matches;
export const dur = (seconds: number) => (reducedMotion() ? 0 : seconds);

/** Pertama dibuka (gerak lebih panjang) vs pindah halaman (lebih pendek). */
export const routeState = { switching: false };

export { gsap, Flip, useGSAP };
