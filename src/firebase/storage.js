import { MAX_IMAGE_CHARS } from '../../utils/validation.js';

export const imageUploadEnabled = import.meta.env.VITE_ENABLE_IMAGE_UPLOAD !== 'false';

const MAX_SIDE = 240;

export async function uploadReportImage(file) {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Choose an image smaller than 10 MB.');

  let bitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error('This image format is not supported. Use a JPG or PNG photo.'); }

  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();

  for (const quality of [0.6, 0.45, 0.3]) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.length <= MAX_IMAGE_CHARS) return dataUrl;
  }
  throw new Error('That photo is too detailed to shrink. Try another one.');
}