import { useRef, type ReactNode } from 'react';
import { SplitTitle, useMagnetic } from '@/motion';

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <SplitTitle text={title} className="text-[26px] leading-tight font-extrabold text-ink sm:text-[30px]" />
        {description ? (
          <p data-fade className="mt-1.5 max-w-2xl text-[14.5px] text-muted">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div data-fade className="flex flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  );
}

/** Pembungkus tombol aksi utama di kepala halaman — tertarik halus mengikuti kursor. */
export function Magnetic({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  useMagnetic(ref, true, { x: 0.18, y: 0.25 });
  return (
    <span ref={ref} className="inline-flex">
      {children}
    </span>
  );
}
