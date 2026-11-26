import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { CircleAlert, CircleCheckBig } from 'lucide-react';
import { gsap, reducedMotion } from './gsap';

type Tone = 'success' | 'error';
const ToastCtx = createContext<(msg: string, tone?: Tone) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const el = useRef<HTMLDivElement>(null);
  const [msg, setMsg] = useState('');
  const [tone, setTone] = useState<Tone>('success');
  const show = useCallback((text: string, t: Tone = 'success') => {
    setMsg(text);
    setTone(t);
    const node = el.current;
    if (!node) return;
    gsap.killTweensOf(node);
    const fast = reducedMotion();
    gsap
      .timeline()
      .fromTo(node, { opacity: 0, y: 18, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: fast ? 0 : 0.45, ease: 'back.out(1.8)' })
      .to(node, { opacity: 0, y: 10, duration: fast ? 0 : 0.3, ease: 'power2.in' }, t === 'error' ? '+=4' : '+=2.4');
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div
        ref={el}
        role={tone === 'error' ? 'alert' : 'status'}
        aria-live={tone === 'error' ? 'assertive' : 'polite'}
        className="pointer-events-none fixed inset-x-0 bottom-[calc(92px+env(safe-area-inset-bottom))] z-[60] mx-auto flex w-fit max-w-[calc(100vw-32px)] items-center gap-2.5 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-card opacity-0 shadow-lg lg:bottom-6"
      >
        {tone === 'error' ? <CircleAlert className="size-4 shrink-0 text-danger" /> : <CircleCheckBig className="size-4 shrink-0 text-success" />}
        {msg}
      </div>
    </ToastCtx.Provider>
  );
}
