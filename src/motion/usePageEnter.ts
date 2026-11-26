import type { RefObject } from 'react';
import { gsap, useGSAP, routeState, dur, EASE } from './gsap';

/** [data-ch] huruf judul · [data-fade] teks kepala · [data-card] kartu · [data-row] baris list */
export function usePageEnter(scope: RefObject<HTMLElement | null>) {
  useGSAP(
    () => {
      const switching = routeState.switching;
      const sel = gsap.utils.selector(scope);
      const tl = gsap.timeline();
      const add = (s: string, from: gsap.TweenVars, to: gsap.TweenVars, at: number) => {
        const els = sel(s);
        if (els.length) tl.fromTo(els, from, to, at);
      };
      add('[data-ch]', { yPercent: 115 }, { yPercent: 0, duration: dur(0.85), ease: EASE.title, stagger: dur(0.022), clearProps: 'transform' }, 0);
      add('[data-fade]', { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: dur(0.5), stagger: dur(0.05), clearProps: 'transform,opacity' }, 0.08);
      add(
        '[data-card]',
        { opacity: 0, y: switching ? 16 : 36, scale: 0.985 },
        { opacity: 1, y: 0, scale: 1, duration: dur(switching ? 0.5 : 0.85), stagger: dur(switching ? 0.035 : 0.07), clearProps: 'transform,opacity' },
        0.1,
      );
      add('[data-row]', { opacity: 0, x: 14 }, { opacity: 1, x: 0, duration: dur(0.55), stagger: dur(0.04), clearProps: 'transform,opacity' }, 0.45);
    },
    { scope },
  );
}
