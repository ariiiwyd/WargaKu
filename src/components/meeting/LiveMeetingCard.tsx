import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Radio, Video } from 'lucide-react';
import { useDatabase } from '@/hooks/useData';
import { useJoinMeeting } from '@/hooks/useJoinMeeting';
import { isMeetingLive, meetingProvider } from '@/lib/meeting';
import { time } from '@/lib/format';

/**
 * Kartu "Rapat sedang berlangsung" di beranda warga & dashboard pengurus.
 * Muncul selama jendela gabung (15 menit sebelum s.d. 30 menit setelah rapat, atau status berlangsung).
 */
export function LiveMeetingCard() {
  const db = useDatabase();
  const join = useJoinMeeting();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const live = db.activities.filter((a) => isMeetingLive(a, now)).sort((a, b) => a.start_at.localeCompare(b.start_at));
  if (!live.length) return null;

  return (
    <div className="mb-5 space-y-3" role="region" aria-label="Rapat online yang bisa diikuti">
      {live.map((a) => {
        const started = a.status === 'ongoing' || now >= new Date(a.start_at).getTime();
        return (
          <section key={a.id} data-card className="flex flex-col gap-3 rounded-[20px] bg-primary p-4 text-white shadow-[0_18px_40px_-20px_var(--primary)] sm:flex-row sm:items-center sm:p-5">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/15">
              <Radio className="size-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-[12.5px] font-semibold text-white/85">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#A7F3D0] opacity-75 motion-reduce:hidden" />
                  <span className="relative inline-flex size-2 rounded-full bg-[#A7F3D0]" />
                </span>
                {started ? 'Rapat sedang berlangsung' : `Rapat dimulai ${time(a.start_at)} WIB`}
              </p>
              <Link to="/kegiatan" className="mt-0.5 block truncate text-[17px] font-extrabold hover:underline">{a.title}</Link>
              <p className="truncate text-[13px] text-white/80">
                {meetingProvider(a.meeting_url)}{a.meeting_mode === 'hybrid' ? ` · juga tatap muka di ${a.location}` : ''}
              </p>
            </div>
            <button
              onClick={() => join(a)}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 text-[14px] font-bold text-primary transition-transform active:scale-[.98] hover:bg-white/90"
            >
              <Video className="size-[18px]" />
              Gabung sekarang
            </button>
          </section>
        );
      })}
    </div>
  );
}
