import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Copy, ExternalLink } from 'lucide-react';
import { Button, Field, Input, Spinner } from '@/components/ui/primitives';
import { friendlyError, supabase } from '@/lib/supabase';

type Enrolled = { factorId: string; qr: string; secret: string; uri: string };

const qrSrc = (qr: string) => (qr.startsWith('data:') ? qr : `data:image/svg+xml;utf8,${encodeURIComponent(qr)}`);

/**
 * Pasang authenticator (TOTP): pindai QR / buka di aplikasi authenticator / ketik kunci,
 * lalu masukkan 6 digit kode. Setelah berhasil, sesi naik ke aal2.
 */
export function TotpEnroll({ deviceName, onDone, onCancel }: { deviceName: string; onDone: () => void; onCancel?: () => void }) {
  const [state, setState] = useState<Enrolled | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !supabase) return;
    started.current = true;
    (async () => {
      const mfa = supabase!.auth.mfa;
      // Pendaftaran lama yang tidak diselesaikan dibersihkan dulu.
      const { data: list } = await mfa.listFactors();
      for (const f of list?.all ?? []) if (f.status === 'unverified') await mfa.unenroll({ factorId: f.id });
      const taken = new Set((list?.all ?? []).filter((f) => f.status === 'verified').map((f) => f.friendly_name));
      let name = deviceName;
      for (let i = 2; taken.has(name); i++) name = `${deviceName} ${i}`;
      const { data, error: e } = await mfa.enroll({ factorType: 'totp', friendlyName: name, issuer: 'WargaKu' });
      if (e || !data) return setError(friendlyError(e));
      setState({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret, uri: data.totp.uri });
    })();
  }, [deviceName]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!state || !supabase) return;
    if (!/^\d{6}$/.test(code)) return setError('Masukkan 6 digit kode dari aplikasi authenticator.');
    setBusy(true);
    const { error: err } = await supabase.auth.mfa.challengeAndVerify({ factorId: state.factorId, code });
    setBusy(false);
    if (err) return setError(friendlyError(err));
    onDone();
  };

  const copy = async () => {
    if (!state) return;
    try {
      await navigator.clipboard.writeText(state.secret);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard diblokir: kunci tetap bisa diketik manual */
    }
  };

  if (!state) {
    return error ? (
      <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-[13.5px] font-medium text-danger-ink">{error}</p>
    ) : (
      <div className="flex items-center gap-2.5 py-6 text-[14px] text-muted"><Spinner className="size-5" /> Menyiapkan kode…</div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <ol className="space-y-4 text-[14px] leading-relaxed text-ink-2">
        <li>
          <b className="text-ink">1. Pasang aplikasi authenticator</b> di HP Anda, misalnya Google Authenticator atau Microsoft Authenticator (gratis di Play Store / App Store).
        </li>
        <li>
          <b className="text-ink">2. Tambahkan akun WargaKu</b> ke aplikasi itu dengan salah satu cara:
          <div className="mt-3 flex flex-col items-center gap-3 rounded-2xl border border-line bg-panel/50 p-4 sm:flex-row sm:items-start">
            <img src={qrSrc(state.qr)} alt="Kode QR untuk aplikasi authenticator" className="size-[148px] shrink-0 rounded-xl bg-white p-2" />
            <div className="w-full min-w-0 space-y-2.5 text-[13px]">
              <p>Pindai kode QR ini dari HP lain, <b className="text-ink">atau</b> bila Anda membuka WargaKu di HP yang sama:</p>
              <a href={state.uri} className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline">
                <ExternalLink className="size-4" /> Buka di aplikasi authenticator
              </a>
              <p className="text-muted">Atau ketik kunci ini secara manual:</p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 rounded-lg bg-card px-2.5 py-2 font-mono text-[12.5px] break-all text-ink">{state.secret.replace(/(.{4})/g, '$1 ').trim()}</code>
                <Button type="button" size="sm" variant="secondary" icon={Copy} onClick={copy}>{copied ? 'Tersalin' : 'Salin'}</Button>
              </div>
            </div>
          </div>
        </li>
        <li>
          <b className="text-ink">3. Masukkan 6 digit kode</b> yang muncul di aplikasi authenticator.
        </li>
      </ol>
      <Field label="Kode verifikasi" htmlFor="totp-new">
        <Input id="totp-new" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" value={code}
          onChange={(e) => (setCode(e.target.value.replace(/\D/g, '')), setError(''))} className="text-center font-mono text-[20px] tracking-[0.4em]" aria-invalid={!!error} />
      </Field>
      {error ? <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-[13.5px] font-medium text-danger-ink">{error}</p> : null}
      <div className="flex justify-end gap-2">
        {onCancel ? <Button type="button" variant="secondary" onClick={onCancel}>Batal</Button> : null}
        <Button type="submit" loading={busy}>Aktifkan</Button>
      </div>
    </form>
  );
}
