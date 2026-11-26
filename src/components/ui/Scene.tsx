/**
 * Ilustrasi deretan rumah komplek — dipakai di banner sapaan & halaman masuk.
 * Siluet putih bertingkat di atas biru: lapisan belakang samar, depan lebih terang,
 * dengan jendela menyala dan pepohonan hijau (warna Fresh Green brand).
 */
export function NeighborhoodScene({ className = '' }: { className?: string }) {
  const house = (x: number, w: number, h: number, roof: number, o: number, windows = 2, door = true) => {
    const base = 200;
    const top = base - h;
    return (
      <g opacity={o}>
        <path d={`M${x - 6} ${top + 2} L${x + w / 2} ${top - roof} L${x + w + 6} ${top + 2} Z`} fill="#fff" />
        <rect x={x} y={top} width={w} height={h} fill="#fff" />
        {Array.from({ length: windows }).map((_, i) => (
          <rect
            key={i}
            x={x + (w / (windows + 1)) * (i + 1) - 7}
            y={top + h * 0.22}
            width="14"
            height="14"
            rx="2"
            fill="#FDE68A"
            opacity={o > 0.6 ? 0.95 : 0.5}
          />
        ))}
        {door ? <rect x={x + w / 2 - 7} y={base - 26} width="14" height="26" rx="2" fill="#1D4ED8" opacity=".55" /> : null}
      </g>
    );
  };
  const tree = (x: number, r: number, h: number) => (
    <g>
      <rect x={x - 2} y={200 - h} width="4" height={h} fill="#065F46" opacity=".7" />
      <circle cx={x} cy={200 - h - r * 0.6} r={r} fill="#10B981" />
      <circle cx={x - r * 0.55} cy={200 - h - r * 0.1} r={r * 0.72} fill="#34D399" />
    </g>
  );
  return (
    <svg viewBox="0 0 640 200" preserveAspectRatio="xMaxYMax slice" className={className} aria-hidden="true">
      {/* lapisan belakang */}
      {house(40, 70, 70, 34, 0.14, 2, false)}
      {house(150, 90, 86, 40, 0.14, 3, false)}
      {house(290, 64, 64, 30, 0.14, 2, false)}
      {house(400, 96, 96, 44, 0.14, 3, false)}
      {house(540, 80, 76, 36, 0.14, 2, false)}
      {/* lapisan tengah */}
      {house(96, 84, 74, 36, 0.32)}
      {house(236, 70, 62, 32, 0.32)}
      {house(468, 76, 66, 34, 0.32)}
      {/* lapisan depan */}
      {house(332, 110, 92, 46, 0.95, 3)}
      {house(484, 92, 70, 38, 0.9, 2)}
      {tree(318, 18, 24)}
      {tree(458, 15, 20)}
      {tree(600, 22, 28)}
      <rect x="0" y="196" width="640" height="4" fill="#fff" opacity=".35" />
    </svg>
  );
}
