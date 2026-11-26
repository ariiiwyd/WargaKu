import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useOutlet } from 'react-router';
import { gsap, routeState, reducedMotion, EASE } from './gsap';

type Layer = { key: string; element: ReactNode; leaving: boolean };

/** Pengganti <Outlet/>: halaman lama memudar keluar 0,3 dtk di belakang halaman baru. */
export function RouteTransition() {
  const location = useLocation();
  const outlet = useOutlet();
  const key = location.pathname;
  const [layers, setLayers] = useState<Layer[]>([{ key, element: outlet, leaving: false }]);

  const top = layers[layers.length - 1]!;
  if (top.key !== key) {
    routeState.switching = true;
    setLayers([
      ...layers.filter((l) => l !== top && l.key !== key),
      { ...top, leaving: true },
      { key, element: outlet, leaving: false },
    ]);
  }

  useEffect(() => {
    if (routeState.switching) window.scrollTo({ top: 0 });
  }, [key]);

  return (
    <div className="relative">
      {layers.map((layer) => (
        <RouteLayer
          key={layer.key}
          leaving={layer.leaving}
          onDone={() => setLayers((all) => all.filter((l) => !(l.key === layer.key && l.leaving)))}
        >
          {layer.leaving ? layer.element : outlet}
        </RouteLayer>
      ))}
    </div>
  );
}

export function RouteLayer({ leaving, onDone, children }: { leaving: boolean; onDone: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const done = useRef(onDone);
  done.current = onDone;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!leaving || !el) return;
    if (reducedMotion()) {
      done.current();
      return;
    }
    const tween = gsap.to(el, { opacity: 0, y: -6, duration: 0.3, ease: EASE.in, onComplete: () => done.current() });
    return () => {
      tween.kill();
    };
  }, [leaving]);

  return (
    <div
      ref={ref}
      inert={leaving}
      aria-hidden={leaving || undefined}
      className={leaving ? 'pointer-events-none absolute inset-x-0 top-0 z-0' : 'relative z-[1]'}
    >
      {children}
    </div>
  );
}
