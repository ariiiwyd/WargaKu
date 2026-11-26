import { useMemo } from 'react';
import { useDb, actorOf, type Actor } from '@/stores/db.store';
import { useAuth } from '@/stores/auth.store';
import type { Database, Household, Resident } from '@/types/models';

export const useDatabase = () => useDb((s) => s.db);

/** Akun yang sedang masuk (null bila belum login / dinonaktifkan). */
export function useMe(): Actor | null {
  const db = useDatabase();
  const uid = useAuth((s) => s.userId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => actorOf(db), [db, uid]);
}

export function useLookups() {
  const db = useDatabase();
  return useMemo(() => {
    const residents = new Map(db.residents.map((r) => [r.id, r]));
    const households = new Map(db.households.map((h) => [h.id, h]));
    const profiles = new Map(db.profiles.map((p) => [p.id, p]));
    return {
      resident: (id: string | null | undefined) => (id ? residents.get(id) : undefined),
      household: (id: string | null | undefined) => (id ? households.get(id) : undefined),
      profile: (id: string | null | undefined) => (id ? profiles.get(id) : undefined),
      userName: (id: string | null | undefined) => (id ? profiles.get(id)?.full_name ?? 'Sistem' : '—'),
      headOf: (h: Household | undefined) => (h?.head_resident_id ? residents.get(h.head_resident_id) : undefined),
      letterType: (id: string) => db.letterTypes.find((t) => t.id === id),
      duesType: (id: string) => db.duesTypes.find((t) => t.id === id),
      cashCategory: (id: string | null) => db.cashCategories.find((c) => c.id === id),
      complaintCategory: (id: string) => db.complaintCategories.find((c) => c.id === id),
      householdOfResident: (r: Resident | undefined) => (r ? households.get(r.household_id) : undefined),
    };
  }, [db]);
}

export function cashSummary(db: Database) {
  let income = 0, expense = 0;
  for (const t of db.cash) t.transaction_type === 'income' ? (income += t.amount) : (expense += t.amount);
  return { income, expense, balance: income - expense };
}

/** Rekap kas per bulan (n bulan terakhir) */
export function cashByMonth(db: Database, n = 6) {
  const now = new Date();
  const out: { key: string; label: string; income: number; expense: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    out.push({ key, label: d.toLocaleDateString('id-ID', { month: 'short' }), income: 0, expense: 0 });
  }
  for (const t of db.cash) {
    const row = out.find((o) => t.transaction_date.startsWith(o.key));
    if (row) t.transaction_type === 'income' ? (row.income += t.amount) : (row.expense += t.amount);
  }
  return out;
}

export const unreadCount = (db: Database, userId: string) => db.notifications.filter((n) => n.user_id === userId && !n.read_at).length;
