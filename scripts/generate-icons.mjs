// Membuat ikon PNG PWA dari public/favicon.svg. Jalankan: node scripts/generate-icons.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const svg = readFileSync('public/favicon.svg', 'utf8');
// Versi maskable: ubin penuh tanpa sudut membulat + logo di zona aman 80%.
const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace('<rect width="64" height="64" rx="15" fill="url(#t)"/>', '');
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3B82F6"/><stop offset="1" stop-color="#1D4ED8"/></linearGradient></defs><rect width="64" height="64" fill="url(#bg)"/><g transform="translate(6.4 6.4) scale(.8)">${inner}</g></svg>`;

mkdirSync('public/icons', { recursive: true });
const out = (src, size, file) => {
  const png = new Resvg(src, { fitTo: { mode: 'width', value: size } }).render().asPng();
  writeFileSync(`public/icons/${file}`, png);
  console.log('✓', file, png.length, 'bytes');
};
out(svg, 192, 'icon-192.png');
out(svg, 512, 'icon-512.png');
out(maskable, 512, 'maskable-512.png');
out(maskable, 180, 'apple-touch-icon.png');
