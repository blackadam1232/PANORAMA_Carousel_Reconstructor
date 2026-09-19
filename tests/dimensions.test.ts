import { describe, expect, it } from 'vitest';
import { calculateOutputDimensions } from '@/lib/dimensions';

describe('calculateOutputDimensions', () => {
  it('joins two 1080x1350 slides directly', () => {
    expect(calculateOutputDimensions([{ width: 1080, height: 1350 }, { width: 1080, height: 1350 }], [0], 'horizontal')).toMatchObject({ width: 2160, height: 1350 });
  });
  it('joins three slides directly', () => {
    expect(calculateOutputDimensions(Array.from({ length: 3 }, () => ({ width: 1080, height: 1350 })), [0, 0], 'horizontal')).toMatchObject({ width: 3240, height: 1350 });
  });
  it('removes a 40px overlap', () => {
    expect(calculateOutputDimensions([{ width: 1080, height: 1350 }, { width: 1080, height: 1350 }], [40], 'horizontal')).toMatchObject({ width: 2120, height: 1350 });
  });
  it('supports vertical stitching', () => {
    expect(calculateOutputDimensions([{ width: 900, height: 1000 }, { width: 900, height: 1000 }], [20], 'vertical')).toMatchObject({ width: 900, height: 1980 });
  });
});
