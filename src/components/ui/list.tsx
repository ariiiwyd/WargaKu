import { useMemo, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { cx } from './primitives';

/** Pencarian + pagination sederhana untuk daftar di sisi klien. */
export function useList<T>(items: T[], opts: { search: (item: T) => string; pageSize?: number }) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const size = opts.pageSize ?? 10;
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? items.filter((i) => opts.search(i).toLowerCase().includes(s)) : items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, q]);
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const current = Math.min(page, pages);
  const rows = filtered.slice((current - 1) * size, current * size);
  return {
    q,
    setQ: (v: string) => (setQ(v), setPage(1)),
    page: current,
    pages,
    setPage,
    rows,
    total: filtered.length,
    from: filtered.length ? (current - 1) * size + 1 : 0,
    to: Math.min(current * size, filtered.length),
    resetPage: () => setPage(1),
  };
}

export function SearchInput({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder: string; className?: string }) {
  return (
    <label className={cx('relative flex h-11 min-w-0 items-center', className)}>
      <span className="sr-only">{placeholder}</span>
      <Search className="pointer-events-none absolute left-3.5 size-[18px] text-muted" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-full w-full rounded-xl border border-line bg-card pr-10 pl-10 text-[14.5px] text-ink outline-none placeholder:text-muted/80 focus:border-primary focus:ring-4 focus:ring-primary/15 [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button type="button" onClick={() => onChange('')} aria-label="Hapus pencarian" className="absolute right-2 grid size-7 place-items-center rounded-lg text-muted hover:bg-panel">
          <X className="size-4" />
        </button>
      ) : null}
    </label>
  );
}

export function Pagination({ page, pages, setPage, from, to, total, unit = 'data' }: { page: number; pages: number; setPage: (n: number) => void; from: number; to: number; total: number; unit?: string }) {
  if (!total) return null;
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-[13px] text-muted">
      <span>
        <b className="font-semibold text-ink">{from}–{to}</b> dari {total} {unit}
      </span>
      <div className="flex items-center gap-1">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Halaman sebelumnya" className="grid size-9 place-items-center rounded-lg border border-line bg-card text-ink-2 hover:bg-panel disabled:opacity-40">
          <ChevronLeft className="size-4" />
        </button>
        <span className="px-2 font-semibold text-ink">
          {page} / {pages}
        </span>
        <button disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label="Halaman berikutnya" className="grid size-9 place-items-center rounded-lg border border-line bg-card text-ink-2 hover:bg-panel disabled:opacity-40">
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div data-fade className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
      {children}
    </div>
  );
}

/** Tabel desktop yang otomatis menjadi kartu di layar kecil (kolom dengan `mobile: false` disembunyikan). */
export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cx('h-11 px-4 text-left text-[12px] font-semibold tracking-wide whitespace-nowrap text-muted uppercase first:pl-5 last:pr-5', className)}>{children}</th>;
}
export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cx('px-4 py-3 align-middle text-[14px] text-ink first:pl-5 last:pr-5', className)}>{children}</td>;
}
