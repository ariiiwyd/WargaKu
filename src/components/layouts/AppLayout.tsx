import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, NavLink, useLocation, useNavigate } from 'react-router';
import {
  Bell, ChevronDown, CircleCheckBig, Ellipsis, LogOut, MapPin, Monitor, Moon, PanelLeftClose, PanelLeftOpen, Sun, X, type LucideIcon,
} from 'lucide-react';
import { RouteTransition, Sheet, gsap, useSlidingPill, reducedMotion } from '@/motion';
import { Avatar, Button, IconButton, Spinner, cx } from '@/components/ui/primitives';
import { LogoMark, Wordmark } from '@/components/ui/Logo';
import { Popover } from './Popover';
import { navFor, bottomNavFor, type NavItem } from '@/app/navigation';
import { ROLE_LABEL, roleWithRt } from '@/app/permissions';
import { useDatabase, useMe, unreadCount } from '@/hooks/useData';
import { useAuth } from '@/stores/auth.store';
import { useUi } from '@/stores/ui.store';
import { actions, useDb } from '@/stores/db.store';
import { supabase } from '@/lib/supabase';
import { relative } from '@/lib/format';
import type { ThemePref } from '@/types/models';

const isActive = (to: string, path: string) => (to === '/' ? path === '/' : path === to || path.startsWith(to + '/'));

/** Gerbang area masuk: tunggu sesi Supabase & data RT, lalu render aplikasi. */
export function AppLayout() {
  const auth = useAuth((s) => s.status);
  const uid = useAuth((s) => s.userId);
  const recovery = useAuth((s) => s.recovery);
  const status = useDb((s) => s.status);
  const error = useDb((s) => s.error);
  const load = useDb((s) => s.load);
  const clear = useDb((s) => s.clear);

  useEffect(() => {
    if (auth === 'signedIn' && uid) load();
    if (auth === 'signedOut') clear();
  }, [auth, uid, load, clear]);

  // Data tetap segar: notifikasi realtime + muat ulang saat aplikasi kembali dibuka.
  useEffect(() => {
    if (auth !== 'signedIn' || !uid || !supabase) return;
    const ch = supabase
      .channel(`notif-${uid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` }, () => load({ silent: true }))
      .subscribe();
    const onVisible = () => document.visibilityState === 'visible' && load({ silent: true });
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      supabase?.removeChannel(ch);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [auth, uid, load]);

  if (recovery) return <Navigate to="/atur-sandi" replace />;
  if (auth === 'unconfigured' || auth === 'signedOut') return <Navigate to="/masuk" replace />;
  if (status === 'error') return <GateScreen title="Data tidak dapat dimuat" text={error ?? ''} retry={() => load()} />;
  if (status === 'no-membership') return <GateScreen title="Akun belum terdaftar di RT" text={error ?? ''} />;
  if (auth === 'loading' || status !== 'ready') return <GateScreen loading />;
  return <Shell />;
}

function GateScreen({ loading, title, text, retry }: { loading?: boolean; title?: string; text?: string; retry?: () => void }) {
  const signOut = useAuth((s) => s.signOut);
  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-4">
      <div className="flex max-w-sm flex-col items-center text-center">
        <LogoMark className="size-14" />
        {loading ? (
          <>
            <Spinner className="mt-6 size-6" />
            <p className="mt-3 text-[14px] font-semibold text-muted">Memuat data RT…</p>
          </>
        ) : (
          <>
            <p className="mt-5 text-[18px] font-bold text-ink">{title}</p>
            <p className="mt-1.5 text-[14px] text-muted">{text}</p>
            <div className="mt-5 flex gap-2">
              {retry ? <Button onClick={retry}>Coba lagi</Button> : null}
              <Button variant="secondary" icon={LogOut} onClick={() => signOut()}>Keluar</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Shell() {
  const me = useMe();
  const { pathname } = useLocation();
  const collapsed = useUi((s) => s.sidebarCollapsed);
  const [moreOpen, setMoreOpen] = useState(false);

  if (!me) return <GateScreen title="Akun belum terdaftar di RT" text="Akun Anda belum ditautkan ke keanggotaan RT yang aktif. Hubungi Ketua RT." />;
  const nav = navFor(me.role);

  return (
    <div className="min-h-dvh bg-bg">
      <Sidebar items={nav} pathname={pathname} collapsed={collapsed} />
      <div className={cx('transition-[padding] duration-500 ease-smooth', collapsed ? 'lg:pl-[88px]' : 'lg:pl-[264px]')}>
        <TopBar />
        <main className="mx-auto w-full max-w-[1440px] px-4 pt-5 pb-[calc(108px+env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:pt-7 lg:pb-12">
          <RouteTransition />
        </main>
      </div>
      <BottomNav pathname={pathname} onMore={() => setMoreOpen(true)} />
      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} label="Semua menu">
        <MoreMenu items={nav} pathname={pathname} onClose={() => setMoreOpen(false)} />
      </Sheet>
    </div>
  );
}

/* ------------------------------------------------------------------ Sidebar */
function Sidebar({ items, pathname, collapsed }: { items: NavItem[]; pathname: string; collapsed: boolean }) {
  const me = useMe()!;
  const db = useDatabase();
  const toggle = useUi((s) => s.toggleSidebar);
  const list = useRef<HTMLUListElement>(null);
  const activeKey = items.find((i) => isActive(i.to, pathname))?.to ?? '';
  const pill = useSlidingPill(list, `${activeKey}-${collapsed}`);
  const pendingLetters = db.letters.filter((l) => (me.role === 'ketua_rt' ? l.status === 'review' : me.role === 'sekretaris' ? l.status === 'submitted' : false)).length;
  const pendingPay = me.role === 'bendahara' || me.role === 'ketua_rt' ? db.payments.filter((p) => p.status === 'pending').length : 0;
  const badges: Record<string, number> = { '/surat': pendingLetters, '/iuran': pendingPay };

  return (
    <aside
      className={cx(
        'fixed inset-y-0 left-0 z-40 hidden flex-col bg-navy text-navy-ink transition-[width] duration-500 ease-smooth lg:flex',
        collapsed ? 'w-[88px]' : 'w-[264px]',
      )}
    >
      <div className={cx('flex h-[76px] items-center gap-3 border-b border-navy-line', collapsed ? 'justify-center px-0' : 'px-6')}>
        <LogoMark className="size-10 shrink-0" />
        {!collapsed ? (
          <div className="min-w-0 leading-tight">
            <Wordmark onDark className="text-[21px]" />
            <p className="truncate text-[10.5px] font-medium text-navy-ink/70">Satu Aplikasi, Semua Urusan Warga.</p>
          </div>
        ) : null}
      </div>

      <nav aria-label="Navigasi utama" className="nav-scroll flex-1 overflow-y-auto px-3 py-4">
        <ul ref={list} className="relative isolate flex flex-col gap-1">
          <span ref={pill} className="absolute top-0 left-0 -z-10 rounded-xl bg-primary opacity-0 shadow-[0_10px_24px_-12px_var(--primary)]" />
          {items.map((i) => {
            const on = isActive(i.to, pathname);
            const b = badges[i.to] ?? 0;
            return (
              <li key={i.to} data-active={on}>
                <NavLink
                  to={i.to}
                  title={collapsed ? i.label : undefined}
                  className={cx(
                    'group flex h-11 items-center gap-3 rounded-xl text-[14px] font-semibold transition-colors',
                    collapsed ? 'justify-center px-0' : 'px-3.5',
                    on ? 'text-white' : 'text-navy-ink hover:bg-white/[.06] hover:text-white',
                  )}
                >
                  <span className="relative">
                    <i.icon className="size-[19px]" strokeWidth={on ? 2.3 : 2} />
                    {b && collapsed ? <span className="absolute -top-1 -right-1 size-2 rounded-full bg-warn ring-2 ring-navy" /> : null}
                  </span>
                  {!collapsed ? <span className="flex-1 truncate">{i.label}</span> : null}
                  {!collapsed && b ? (
                    <span className={cx('grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold', on ? 'bg-white/20 text-white' : 'bg-warn text-navy')}>{b}</span>
                  ) : null}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-navy-line p-3">
        <div className={cx('flex items-center gap-3 rounded-xl p-2', collapsed && 'justify-center')}>
          <Avatar name={me.name} size={38} className="ring-2 ring-white/10" />
          {!collapsed ? (
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-[13.5px] font-bold text-white">{me.name}</p>
              <p className="truncate text-[12px] text-navy-ink/80">
                {roleWithRt(me.role, db.neighborhood.rt_number)}
              </p>
            </div>
          ) : null}
        </div>
        <button
          onClick={toggle}
          className={cx('mt-1 flex h-9 w-full items-center gap-2.5 rounded-lg text-[12.5px] font-semibold text-navy-ink/80 hover:bg-white/[.06] hover:text-white', collapsed ? 'justify-center' : 'px-3')}
          aria-label={collapsed ? 'Perlebar sidebar' : 'Perkecil sidebar'}
        >
          {collapsed ? <PanelLeftOpen className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
          {!collapsed ? 'Perkecil menu' : null}
        </button>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ Top bar */
function TopBar() {
  const me = useMe()!;
  const db = useDatabase();
  const nav = useNavigate();
  const logout = useAuth((s) => s.signOut);
  const unread = unreadCount(db, me.userId);
  const notes = db.notifications.filter((n) => n.user_id === me.userId).slice(0, 6);
  const bell = useRef<HTMLSpanElement>(null);

  const ring = () => {
    if (bell.current && !reducedMotion()) gsap.to(bell.current, { keyframes: { rotation: [0, 18, -14, 10, -6, 0] }, duration: 0.7, transformOrigin: '50% 10%' });
  };

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-xl">
      <div className="mx-auto flex h-[64px] max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:h-[76px] lg:px-8">
        <Link to="/" className="flex items-center gap-2.5 lg:hidden" aria-label="WargaKu beranda">
          <LogoMark className="size-9" />
          <Wordmark className="text-[19px]" />
        </Link>

        <div className="hidden items-center gap-2 rounded-xl border border-line bg-card py-1.5 pr-3 pl-2 shadow-sm lg:flex">
          <span className="grid size-8 place-items-center rounded-lg bg-primary-soft text-primary-soft-ink">
            <MapPin className="size-4" />
          </span>
          <div className="leading-tight">
            <p className="text-[13px] font-bold text-ink">
              RT {db.neighborhood.rt_number} / RW {db.neighborhood.rw_number}
            </p>
            <p className="text-[11.5px] text-muted">
              {db.neighborhood.name} · {db.neighborhood.village}
            </p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
          <ThemeMenu />
          <Popover
            className="w-[min(360px,calc(100vw-24px))]"
            trigger={({ toggle }) => (
              <span ref={bell} className="inline-flex">
                <IconButton icon={Bell} label={`Notifikasi${unread ? `, ${unread} belum dibaca` : ''}`} badge={unread} onClick={() => (toggle(), ring())} />
              </span>
            )}
          >
            {(close) => (
              <div>
                <div className="flex items-center justify-between px-3 pt-2 pb-2">
                  <p className="text-sm font-bold">Notifikasi</p>
                  {unread ? (
                    <button onClick={() => actions.markAllNotificationsRead()} className="text-xs font-semibold text-primary hover:underline">
                      Tandai semua dibaca
                    </button>
                  ) : null}
                </div>
                <ul className="max-h-[360px] overflow-y-auto">
                  {notes.length ? (
                    notes.map((n) => (
                      <li key={n.id}>
                        <button
                          onClick={() => {
                            actions.markNotificationRead(n.id);
                            close();
                            if (n.link) nav(n.link);
                          }}
                          className="flex w-full gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-panel"
                        >
                          <span className={cx('mt-1.5 size-2 shrink-0 rounded-full', n.read_at ? 'bg-transparent' : 'bg-primary')} />
                          <span className="min-w-0">
                            <span className="block text-[13.5px] font-semibold text-ink">{n.title}</span>
                            <span className="line-clamp-2 text-[12.5px] text-muted">{n.message}</span>
                            <span className="mt-0.5 block text-[11.5px] text-muted">{relative(n.created_at)}</span>
                          </span>
                        </button>
                      </li>
                    ))
                  ) : (
                    <li className="flex flex-col items-center px-4 py-8 text-center text-sm text-muted">
                      <CircleCheckBig className="mb-2 size-6 text-success" />
                      Tidak ada notifikasi
                    </li>
                  )}
                </ul>
                <Link to="/notifikasi" onClick={close} className="mt-1 block rounded-xl px-3 py-2.5 text-center text-[13px] font-semibold text-primary hover:bg-panel">
                  Lihat semua notifikasi
                </Link>
              </div>
            )}
          </Popover>

          <Popover
            className="w-64"
            trigger={({ toggle, open }) => (
              <button onClick={toggle} aria-expanded={open} aria-label="Menu akun" className="ml-1 flex items-center gap-2 rounded-xl p-1 pr-2 hover:bg-panel">
                <Avatar name={me.name} size={34} />
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block max-w-[140px] truncate text-[13px] font-bold text-ink">{me.name}</span>
                  <span className="block text-[11.5px] text-muted">{ROLE_LABEL[me.role]}</span>
                </span>
                <ChevronDown className="hidden size-4 text-muted sm:block" />
              </button>
            )}
          >
            {(close) => (
              <div>
                <div className="px-3 py-2.5">
                  <p className="truncate text-sm font-bold">{me.name}</p>
                  <p className="text-xs text-muted">
                    {ROLE_LABEL[me.role]} · RT {db.neighborhood.rt_number}
                  </p>
                </div>
                <div className="my-1 h-px bg-line" />
                <MenuLink to="/pengaturan" label="Profil & pengaturan" onClick={close} />
                <MenuLink to="/notifikasi" label="Semua notifikasi" onClick={close} />
                <div className="my-1 h-px bg-line" />
                <button
                  onClick={() => {
                    logout();
                    nav('/masuk');
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold text-danger-ink hover:bg-danger-soft"
                >
                  <LogOut className="size-4" />
                  Keluar
                </button>
              </div>
            )}
          </Popover>
        </div>
      </div>
    </header>
  );
}

function MenuLink({ to, label, onClick }: { to: string; label: string; onClick: () => void }) {
  return (
    <Link to={to} onClick={onClick} className="block rounded-xl px-3 py-2.5 text-[13.5px] font-semibold text-ink-2 hover:bg-panel hover:text-ink">
      {label}
    </Link>
  );
}

const THEMES: { value: ThemePref; label: string; icon: LucideIcon }[] = [
  { value: 'light', label: 'Terang', icon: Sun },
  { value: 'dark', label: 'Gelap', icon: Moon },
  { value: 'system', label: 'Ikuti sistem', icon: Monitor },
];

export function ThemeMenu() {
  const theme = useUi((s) => s.theme);
  const setTheme = useUi((s) => s.setTheme);
  const icon = useRef<HTMLSpanElement>(null);
  const Cur = THEMES.find((t) => t.value === theme)!.icon;
  return (
    <Popover
      className="w-52"
      trigger={({ toggle }) => (
        <span ref={icon} className="inline-flex">
          <IconButton icon={Cur} label="Ganti tema" onClick={toggle} />
        </span>
      )}
    >
      {(close) => (
        <div role="menu" aria-label="Tema">
          {THEMES.map((t) => (
            <button
              key={t.value}
              role="menuitemradio"
              aria-checked={theme === t.value}
              onClick={() => {
                setTheme(t.value);
                close();
                if (icon.current && !reducedMotion()) gsap.fromTo(icon.current, { rotation: -90, scale: 0.6 }, { rotation: 0, scale: 1, duration: 0.55, ease: 'back.out(2.2)' });
              }}
              className={cx('flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold', theme === t.value ? 'bg-primary-soft text-primary-soft-ink' : 'text-ink-2 hover:bg-panel')}
            >
              <t.icon className="size-4" />
              {t.label}
            </button>
          ))}
        </div>
      )}
    </Popover>
  );
}

/* ------------------------------------------------------------------ Mobile nav */
function BottomNav({ pathname, onMore }: { pathname: string; onMore: () => void }) {
  const me = useMe()!;
  const db = useDatabase();
  const items = bottomNavFor(me.role);
  const box = useRef<HTMLDivElement>(null);
  const activeKey = items.find((i) => isActive(i.to, pathname))?.to ?? 'more';
  const pill = useSlidingPill(box, activeKey);
  const unread = unreadCount(db, me.userId);
  return (
    <nav
      aria-label="Navigasi bawah"
      className="fixed inset-x-2.5 bottom-[calc(10px+env(safe-area-inset-bottom))] z-40 rounded-[22px] border border-line bg-card/90 p-1.5 shadow-lg backdrop-blur-xl lg:hidden"
    >
      <div ref={box} className="relative isolate grid grid-cols-5">
        <span ref={pill} className="absolute top-0 left-0 -z-10 rounded-2xl bg-primary-soft opacity-0" />
        {items.map((i) => {
          const on = isActive(i.to, pathname);
          return (
            <NavLink key={i.to} to={i.to} data-active={on} className={cx('flex h-[54px] flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-semibold', on ? 'text-primary-soft-ink' : 'text-muted')}>
              <span className="relative">
                <i.icon className="size-[21px]" strokeWidth={on ? 2.3 : 2} />
                {i.to === '/notifikasi' && unread ? <span className="absolute -top-1 -right-1.5 size-2.5 rounded-full bg-danger ring-2 ring-card" /> : null}
              </span>
              {i.label}
            </NavLink>
          );
        })}
        <button onClick={onMore} data-active={activeKey === 'more'} className={cx('flex h-[54px] flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-semibold', activeKey === 'more' ? 'text-primary-soft-ink' : 'text-muted')}>
          <Ellipsis className="size-[21px]" />
          Lainnya
        </button>
      </div>
    </nav>
  );
}

function MoreMenu({ items, pathname, onClose }: { items: NavItem[]; pathname: string; onClose: () => void }) {
  const me = useMe()!;
  const nav = useNavigate();
  const logout = useAuth((s) => s.signOut);
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-line px-5 py-4">
        <Avatar name={me.name} size={42} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{me.name}</p>
          <p className="text-xs text-muted">{ROLE_LABEL[me.role]}</p>
        </div>
        <button onClick={onClose} aria-label="Tutup" className="grid size-10 place-items-center rounded-xl text-muted hover:bg-panel">
          <X className="size-5" />
        </button>
      </div>
      <div className="grid flex-1 grid-cols-3 content-start gap-2.5 overflow-y-auto p-4">
        {items.map((i) => {
          const on = isActive(i.to, pathname);
          return (
            <Link
              data-sheet-item
              key={i.to}
              to={i.to}
              onClick={onClose}
              className={cx('flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border p-2 text-center text-[12px] leading-tight font-semibold', on ? 'border-primary bg-primary-soft text-primary-soft-ink' : 'border-line bg-panel/50 text-ink-2')}
            >
              <span className={cx('grid size-11 place-items-center rounded-xl', on ? 'bg-primary text-white' : 'bg-card text-primary shadow-sm')}>
                <i.icon className="size-5" />
              </span>
              {i.short ?? i.label}
            </Link>
          );
        })}
      </div>
      <div className="border-t border-line p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-ink-2">Tema</span>
          <ThemeMenu />
        </div>
        <button
          onClick={() => {
            logout();
            onClose();
            nav('/masuk');
          }}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-danger-soft text-sm font-bold text-danger-ink"
        >
          <LogOut className="size-4" /> Keluar
        </button>
      </div>
    </div>
  );
}
