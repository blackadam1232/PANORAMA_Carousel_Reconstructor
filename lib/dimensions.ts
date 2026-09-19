import type { Orientation, OutputEstimate } from '@/types/panorama';

export function appliedOverlap(manual: number | null, detected: number): number {
  return Math.max(0, manual ?? detected);
}

export function calculateOutputDimensions(
  images: Array<{ width: number; height: number }>,
  overlaps: number[],
  orientation: Orientation,
): OutputEstimate {
  if (images.length === 0) return { width: 0, height: 0, pixelCount: 0, estimatedBytes: 0 };

  const overlapTotal = overlaps.reduce((sum, value) => sum + value, 0);
  const width = orientation === 'horizontal'
    ? Math.max(1, images.reduce((sum, image) => sum + image.width, 0) - overlapTotal)
    : Math.max(...images.map((image) => image.width));
  const height = orientation === 'vertical'
    ? Math.max(1, images.reduce((sum, image) => sum + image.height, 0) - overlapTotal)
    : Math.max(...images.map((image) => image.height));

  const pixelCount = width * height;
  return { width, height, pixelCount, estimatedBytes: pixelCount * 4 };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = units[0];
  for (let i = 1; i < units.length && value >= 1024; i += 1) {
    value /= 1024;
    unit = units[i];
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${unit}`;
}

export function isPotentiallyUnsafe(estimate: OutputEstimate): boolean {
  return estimate.width > 32767 || estimate.height > 32767 || estimate.pixelCount > 100_000_000;
}
