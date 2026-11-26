import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { X, type LucideIcon } from 'lucide-react';
import { Modal } from '@/motion';
import { Button, Field, Textarea, cx } from './primitives';

/** Kerangka isi modal: kepala, isi, kaki. */
export function DialogShell({ id, title, sub, icon: Icon, onClose, children, footer, tone = 'blue' }: { id: string; title: string; sub?: string; icon?: LucideIcon; onClose: () => void; children: ReactNode; footer?: ReactNode; tone?: 'blue' | 'red' | 'green' }) {
  const tones = { blue: 'bg-primary-soft text-primary-soft-ink', red: 'bg-danger-soft text-danger-ink', green: 'bg-success-soft text-success-ink' };
  return (
    <div className="flex max-h-[calc(100dvh-32px)] flex-col">
      <div className="flex items-start gap-3 border-b border-line px-5 py-4 sm:px-6">
        {Icon ? (
          <span className={cx('grid size-10 shrink-0 place-items-center rounded-xl', tones[tone])}>
            <Icon className="size-5" />
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 id={id} className="text-[17px] font-bold text-ink">
            {title}
          </h2>
          {sub ? <p className="mt-0.5 text-[13px] text-muted">{sub}</p> : null}
        </div>
        <button onClick={onClose} aria-label="Tutup" className="grid size-9 place-items-center rounded-lg text-muted hover:bg-panel hover:text-ink">
          <X className="size-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
      {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-panel/60 px-5 py-3.5 sm:px-6">{footer}</div> : null}
    </div>
  );
}

/** Konfirmasi aksi persetujuan/penolakan (PRD §10.5: aksi approval memerlukan konfirmasi). */
export function ConfirmDialog({
  open, onClose, onConfirm, title, message, confirmLabel, tone = 'blue', icon, reason, reasonLabel = 'Alasan', reasonPlaceholder,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => boolean | void | Promise<boolean | void>;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  tone?: 'blue' | 'red' | 'green';
  icon?: LucideIcon;
  reason?: 'required' | 'optional';
  reasonLabel?: string;
  reasonPlaceholder?: string;
}) {
  const id = useId();
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (reason === 'required' && !text.trim()) return setErr(`${reasonLabel} wajib diisi`);
    setBusy(true);
    try {
      const r = await onConfirm(text);
      if (r !== false) {
        setText('');
        setErr('');
      }
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} labelledBy={id}>
      <form onSubmit={submit}>
        <DialogShell
          id={id}
          title={title}
          icon={icon}
          tone={tone}
          onClose={onClose}
          footer={
            <>
              <Button type="button" variant="secondary" onClick={onClose}>
                Batal
              </Button>
              <Button type="submit" loading={busy} variant={tone === 'red' ? 'danger' : tone === 'green' ? 'success' : 'primary'}>
                {confirmLabel}
              </Button>
            </>
          }
        >
          <div className="text-[14.5px] leading-relaxed text-ink-2" data-field>
            {message}
          </div>
          {reason ? (
            <Field label={reasonLabel} required={reason === 'required'} error={err} className="mt-4">
              <Textarea value={text} onChange={(e) => (setText(e.target.value), setErr(''))} placeholder={reasonPlaceholder} autoFocus aria-invalid={!!err} />
            </Field>
          ) : null}
        </DialogShell>
      </form>
    </Modal>
  );
}
