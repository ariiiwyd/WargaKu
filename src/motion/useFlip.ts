import { useLayoutEffect, useRef, type DependencyList, type RefObject } from 'react';
import { gsap, Flip, reducedMotion, EASE } from './gsap';

/** Panggil capture() tepat sebelum setState; item tersisa meluncur, item baru membesar masuk. */
export function useFlip(scope: RefObject<HTMLElement | null>, selector: string, deps: DependencyList) {
  const state = useRef<Flip.FlipState | null>(null);
  const capture = () => {
    if (!scope.current || reducedMotion()) return;
    state.current = Flip.getState(scope.current.querySelectorAll(selector));
  };
  useLayoutEffect(() => {
    const s = state.current;
    state.current = null;
    if (!s) return;
    Flip.from(s, {
      duration: 0.55,
      ease: EASE.inOut,
      targets: scope.current?.querySelectorAll(selector),
      onEnter: (els) => gsap.fromTo(els, { opacity: 0, scale: 0.92 }, { opacity: 1, scale: 1, duration: 0.45, ease: EASE.out }),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return capture;
}
