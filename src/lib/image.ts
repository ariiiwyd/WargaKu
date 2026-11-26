export interface PreparedFile {
  blob: Blob;
  ext: string;
  /** object URL untuk pratinjau lokal (gambar saja) */
  preview: string | null;
  name: string;
}

/** Siapkan bukti transfer: gambar diperkecil (maks 1600px, JPEG), PDF diteruskan apa adanya (maks 5 MB). */
export async function prepareProof(file: File, max = 1600, quality = 0.8): Promise<PreparedFile> {
  if (file.type === 'application/pdf') {
    if (file.size > 5_000_000) throw new Error('Ukuran PDF maksimal 5 MB');
    return { blob: file, ext: 'pdf', preview: null, name: file.name };
  }
  if (!file.type.startsWith('image/')) throw new Error('Format file harus JPG, PNG, WEBP, atau PDF');
  if (file.size > 15_000_000) throw new Error('Ukuran gambar maksimal 15 MB');
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Gagal memproses gambar'))), 'image/jpeg', quality));
  if (blob.size > 5_000_000) throw new Error('Gambar terlalu besar setelah diperkecil (maks 5 MB)');
  return { blob, ext: 'jpg', preview: URL.createObjectURL(blob), name: file.name };
}
