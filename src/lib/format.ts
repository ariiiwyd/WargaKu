const TZ = 'Asia/Jakarta';

const idr = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('id-ID');

export const rupiah = (n: number) => idr.format(Math.round(n)).replace(/ /g, ' ');
export const rupiahShort = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1_000_000_000) return `Rp${(n / 1_000_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} M`;
  if (a >= 1_000_000) return `Rp${(n / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`;
  if (a >= 1_000) return `Rp${(n / 1_000).toLocaleString('id-ID', { maximumFractionDigits: 0 })} rb`;
  return rupiah(n);
};
export const number = (n: number) => num.format(n);

export const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
export const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

const toDate = (d: string | Date) => (typeof d === 'string' ? new Date(d.length === 10 ? d + 'T00:00:00+07:00' : d) : d);

export const dateLong = (d: string | Date) =>
  toDate(d).toLocaleDateString('id-ID', { timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric' });
export const dateShort = (d: string | Date) =>
  toDate(d).toLocaleDateString('id-ID', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' });
export const dateDay = (d: string | Date) =>
  toDate(d).toLocaleDateString('id-ID', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
export const time = (d: string | Date) =>
  toDate(d).toLocaleTimeString('id-ID', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).replace(':', '.');
export const dateTime = (d: string | Date) => `${dateShort(d)} · ${time(d)} WIB`;
export const period = (month: number | null, year: number) => (month ? `${MONTHS[month - 1]} ${year}` : `${year}`);

/** Bagian tanggal di zona Asia/Jakarta */
export function jakartaParts(d: Date = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false }).formatToParts(d);
  const get = (t: string) => Number(p.find((x) => x.type === t)?.value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') };
}
export const todayISO = () => {
  const { year, month, day } = jakartaParts();
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

export function relative(d: string | Date) {
  const diff = (Date.now() - toDate(d).getTime()) / 1000;
  const fut = diff < 0;
  const s = Math.abs(diff);
  const fmt = (v: number, u: string) => (fut ? `${v} ${u} lagi` : `${v} ${u} yang lalu`);
  if (s < 60) return fut ? 'sebentar lagi' : 'baru saja';
  if (s < 3600) return fmt(Math.floor(s / 60), 'menit');
  if (s < 86400) return fmt(Math.floor(s / 3600), 'jam');
  if (s < 86400 * 7) return fmt(Math.floor(s / 86400), 'hari');
  return dateShort(d);
}

export function greeting() {
  const h = jakartaParts().hour;
  if (h < 11) return 'Selamat pagi';
  if (h < 15) return 'Selamat siang';
  if (h < 18) return 'Selamat sore';
  return 'Selamat malam';
}

/** NIK / No. KK: tampilkan 4 digit awal & 2 akhir saja. */
export const maskId = (v: string | null | undefined) => (v ? `${v.slice(0, 4)} •••• •••• ••${v.slice(-2)}` : '—');

export const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

export function age(birth: string) {
  const b = toDate(birth);
  const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a;
}

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);

export const pad = (n: number, w = 3) => String(n).padStart(w, '0');
