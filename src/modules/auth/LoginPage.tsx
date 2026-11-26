import { useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { ArrowRight, BadgeCheck, HandHeart, ShieldCheck, Users, Zap } from 'lucide-react';
import { usePageEnter, SplitTitle } from '@/motion';
import { LogoMark, Wordmark } from '@/components/ui/Logo';
import { NeighborhoodScene } from '@/components/ui/Scene';
import { Avatar, Button, Field, Input, cx } from '@/components/ui/primitives';
import { ThemeMenu } from '@/components/layouts/AppLayout';
import { useAuth } from '@/stores/auth.store';
import { useDatabase, useMe } from '@/hooks/useData';
import { ROLE_DESC, ROLE_LABEL } from '@/app/permissions';
import { isSupabaseConfigured } from '@/lib/supabase';

const VALUES = [
  { icon: HandHeart, label: 'Rukun & Peduli' },
  { icon: Zap, label: 'Mudah & Cepat' },
  { icon: ShieldCheck, label: 'Aman & Terpercaya' },
  { icon: Users, label: 'Bersama Lebih Baik' },
];

export function LoginPage() {
  const me = useMe();
  const db = useDatabase();
  const login = useAuth((s) => s.login);
  const nav = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  usePageEnter(ref);

  if (me) return <Navigate to="/" replace />;

  const accounts = db.memberships
    .map((m) => ({ m, p: db.profiles.find((p) => p.id === m.user_id)! }))
    .sort((a, b) => ['ketua_rt', 'sekretaris', 'bendahara', 'pengurus', 'warga'].indexOf(a.m.role) - ['ketua_rt', 'sekretaris', 'bendahara', 'pengurus', 'warga'].indexOf(b.m.role));

  const enter = (userId: string) => {
    login(userId);
    nav('/', { replace: true });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const acc = accounts.find((a) => a.p.email.toLowerCase() === email.trim().toLowerCase());
    if (!acc || password !== 'demo1234') return setError('Email atau kata sandi salah.');
    if (!acc.m.is_active) return setError('Akun ini sudah dinonaktifkan. Hubungi Ketua RT.');
    enter(acc.p.id);
  };

  return (
    <div ref={ref} className="grid min-h-dvh bg-bg lg:grid-cols-[1.05fr_1fr]">
      {/* Panel brand */}
      <section className="relative hidden overflow-hidden bg-[#1D4ED8] text-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
        <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_0%_0%,#3B82F6_0%,#2563EB_40%,#1D4ED8_70%,#1E3A8A_100%)]" />
        <div className="relative flex items-center gap-3 px-12 pt-12">
          <LogoMark className="size-12" />
          <Wordmark onDark className="text-[28px]" />
        </div>
        <div className="relative mt-auto px-12 pb-[170px]">
          <p data-fade className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-[12.5px] font-semibold ring-1 ring-white/20">
            <BadgeCheck className="size-4" /> Smart Neighborhood Management System
          </p>
          <SplitTitle text="Satu Aplikasi, Semua Urusan Warga." as="p" className="max-w-[15ch] text-[52px] leading-[1.02] font-extrabold tracking-[-0.035em]" />
          <p data-fade className="mt-5 max-w-md text-[16px] leading-relaxed text-white/80">
            Pusat pelayanan digital warga RT — dari administrasi dan surat, iuran dan kas, pengumuman, sampai pengaduan dan keamanan lingkungan.
          </p>
          <ul className="mt-8 grid max-w-md grid-cols-2 gap-2.5">
            {VALUES.map((v) => (
              <li key={v.label} data-card className="flex items-center gap-2.5 rounded-xl bg-white/10 px-3 py-2.5 text-[13.5px] font-semibold ring-1 ring-white/15">
                <v.icon className="size-[18px] text-[#A7F3D0]" />
                {v.label}
              </li>
            ))}
          </ul>
        </div>
        <NeighborhoodScene className="absolute inset-x-0 bottom-0 h-[150px] w-full" />
      </section>

      {/* Form */}
      <section className="flex flex-col px-4 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 lg:invisible">
            <LogoMark className="size-10" />
            <Wordmark className="text-[22px]" />
          </div>
          <ThemeMenu />
        </div>

        <div className="mx-auto my-auto w-full max-w-[460px] py-8">
          <SplitTitle text="Masuk ke WargaKu" className="text-[30px] font-extrabold text-ink" />
          <p data-fade className="mt-2 text-[15px] text-muted">
            {db.neighborhood.name} · RT {db.neighborhood.rt_number} / RW {db.neighborhood.rw_number}, {db.neighborhood.village}
          </p>

          <div data-fade className="mt-6 rounded-2xl border border-warn/40 bg-warn-soft px-4 py-3 text-[13px] leading-relaxed text-warn-ink">
            <b>Mode demo.</b> Data di aplikasi ini adalah contoh dan tersimpan di browser Anda.
            {isSupabaseConfigured ? ' Supabase terdeteksi di .env, tetapi layanan data belum disambungkan ke tampilan.' : ' Pilih akun di bawah untuk mencoba tiap peran.'}
          </div>

          <p data-fade className="mt-7 mb-2.5 text-[13px] font-semibold text-ink-2">
            Masuk cepat sebagai
          </p>
          <ul className="flex flex-col gap-2">
            {accounts
              .filter((a) => a.m.is_active)
              .slice(0, 5)
              .map(({ m, p }) => (
                <li key={p.id} data-card>
                  <button
                    onClick={() => enter(p.id)}
                    className="group card-lift flex w-full items-center gap-3 rounded-2xl border border-line bg-card px-3.5 py-3 text-left shadow-sm hover:border-primary/50"
                  >
                    <Avatar name={p.full_name} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[14.5px] font-bold text-ink">{p.full_name}</span>
                        <span className={cx('rounded-full px-2 py-0.5 text-[11px] font-bold', m.role === 'warga' ? 'bg-success-soft text-success-ink' : 'bg-primary-soft text-primary-soft-ink')}>
                          {ROLE_LABEL[m.role]}
                        </span>
                      </span>
                      <span className="block truncate text-[12.5px] text-muted">{ROLE_DESC[m.role]}</span>
                    </span>
                    <ArrowRight className="size-[18px] text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </button>
                </li>
              ))}
          </ul>

          <div data-fade className="my-7 flex items-center gap-3 text-xs font-medium text-muted">
            <span className="h-px flex-1 bg-line" /> atau dengan email <span className="h-px flex-1 bg-line" />
          </div>

          <form onSubmit={submit} className="flex flex-col gap-3.5" data-fade noValidate>
            <Field label="Email" htmlFor="email">
              <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => (setEmail(e.target.value), setError(''))} placeholder="nama@contoh.wargaku.id" aria-invalid={!!error} />
            </Field>
            <Field label="Kata sandi" htmlFor="pw" hint="Akun demo memakai kata sandi demo1234" error={error}>
              <Input id="pw" type="password" autoComplete="current-password" value={password} onChange={(e) => (setPassword(e.target.value), setError(''))} aria-invalid={!!error} />
            </Field>
            <Button type="submit" size="lg" className="mt-1 w-full">
              Masuk
            </Button>
          </form>
        </div>
        <p className="text-center text-xs text-muted">© {new Date().getFullYear()} WargaKu · Satu Aplikasi, Semua Urusan Warga.</p>
      </section>
    </div>
  );
}
