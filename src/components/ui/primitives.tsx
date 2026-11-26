import { forwardRef, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { LoaderCircle, type LucideIcon } from 'lucide-react';
import { initials } from '@/lib/format';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/* ------------------------------------------------------------ Button */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'soft';
type Size = 'sm' | 'md' | 'lg';
const V: Record<Variant, string> = {
  primary: 'bg-primary text-primary-ink hover:bg-primary-hover shadow-[0_6px_16px_-8px_var(--primary)]',
  secondary: 'bg-card text-ink border border-line hover:border-line-strong hover:bg-panel',
  ghost: 'text-ink-2 hover:bg-panel hover:text-ink',
  danger: 'bg-danger text-white hover:brightness-110',
  success: 'bg-success text-white hover:brightness-105 shadow-[0_6px_16px_-8px_var(--success)]',
  soft: 'bg-primary-soft text-primary-soft-ink hover:brightness-[.97]',
};
const S: Record<Size, string> = {
  sm: 'h-9 px-3 text-[13px] gap-1.5 rounded-[10px]',
  md: 'h-11 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-5 text-[15px] gap-2 rounded-xl',
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; icon?: LucideIcon; loading?: boolean }>(
  function Button({ variant = 'primary', size = 'md', icon: Icon, loading, className, children, disabled, ...rest }, ref) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cx(
          'inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition-[background,color,border-color,filter,transform] duration-200 select-none active:scale-[.98] disabled:pointer-events-none disabled:opacity-50',
          V[variant],
          S[size],
          className,
        )}
        {...rest}
      >
        {loading ? <LoaderCircle className="size-4 animate-spin" /> : Icon ? <Icon className={size === 'sm' ? 'size-4' : 'size-[18px]'} strokeWidth={2.2} /> : null}
        {children}
      </button>
    );
  },
);

export function IconButton({ icon: Icon, label, className, badge, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string; badge?: number }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cx('relative inline-flex size-10 items-center justify-center rounded-xl text-ink-2 transition-colors hover:bg-panel hover:text-ink', className)}
      {...rest}
    >
      <Icon className="size-5" strokeWidth={2} />
      {badge ? (
        <span className="absolute top-1 right-1 grid min-w-[18px] place-items-center rounded-full bg-danger px-1 text-[10px] leading-[18px] font-bold text-white ring-2 ring-card">
          {badge > 9 ? '9+' : badge}
        </span>
      ) : null}
    </button>
  );
}

/* ------------------------------------------------------------ Card */
export function Card({ className, children, as: Tag = 'section', ...rest }: { className?: string; children: ReactNode; as?: 'section' | 'div' | 'article' } & Record<string, unknown>) {
  return (
    <Tag className={cx('rounded-[18px] border border-line bg-card shadow-sm', className)} {...rest}>
      {children}
    </Tag>
  );
}

export function CardHeader({ title, action, sub, icon: Icon }: { title: string; action?: ReactNode; sub?: string; icon?: LucideIcon }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon ? (
          <span className="grid size-8 place-items-center rounded-lg bg-primary-soft text-primary-soft-ink">
            <Icon className="size-4" strokeWidth={2.2} />
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-bold text-ink">{title}</h2>
          {sub ? <p className="truncate text-xs text-muted">{sub}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------ Badge */
export type Tone = 'blue' | 'green' | 'orange' | 'red' | 'gray' | 'violet' | 'navy';
const T: Record<Tone, string> = {
  blue: 'bg-primary-soft text-primary-soft-ink',
  green: 'bg-success-soft text-success-ink',
  orange: 'bg-warn-soft text-warn-ink',
  red: 'bg-danger-soft text-danger-ink',
  gray: 'bg-panel-2 text-ink-2',
  violet: 'bg-violet-soft text-violet-ink',
  navy: 'bg-ink text-card',
};
export function Badge({ tone = 'gray', children, dot, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={cx('inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[11.5px] font-semibold whitespace-nowrap', T[tone], className)}>
      {dot ? <span className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------ Form fields */
const fieldBase =
  'w-full rounded-xl border border-line bg-card px-3.5 text-[14.5px] text-ink placeholder:text-muted/80 transition-[border-color,box-shadow] outline-none focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:bg-panel disabled:text-muted aria-[invalid=true]:border-danger';

export function Field({ label, hint, error, children, htmlFor, required, className }: { label: string; hint?: string; error?: string; children: ReactNode; htmlFor?: string; required?: boolean; className?: string }) {
  return (
    <div className={cx('flex flex-col gap-1.5', className)} data-field>
      <label htmlFor={htmlFor} className="text-[13px] font-semibold text-ink-2">
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </label>
      {children}
      {error ? <p className="text-xs font-medium text-danger-ink">{error}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx(fieldBase, 'h-11', className)} {...rest} />;
});
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cx(fieldBase, 'min-h-[104px] resize-y py-3 leading-relaxed', className)} {...rest} />;
});
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <select
      ref={ref}
      className={cx(
        fieldBase,
        "h-11 appearance-none bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%235b6b82' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m4 6 4 4 4-4'/%3E%3C/svg%3E\")] bg-[right_12px_center] bg-no-repeat pr-10",
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
});

export function useFieldId() {
  return useId();
}

/* ------------------------------------------------------------ Avatar */
const AV = ['#2563EB', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#0EA5E9', '#EF4444', '#14B8A6'];
export function Avatar({ name, size = 36, className }: { name: string; size?: number; className?: string }) {
  const c = AV[[...name].reduce((s, ch) => s + ch.charCodeAt(0), 0) % AV.length];
  return (
    <span
      aria-hidden="true"
      className={cx('inline-grid shrink-0 place-items-center rounded-full font-bold text-white', className)}
      style={{ width: size, height: size, background: c, fontSize: size * 0.36 }}
    >
      {initials(name)}
    </span>
  );
}

/* ------------------------------------------------------------ States */
export function EmptyState({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="relative mb-4 grid size-16 place-items-center">
        <span className="absolute inset-0 rotate-6 rounded-[20px] bg-primary-soft" />
        <span className="absolute inset-0 grid place-items-center rounded-[20px] border border-line bg-card shadow-sm">
          <Icon className="size-7 text-primary" strokeWidth={1.8} />
        </span>
      </span>
      <p className="text-[15px] font-bold text-ink">{title}</p>
      {text ? <p className="mt-1 max-w-sm text-sm text-muted">{text}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('skeleton', className)} />;
}

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle className={cx('size-5 animate-spin text-primary', className)} />;
}

/* ------------------------------------------------------------ Definition row */
export function Info({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx('min-w-0', className)}>
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold break-words text-ink">{children || '—'}</dd>
    </div>
  );
}

/* ------------------------------------------------------------ Segmented choice */
export function Choice<T extends string>({ value, onChange, options, name }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; icon?: LucideIcon }[]; name: string }) {
  return (
    <div role="radiogroup" aria-label={name} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cx(
              'flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition-colors',
              on ? 'border-primary bg-primary-soft text-primary-soft-ink' : 'border-line bg-card text-ink-2 hover:border-line-strong',
            )}
          >
            {o.icon ? <o.icon className="size-4" /> : null}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
