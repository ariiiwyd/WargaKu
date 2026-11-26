import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { rupiah, rupiahShort } from '@/lib/format';
import { useChartColors } from './useChartColors';

type Row = { label: string; income: number; expense: number };

export function CashFlowChart({ data, height = 240 }: { data: Row[]; height?: number }) {
  const c = useChartColors();
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height }}>
        <BarChart data={data} barGap={4} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={c.line} strokeDasharray="3 4" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: c.muted, fontSize: 12 }} />
          <YAxis tickLine={false} axisLine={false} width={64} tick={{ fill: c.muted, fontSize: 11.5 }} tickFormatter={(v: number) => rupiahShort(v).replace('Rp', '')} />
          <Tooltip
            cursor={{ fill: c.panel2, opacity: 0.6 }}
            contentStyle={{ background: c.card, border: `1px solid ${c.line}`, borderRadius: 12, fontSize: 13, color: c.ink }}
            formatter={(v, n) => [rupiah(Number(v)), n === 'income' ? 'Pemasukan' : 'Pengeluaran']}
          />
          <Bar dataKey="income" fill={c.primary} radius={[6, 6, 2, 2]} maxBarSize={26} animationBegin={300} animationDuration={900} animationEasing="ease-out" />
          <Bar dataKey="expense" fill={c.warn} radius={[6, 6, 2, 2]} maxBarSize={26} animationBegin={380} animationDuration={900} animationEasing="ease-out" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-[12.5px] text-muted">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}
