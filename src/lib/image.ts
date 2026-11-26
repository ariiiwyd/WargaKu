/** Perkecil gambar sebelum disimpan (mode demo menyimpan ke localStorage). */
export async function compressImage(file: File, max = 1000, quality = 0.72): Promise<string> {
  if (file.type === 'application/pdf') {
    if (file.size > 600_000) throw new Error('PDF terlalu besar untuk mode demo (maks. 600 KB)');
    return await new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result as string);
      fr.onerror = () => rej(new Error('Gagal membaca file'));
      fr.readAsDataURL(file);
    });
  }
  if (!file.type.startsWith('image/')) throw new Error('Format file harus JPG, PNG, WEBP, atau PDF');
  if (file.size > 8_000_000) throw new Error('Ukuran file maksimal 8 MB');
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', quality);
}
