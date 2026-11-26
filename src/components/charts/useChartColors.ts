import { useEffect, useState } from 'react';
import { useUi } from '@/stores/ui.store';

const KEYS = ['--primary', '--success', '--warn', '--danger', '--muted', '--line', '--ink', '--card', '--violet-ink', '--panel-2'] as const;
type Colors = Record<'primary' | 'success' | 'warn' | 'danger' | 'muted' | 'line' | 'ink' | 'card' | 'violet' | 'panel2', string>;

function read(): Colors {
  const s = getComputedStyle(document.documentElement);
  const v = KEYS.map((k) => s.getPropertyValue(k).trim());
  return { primary: v[0]!, success: v[1]!, warn: v[2]!, danger: v[3]!, muted: v[4]!, line: v[5]!, ink: v[6]!, card: v[7]!, violet: v[8]!, panel2: v[9]! };
}

/** Warna final untuk atribut SVG Recharts, dihitung ulang saat tema berganti. */
export function useChartColors() {
  const theme = useUi((s) => s.theme);
  const [c, setC] = useState<Colors>(() => read());
  useEffect(() => {
    const update = () => requestAnimationFrame(() => setC(read()));
    update();
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, [theme]);
  return c;
}
