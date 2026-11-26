import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { KeyRound } from 'lucide-react';
import { SplitTitle } from '@/motion';
import { Button, Field, Spinner } from '@/components/ui/primitives';
import { useAuth } from '@/stores/auth.store';
import { AuthShell, Notice, PasswordInput } from './LoginPage';

/** Dibuka dari tautan email undangan atau reset kata sandi (Supabase Auth). */
export function SetPasswordPage() {
  const status = useAuth((s) => s.status);
  const setPassword = useAuth((s) => s.setPassword);
  const nav = useNavigate();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) return setError('Kata sandi minimal 8 karakter.');
    if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return setError('Gunakan kombinasi huruf dan angka.');
    if (pw !== pw2) return setError('Konfirmasi kata sandi tidak sama.');
    setBusy(true);
    const err = await setPassword(pw);
    setBusy(false);
    if (err) return setError(err);
    nav('/', { replace: true });
  };

  return (
    <AuthShell>
      <span data-fade className="grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary">
        <KeyRound className="size-7" />
      </span>
      <SplitTitle text="Buat kata sandi" className="mt-5 text-[30px] font-extrabold text-ink" />
      <p data-fade className="mt-2 text-[15px] text-muted">Kata sandi ini dipakai untuk masuk ke WargaKu berikutnya.</p>

      {status === 'loading' ? (
        <div className="mt-8 flex items-center gap-3 text-[14px] text-muted"><Spinner /> Memeriksa tautan…</div>
      ) : status !== 'signedIn' ? (
        <div className="mt-7 space-y-4">
          <Notice tone="danger">Tautan sudah kedaluwarsa atau tidak valid. Minta tautan baru dari halaman masuk (Lupa kata sandi) atau hubungi Ketua RT.</Notice>
          <Link to="/masuk"><Button variant="secondary" size="lg" className="w-full">Ke halaman masuk</Button></Link>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-7 flex flex-col gap-4" data-fade noValidate>
          <Field label="Kata sandi baru" htmlFor="npw" hint="Minimal 8 karakter, kombinasi huruf dan angka">
            <PasswordInput id="npw" autoComplete="new-password" autoFocus value={pw} onChange={(e) => (setPw(e.target.value), setError(''))} aria-invalid={!!error} />
          </Field>
          <Field label="Ulangi kata sandi" htmlFor="npw2">
            <PasswordInput id="npw2" autoComplete="new-password" value={pw2} onChange={(e) => (setPw2(e.target.value), setError(''))} aria-invalid={!!error} />
          </Field>
          {error ? <Notice tone="danger">{error}</Notice> : null}
          <Button type="submit" size="lg" className="mt-1 w-full" loading={busy}>Simpan & masuk</Button>
        </form>
      )}
    </AuthShell>
  );
}
