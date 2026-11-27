import { useEffect, useState, type FormEvent } from 'react';
import { LogOut, ShieldCheck } from 'lucide-react';
import { SplitTitle } from '@/motion';
import { Button, Choice, Field, Input, Spinner } from '@/components/ui/primitives';
import { TotpEnroll } from '@/components/session/TotpEnroll';
import { useAuth } from '@/stores/auth.store';
import { friendlyError, supabase } from '@/lib/supabase';
import { markActive } from '@/lib/session';
import { AuthShell, Notice } from './LoginPage';

function SignOutLink() {
  const signOut = useAuth((s) => s.signOut);
  return (
    <button type="button" onClick={() => void signOut()} className="mx-auto mt-6 flex items-center gap-1.5 text-[13.5px] font-semibold text-muted hover:text-ink">
      <LogOut className="size-4" /> Keluar dan masuk dengan akun lain
    </button>
  );
}

/** Setelah kata sandi benar: minta 6 digit kode dari aplikasi authenticator. */
export function MfaChallengePage() {
  const setMfa = useAuth((s) => s.setMfa);
  const [factors, setFactors] = useState<{ id: string; name: string }[] | null>(null);
  const [factorId, setFactorId] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase?.auth.mfa.listFactors().then(({ data }) => {
      const list = (data?.totp ?? []).map((f) => ({ id: f.id, name: f.friendly_name || 'Authenticator' }));
      setFactors(list);
      setFactorId(list[0]?.id ?? '');
    });
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase || !factorId) return;
    if (!/^\d{6}$/.test(code)) return setError('Masukkan 6 digit kode dari aplikasi authenticator.');
    setBusy(true);
    const { error: err } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    setBusy(false);
    if (err) return (setError(friendlyError(err)), setCode(''));
    markActive();
    setMfa('ok');
  };

  return (
    <AuthShell>
      <span data-fade className="grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary-soft-ink">
        <ShieldCheck className="size-7" />
      </span>
      <SplitTitle text="Verifikasi 2 langkah" className="mt-5 text-[30px] font-extrabold text-ink" />
      <p data-fade className="mt-2 text-[15px] text-muted">Buka aplikasi authenticator di HP Anda, lalu masukkan 6 digit kode untuk WargaKu.</p>
      {!factors ? (
        <div className="mt-7 flex items-center gap-2.5 text-[14px] text-muted"><Spinner className="size-5" /> Memuat…</div>
      ) : (
        <form onSubmit={submit} className="mt-7 flex flex-col gap-4" data-fade noValidate>
          {factors.length > 1 ? (
            <Field label="Perangkat">
              <Choice name="Perangkat" value={factorId} onChange={(v) => (setFactorId(v), setError(''))} options={factors.map((f) => ({ value: f.id, label: f.name }))} />
            </Field>
          ) : null}
          <Field label="Kode verifikasi" htmlFor="totp">
            <Input id="totp" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={6} placeholder="123456" value={code}
              onChange={(e) => (setCode(e.target.value.replace(/\D/g, '')), setError(''))} className="text-center font-mono text-[22px] tracking-[0.4em]" aria-invalid={!!error} />
          </Field>
          {error ? <Notice tone="danger">{error}</Notice> : null}
          <Button type="submit" size="lg" className="mt-1 w-full" loading={busy}>Verifikasi</Button>
          <p className="rounded-2xl bg-panel px-4 py-3 text-center text-[13px] text-muted">
            HP hilang atau aplikasi authenticator terhapus? Hubungi Ketua RT untuk mereset verifikasi 2 langkah akun Anda.
          </p>
        </form>
      )}
      <SignOutLink />
    </AuthShell>
  );
}

/** Ketua RT & Bendahara wajib memasang authenticator sebelum bisa membuka data RT. */
export function MfaEnrollPage() {
  const setMfa = useAuth((s) => s.setMfa);
  return (
    <AuthShell>
      <span data-fade className="grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary-soft-ink">
        <ShieldCheck className="size-7" />
      </span>
      <SplitTitle text="Aktifkan verifikasi 2 langkah" className="mt-5 text-[30px] font-extrabold text-ink" />
      <p data-fade className="mt-2 text-[15px] text-muted">
        Akun Ketua RT dan Bendahara memegang data pribadi warga dan keuangan RT. Setelah aktif, setiap masuk Anda perlu kata sandi <b className="text-ink">dan</b> kode dari HP.
      </p>
      <div data-fade className="mt-7">
        <TotpEnroll deviceName="HP utama" onDone={() => (markActive(), setMfa('ok'))} />
      </div>
      <SignOutLink />
    </AuthShell>
  );
}
