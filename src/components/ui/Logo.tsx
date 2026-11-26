import { useId } from 'react';

/** Ikon WargaKu: atap rumah + keluarga + daun hijau di atas ubin biru (digambar ulang dari brand sheet). */
export function LogoMark({ className = 'size-10' }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="WargaKu">
      <defs>
        <linearGradient id={`t${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3B82F6" />
          <stop offset="1" stopColor="#1D4ED8" />
        </linearGradient>
        <linearGradient id={`l${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#34D399" />
          <stop offset="1" stopColor="#10B981" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#t${id})`} />
      <path d="M2 6 Q32 -2 62 6 V2 Q32 -6 2 2Z" fill="#fff" opacity=".08" />
      <path d="M41.5 21.5V14.5h5.5v11.5" fill="#fff" />
      <path d="M11 32 32 14.5 53 32" fill="none" stroke="#fff" strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16.5 30v16M47.5 30v16" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
      <circle cx="32" cy="29.5" r="4.6" fill="#fff" />
      <path d="M24.6 47.5c0-5.6 3.3-9.6 7.4-9.6s7.4 4 7.4 9.6z" fill="#fff" />
      <circle cx="23.6" cy="34.2" r="3.4" fill="#fff" />
      <path d="M18.2 48c0-4.2 2.4-7.3 5.4-7.3s5.4 3.1 5.4 7.3z" fill="#fff" />
      <circle cx="40.4" cy="34.2" r="3.4" fill="#fff" />
      <path d="M35 48c0-4.2 2.4-7.3 5.4-7.3s5.4 3.1 5.4 7.3z" fill="#fff" />
      <path d="M12.5 51.5c9-4.2 22-5.8 39.5-10.5-4.6 8.4-17.6 13.6-39.5 10.5z" fill={`url(#l${id})`} />
    </svg>
  );
}

export function Wordmark({ className = '', onDark = false }: { className?: string; onDark?: boolean }) {
  return (
    <span className={`font-extrabold tracking-[-0.03em] ${className}`}>
      <span className={onDark ? 'text-white' : 'text-ink'}>Warga</span>
      <span className={onDark ? 'text-[#60A5FA]' : 'text-primary'}>Ku</span>
    </span>
  );
}
