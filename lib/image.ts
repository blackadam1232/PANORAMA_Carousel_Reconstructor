import type { Orientation, SeamState, SlideItem } from '@/types/panorama';

export async function loadSlide(file: File, order: number): Promise<SlideItem> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error(`${file.name} is not a supported image. Please use JPG, PNG, or WEBP.`);
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const bitmap = await createImageBitmap(file);
    const item: SlideItem = {
      id: crypto.randomUUID(), file, name: file.name, objectUrl,
      width: bitmap.width, height: bitmap.height, size: file.size, order,
    };
    bitmap.close();
    return item;
  } catch {
    URL.revokeObjectURL(objectUrl);
    throw new Error(`${file.name} could not be decoded by this browser.`);
  }
}

async function bitmapFor(slide: SlideItem): Promise<ImageBitmap> {
  return createImageBitmap(slide.file);
}

export async function detectOverlap(
  left: SlideItem,
  right: SlideItem,
  orientation: Orientation,
): Promise<{ overlap: number; confidence: number }> {
  const [a, b] = await Promise.all([bitmapFor(left), bitmapFor(right)]);
  try {
    const sampleLong = 420;
    const aRatio = Math.min(1, sampleLong / Math.max(a.width, a.height));
    const bRatio = Math.min(1, sampleLong / Math.max(b.width, b.height));
    const aw = Math.max(1, Math.round(a.width * aRatio));
    const ah = Math.max(1, Math.round(a.height * aRatio));
    const bw = Math.max(1, Math.round(b.width * bRatio));
    const bh = Math.max(1, Math.round(b.height * bRatio));

    const ca = document.createElement('canvas'); ca.width = aw; ca.height = ah;
    const cb = document.createElement('canvas'); cb.width = bw; cb.height = bh;
    ca.getContext('2d', { willReadFrequently: true })!.drawImage(a, 0, 0, aw, ah);
    cb.getContext('2d', { willReadFrequently: true })!.drawImage(b, 0, 0, bw, bh);
    const ctxA = ca.getContext('2d', { willReadFrequently: true })!;
    const ctxB = cb.getContext('2d', { willReadFrequently: true })!;

    const maxOverlap = Math.floor((orientation === 'horizontal' ? Math.min(aw, bw) : Math.min(ah, bh)) * 0.3);
    const minOverlap = Math.max(2, Math.floor(maxOverlap * 0.08));
    let best = { score: Number.POSITIVE_INFINITY, overlap: 0 };
    let second = Number.POSITIVE_INFINITY;

    for (let overlap = minOverlap; overlap <= maxOverlap; overlap += 2) {
      let dataA: ImageData;
      let dataB: ImageData;
      if (orientation === 'horizontal') {
        const h = Math.min(ah, bh);
        dataA = ctxA.getImageData(aw - overlap, 0, overlap, h);
        dataB = ctxB.getImageData(0, 0, overlap, h);
      } else {
        const w = Math.min(aw, bw);
        dataA = ctxA.getImageData(0, ah - overlap, w, overlap);
        dataB = ctxB.getImageData(0, 0, w, overlap);
      }
      let total = 0;
      const stride = 16;
      for (let i = 0; i < dataA.data.length; i += stride) {
        total += Math.abs(dataA.data[i] - dataB.data[i]);
        total += Math.abs(dataA.data[i + 1] - dataB.data[i + 1]);
        total += Math.abs(dataA.data[i + 2] - dataB.data[i + 2]);
      }
      const score = total / Math.max(1, dataA.data.length / stride);
      if (score < best.score) { second = best.score; best = { score, overlap }; }
      else if (score < second) second = score;
    }

    const absoluteSimilarity = Math.max(0, Math.min(1, 1 - best.score / 150));
    const separation = Number.isFinite(second) && second > 0 ? Math.max(0, Math.min(1, (second - best.score) / second)) : 0;
    const confidence = Math.round((absoluteSimilarity * 0.8 + separation * 0.2) * 100);
    const scaleBack = orientation === 'horizontal' ? left.width / aw : left.height / ah;
    return { overlap: Math.round(best.overlap * scaleBack), confidence };
  } finally {
    a.close(); b.close();
  }
}

export async function buildPanorama(
  slides: SlideItem[], seams: SeamState[], orientation: Orientation,
): Promise<HTMLCanvasElement> {
  const bitmaps = await Promise.all(slides.map(bitmapFor));
  try {
    const overlaps = seams.map((s) => s.manualOverlap ?? s.detectedOverlap);
    const width = orientation === 'horizontal'
      ? slides.reduce((sum, s) => sum + s.width, 0) - overlaps.reduce((a, b) => a + b, 0)
      : Math.max(...slides.map((s) => s.width));
    const height = orientation === 'vertical'
      ? slides.reduce((sum, s) => sum + s.height, 0) - overlaps.reduce((a, b) => a + b, 0)
      : Math.max(...slides.map((s) => s.height));
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('This browser could not create a drawing surface.');
    let x = 0; let y = 0;
    bitmaps.forEach((bitmap, index) => {
      const overlap = index === 0 ? 0 : overlaps[index - 1] ?? 0;
      if (orientation === 'horizontal') {
        const crop = Math.min(Math.max(0, overlap), bitmap.width - 1);
        if (overlap < 0) x += -overlap;
        ctx.drawImage(bitmap, crop, 0, bitmap.width - crop, bitmap.height, x, 0, bitmap.width - crop, bitmap.height);
        x += bitmap.width - crop;
      } else {
        const crop = Math.min(Math.max(0, overlap), bitmap.height - 1);
        if (overlap < 0) y += -overlap;
        ctx.drawImage(bitmap, 0, crop, bitmap.width, bitmap.height - crop, 0, y, bitmap.width, bitmap.height - crop);
        y += bitmap.height - crop;
      }
    });
    return canvas;
  } finally { bitmaps.forEach((b) => b.close()); }
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: 'image/png' | 'image/jpeg', quality = 0.98): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Your browser could not export this panorama.')), type, quality);
  });
}
