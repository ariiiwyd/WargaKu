/**
 * Ekspor Excel/PDF. Pustaka dimuat saat dibutuhkan (dynamic import) supaya
 * bundle awal tetap ringan. Pemanggil bertanggung jawab hanya menyertakan
 * kolom yang boleh dilihat peran pengguna (mis. NIK hanya Ketua/Sekretaris).
 */
export async function exportXlsx(fileName: string, sheet: string, rows: Record<string, unknown>[]) {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.json_to_sheet(rows);
  const cols = Object.keys(rows[0] ?? {}).map((k) => ({ wch: Math.min(40, Math.max(k.length, ...rows.map((r) => String(r[k] ?? '').length)) + 2) }));
  ws['!cols'] = cols;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheet.slice(0, 31));
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

export async function exportMultiXlsx(fileName: string, sheets: { name: string; rows: Record<string, unknown>[] }[]) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.json_to_sheet(s.rows.length ? s.rows : [{ Keterangan: 'Tidak ada data' }]);
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}
