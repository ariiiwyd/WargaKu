import type { Household, LetterRequest, LetterType, Neighborhood, Resident } from '@/types/models';
import { dateLong } from '@/lib/format';

const STATEMENT: Record<string, (r: Resident) => string> = {
  SP: () => 'Orang tersebut di atas adalah benar warga kami yang berdomisili di alamat tersebut dan berkelakuan baik. Surat pengantar ini diberikan untuk melengkapi persyaratan administrasi pada instansi terkait.',
  SKD: (r) => `Orang tersebut di atas adalah benar warga yang berdomisili di wilayah kami sejak ${r.joined_at ? dateLong(r.joined_at) : '-'} sampai dengan saat ini.`,
  SKU: () => 'Orang tersebut di atas adalah benar warga kami yang memiliki dan menjalankan usaha di lingkungan RT kami, sebagaimana keterangan di bawah ini.',
  SKTM: () => 'Berdasarkan pengamatan dan data yang ada pada kami, keluarga orang tersebut di atas tergolong keluarga kurang mampu secara ekonomi.',
};

/** Membuat PDF surat (nomor diterbitkan atomik saat persetujuan Ketua RT). */
export async function generateLetterPdf(o: { letter: LetterRequest; type: LetterType; resident: Resident; household: Household | undefined; rt: Neighborhood; ketua: string }) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 22;
  let y = 20;

  // Kop
  doc.setFillColor(37, 99, 235);
  doc.roundedRect(M, y - 4, 16, 16, 3, 3, 'F');
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(1.1);
  doc.lines([[6, -5], [6, 5]], M + 2, y + 6);
  doc.setFillColor(16, 185, 129);
  doc.ellipse(M + 8, y + 9.5, 5, 1.2, 'F');
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(`RUKUN TETANGGA ${o.rt.rt_number} / RUKUN WARGA ${o.rt.rw_number}`, W / 2 + 8, y, { align: 'center' });
  doc.setFontSize(11);
  doc.text(`KELURAHAN ${o.rt.village.toUpperCase()} · KECAMATAN ${o.rt.district.toUpperCase()}`, W / 2 + 8, y + 6, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(`${o.rt.city}, ${o.rt.province} ${o.rt.postal_code} · ${o.rt.address}`, W / 2 + 8, y + 11.5, { align: 'center' });
  y += 17;
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.8);
  doc.line(M, y, W - M, y);
  doc.setLineWidth(0.2);
  doc.line(M, y + 1.2, W - M, y + 1.2);

  // Judul
  y += 13;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  const title = o.type.name.toUpperCase();
  doc.text(title, W / 2, y, { align: 'center' });
  const tw = doc.getTextWidth(title);
  doc.setLineWidth(0.4);
  doc.line(W / 2 - tw / 2, y + 1.2, W / 2 + tw / 2, y + 1.2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`Nomor: ${o.letter.letter_number}`, W / 2, y + 7, { align: 'center' });

  // Isi
  y += 20;
  const para = (t: string) => {
    const lines = doc.splitTextToSize(t, W - M * 2);
    doc.text(lines, M, y, { lineHeightFactor: 1.5 });
    y += lines.length * 6.2 + 3;
  };
  para(`Yang bertanda tangan di bawah ini, Ketua RT ${o.rt.rt_number} RW ${o.rt.rw_number} Kelurahan ${o.rt.village}, Kecamatan ${o.rt.district}, ${o.rt.city}, dengan ini menerangkan bahwa:`);

  const r = o.resident;
  const rows: [string, string][] = [
    ['Nama lengkap', r.full_name],
    ['NIK', r.nik || '-'],
    ['Tempat, tanggal lahir', `${r.birth_place || '-'}, ${r.birth_date ? dateLong(r.birth_date) : '-'}`],
    ['Jenis kelamin', r.gender === 'L' ? 'Laki-laki' : 'Perempuan'],
    ['Pekerjaan', r.occupation || '-'],
    ['Alamat', `${o.household?.address ?? '-'}, RT ${o.rt.rt_number}/RW ${o.rt.rw_number}`],
  ];
  Object.entries(o.letter.form_data).forEach(([k, v]) => v && rows.push([k.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()), v]));
  rows.forEach(([k, v]) => {
    doc.text(k, M + 6, y);
    doc.text(':', M + 52, y);
    const lines = doc.splitTextToSize(v, W - M * 2 - 58);
    doc.text(lines, M + 56, y);
    y += Math.max(1, lines.length) * 6.4;
  });
  y += 4;
  para((STATEMENT[o.type.code] ?? STATEMENT.SP!)(r));
  para(`Surat keterangan ini dibuat untuk keperluan: ${o.letter.purpose}.`);
  para('Demikian surat ini dibuat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya.');

  // Tanda tangan
  y += 6;
  const sx = W - M - 62;
  doc.text(`${o.rt.city.replace('Kota ', '')}, ${dateLong(o.letter.completed_at ?? new Date())}`, sx, y);
  doc.text(`Ketua RT ${o.rt.rt_number} / RW ${o.rt.rw_number}`, sx, y + 6);
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.5);
  doc.roundedRect(sx, y + 10, 40, 14, 2, 2);
  doc.setFontSize(7.5);
  doc.setTextColor(37, 99, 235);
  doc.text('DISETUJUI SECARA DIGITAL', sx + 20, y + 16, { align: 'center' });
  doc.text('via WargaKu', sx + 20, y + 20, { align: 'center' });
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(o.ketua, sx, y + 32);
  const kw = doc.getTextWidth(o.ketua);
  doc.setLineWidth(0.3);
  doc.setDrawColor(15, 23, 42);
  doc.line(sx, y + 33, sx + kw, y + 33);

  // Kaki
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Diterbitkan melalui WargaKu · No. permohonan ${o.letter.request_number} · Dokumen contoh (mode demo)`, W / 2, 287, { align: 'center' });

  doc.save(`${o.letter.letter_number!.replace(/\//g, '-')}_${o.type.code}.pdf`);
}
