// Shrinks photos before upload so slow/cheap connections don't choke (max 1280px, JPEG).
// Throws a plain Error if the browser can't decode the file (e.g. HEIC on some Android browsers).
export async function compressImage(file: File, maxSide = 1280, quality = 0.8): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("not an image");
  const bmp = await createImageBitmap(file);           // honours EXIF rotation in modern browsers
  try {
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bmp.width * scale));
    canvas.height = Math.max(1, Math.round(bmp.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("compress failed"))), "image/jpeg", quality));
  } finally {
    bmp.close();
  }
}
