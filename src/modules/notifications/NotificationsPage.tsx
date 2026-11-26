import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Bell, CalendarDays, CheckCheck, FileText, HandCoins, Megaphone, MessageSquareWarning, ReceiptText, ShieldCheck, Info, type LucideIcon } from 'lucide-react';
import { usePageEnter, useFlip } from '@/motion';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button, Card, EmptyState, cx } from '@/components/ui/primitives';
import { Tabs } from '@/components/ui/Tabs';
import { useDatabase, useMe } from '@/hooks/useData';
import { actions } from '@/stores/db.store';
import { relative } from '@/lib/format';
import type { Notification } from '@/types/models';

const ICON: Record<Notification['type'], [LucideIcon, string]> = {
  invoice: [ReceiptText, 'bg-warn-soft text-warn-ink'],
  payment: [HandCoins, 'bg-success-soft text-success-ink'],
  letter: [FileText, 'bg-violet-soft text-violet-ink'],
  announcement: [Megaphone, 'bg-primary-soft text-primary'],
  complaint: [MessageSquareWarning, 'bg-danger-soft text-danger-ink'],
  activity: [CalendarDays, 'bg-primary-soft text-primary'],
  security: [ShieldCheck, 'bg-danger-soft text-danger-ink'],
  system: [Info, 'bg-panel-2 text-ink-2'],
};

export function NotificationsPage() {
  const db = useDatabase();
  const me = useMe()!;
  const nav = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  usePageEnter(ref);
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const mine = db.notifications.filter((n) => n.user_id === me.userId);
  const unread = mine.filter((n) => !n.read_at).length;
  const capture = useFlip(listRef, '[data-item]', [tab]);

  return (
    <div ref={ref} className="mx-auto max-w-[820px]">
      <PageHeader title="Notifikasi" description="Pemberitahuan tagihan, surat, pengumuman, dan tindak lanjut pengaduan."
        actions={unread ? <Button variant="secondary" icon={CheckCheck} onClick={() => actions.markAllNotificationsRead()}>Tandai semua dibaca</Button> : null} />
      <div className="mb-4" data-fade>
        <Tabs label="Filter notifikasi" value={tab} onChange={(v) => (capture(), setTab(v))} tabs={[{ value: 'all', label: 'Semua', count: mine.length }, { value: 'unread', label: 'Belum dibaca', count: unread }]} />
      </div>
      <Card data-card className="overflow-hidden">
        <ul ref={listRef} className="divide-y divide-line">
          {mine.map((n) => {
            const [I, t] = ICON[n.type];
            return (
              <li key={n.id} data-item hidden={tab === 'unread' && !!n.read_at}>
                <button onClick={() => { actions.markNotificationRead(n.id); if (n.link) nav(n.link); }} className={cx('flex w-full items-start gap-3.5 px-4 py-4 text-left hover:bg-panel/50 sm:px-5', !n.read_at && 'bg-primary-soft/30')}>
                  <span className={cx('grid size-10 shrink-0 place-items-center rounded-xl', t)}><I className="size-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2"><span className="text-[14.5px] font-bold">{n.title}</span>{!n.read_at ? <span className="size-2 rounded-full bg-primary" aria-label="Belum dibaca" /> : null}</span>
                    <span className="mt-0.5 block text-[13.5px] text-ink-2">{n.message}</span>
                    <span className="mt-1 block text-[12px] text-muted">{relative(n.created_at)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {!mine.length || (tab === 'unread' && !unread) ? <EmptyState icon={Bell} title={tab === 'unread' ? 'Semua sudah dibaca' : 'Belum ada notifikasi'} text="Kami akan memberi tahu saat ada tagihan, surat, atau pengumuman baru." /> : null}
      </Card>
    </div>
  );
}
