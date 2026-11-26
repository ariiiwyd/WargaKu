import { useRef } from 'react';
import { useSlidingPill } from '@/motion';
import { cx } from './primitives';

type Tab<T extends string> = { value: T; label: string; count?: number };

/** Tab dengan pill yang meluncur (useSlidingPill). Bisa digulir horizontal di HP. */
export function Tabs<T extends string>({ tabs, value, onChange, className, label }: { tabs: Tab<T>[]; value: T; onChange: (v: T) => void; className?: string; label: string }) {
  const box = useRef<HTMLDivElement>(null);
  const pill = useSlidingPill(box, value);
  return (
    <div
      ref={box}
      role="tablist"
      aria-label={label}
      className={cx('no-scrollbar relative isolate flex max-w-full gap-1 overflow-x-auto rounded-[14px] border border-line bg-panel p-1', className)}
    >
      <span ref={pill} className="absolute top-0 left-0 -z-10 rounded-[10px] bg-card opacity-0 shadow-sm ring-1 ring-line" />
      {tabs.map((t) => {
        const on = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            aria-selected={on}
            data-active={on}
            onClick={() => onChange(t.value)}
            className={cx(
              'flex h-9 shrink-0 items-center gap-2 rounded-[10px] px-3.5 text-[13.5px] font-semibold whitespace-nowrap transition-colors',
              on ? 'text-ink' : 'text-muted hover:text-ink',
            )}
          >
            {t.label}
            {t.count !== undefined ? (
              <span className={cx('grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold', on ? 'bg-primary text-primary-ink' : 'bg-panel-2 text-ink-2')}>
                {t.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
