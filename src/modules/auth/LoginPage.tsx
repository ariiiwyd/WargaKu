import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Navigate } from 'react-router';
import { BadgeCheck, CircleCheckBig, Eye, EyeOff, HandHeart, MailCheck, ShieldCheck, TriangleAlert, Users, Zap } from 'lucide-react';
import { usePageEnter, SplitTitle } from '@/motion';
import { LogoMark, Wordmark } from '@/components/ui/Logo';
import { NeighborhoodScene } from '@/components/ui/Scene';
import { Button, Field, Input } from '@/components/ui/primitives';
import { ThemeMenu } from '@/components/layouts/AppLayout';
import { useAuth } from '@/stores/auth.store';
import { InstallCard } from '@/components/install/InstallApp';

const VALUES = [
  { icon: HandHeart, label: 'Rukun & Peduli' },
  { icon: Zap, label: 'Mudah & Cepat' },
  { icon: ShieldCheck, label: 'Aman & Terpercaya' },
  { icon: Users, label: 'Bersama Lebih Baik' },
];

/** Kerangka halaman autentikasi: panel brand (desktop) + kolom form. */
export function AuthShell({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  usePageEnter(ref);
  return (
    <div ref={ref} className="grid min-h-dvh bg-bg lg:grid-cols-[1.05fr_1fr]">
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

      <section className="flex flex-col px-4 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 lg:invisible">
            <LogoMark className="size-10" />
            <Wordmark className="text-[22px]" />
          </div>
          <ThemeMenu />
        </div>
        <div className="mx-auto my-auto w-full max-w-[420px] py-10">{children}</div>
        <p className="text-center text-xs text-muted">© {new Date().getFullYear()} WargaKu · Satu Aplikasi, Semua Urusan Warga.</p>
      </section>
    </div>
  );
}

export function Notice({ tone, children }: { tone: 'warn' | 'success' | 'danger'; children: ReactNode }) {
  const t = {
    warn: ['border-warn/40 bg-warn-soft text-warn-ink', TriangleAlert],
    success: ['border-success/40 bg-success-soft text-success-ink', CircleCheckBig],
    danger: ['border-danger/30 bg-danger-soft text-danger-ink', TriangleAlert],
  } as const;
  const [cls, Icon] = t[tone];
  return (
    <div data-fade role={tone === 'danger' ? 'alert' : 'status'} className={`flex gap-2.5 rounded-2xl border px-4 py-3 text-[13.5px] leading-relaxed ${cls}`}>
      <Icon className="mt-0.5 size-[18px] shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={show ? 'text' : 'password'} className="pr-12" />
      <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'} className="absolute top-1/2 right-1.5 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-panel hover:text-ink">
        {show ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
      </button>
    </div>
  );
}

export function LoginPage() {
  const status = useAuth((s) => s.status);
  const recovery = useAuth((s) => s.recovery);
  const signIn = useAuth((s) => s.signIn);
  const sendReset = useAuth((s) => s.sendReset);
  const [mode, setMode] = useState<'login' | 'forgot' | 'sent'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (recovery) return <Navigate to="/atur-sandi" replace />;
  if (status === 'signedIn') return <Navigate to="/" replace />;
  const unconfigured = status === 'unconfigured';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return setError('Masukkan email Anda.');
    if (mode === 'login' && !password) return setError('Masukkan kata sandi.');
    setBusy(true);
    const err = mode === 'login' ? await signIn(email, password) : await sendReset(email);
    setBusy(false);
    if (err) return setError(err);
    if (mode === 'forgot') setMode('sent');
  };

  return (
    <AuthShell>
      {mode === 'sent' ? (
        <>
          <span data-fade className="grid size-14 place-items-center rounded-2xl bg-success-soft text-success-ink">
            <MailCheck className="size-7" />
          </span>
          <SplitTitle text="Cek email Anda" className="mt-5 text-[30px] font-extrabold text-ink" />
          <p data-fade className="mt-2 text-[15px] text-muted">
            Jika <b className="text-ink">{email}</b> terdaftar, tautan untuk membuat kata sandi baru sudah dikirim. Buka tautan itu dari perangkat ini.
          </p>
          <Button variant="secondary" size="lg" className="mt-7 w-full" onClick={() => (setMode('login'), setPassword(''))}>
            Kembali ke halaman masuk
          </Button>
        </>
      ) : (
        <>
          <SplitTitle text={mode === 'login' ? 'Masuk ke WargaKu' : 'Lupa kata sandi'} className="text-[30px] font-extrabold text-ink" />
          <p data-fade className="mt-2 text-[15px] text-muted">
            {mode === 'login' ? 'Gunakan email dan kata sandi akun yang diberikan pengurus RT.' : 'Masukkan email akun Anda. Kami kirimkan tautan untuk membuat kata sandi baru.'}
          </p>

          {unconfigured ? (
            <div className="mt-6">
              <Notice tone="warn">
                <b>Aplikasi belum terhubung ke server.</b> Pengelola perlu mengisi <code className="font-mono text-[12.5px]">VITE_SUPABASE_URL</code> dan{' '}
                <code className="font-mono text-[12.5px]">VITE_SUPABASE_ANON_KEY</code>, lalu memasang ulang aplikasi.
              </Notice>
            </div>
          ) : null}

          <form onSubmit={submit} className="mt-7 flex flex-col gap-4" data-fade noValidate>
            <Field label="Email" htmlFor="email">
              <Input id="email" type="email" inputMode="email" autoComplete="username" autoFocus value={email} disabled={unconfigured}
                onChange={(e) => (setEmail(e.target.value), setError(''))} placeholder="nama@email.com" aria-invalid={!!error} />
            </Field>
            {mode === 'login' ? (
              <Field label="Kata sandi" htmlFor="pw">
                <PasswordInput id="pw" autoComplete="current-password" value={password} disabled={unconfigured}
                  onChange={(e) => (setPassword(e.target.value), setError(''))} aria-invalid={!!error} />
              </Field>
            ) : null}
            {error ? <Notice tone="danger">{error}</Notice> : null}
            <Button type="submit" size="lg" className="mt-1 w-full" loading={busy} disabled={unconfigured}>
              {mode === 'login' ? 'Masuk' : 'Kirim tautan reset'}
            </Button>
            <button type="button" onClick={() => (setMode(mode === 'login' ? 'forgot' : 'login'), setError(''))} className="mx-auto text-[13.5px] font-semibold text-primary hover:underline">
              {mode === 'login' ? 'Lupa kata sandi?' : 'Kembali ke halaman masuk'}
            </button>
          </form>

          <p data-fade className="mt-8 rounded-2xl bg-panel px-4 py-3 text-center text-[13px] text-muted">
            Belum punya akun? Hubungi Ketua RT — akun warga dibuat dan diundang oleh pengurus.
          </p>
          <div data-fade className="mt-4">
            <InstallCard />
          </div>
        </>
      )}
    </AuthShell>
  );
}
