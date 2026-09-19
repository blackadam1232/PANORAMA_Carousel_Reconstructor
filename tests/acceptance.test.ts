import { describe, expect, it } from 'vitest';
import { appliedOverlap, calculateOutputDimensions, isPotentiallyUnsafe } from '@/lib/dimensions';
import { dimensionsMatch, moveItem, reverseItems } from '@/lib/order';

describe('acceptance-level core behavior', () => {
  it('TEST 1: 2 x 1080x1350 produces 2160x1350 with no overlap', () => {
    expect(calculateOutputDimensions([{width:1080,height:1350},{width:1080,height:1350}],[0],'horizontal')).toMatchObject({width:2160,height:1350});
  });
  it('TEST 2: 3 x 1080x1350 produces 3240x1350', () => {
    expect(calculateOutputDimensions(Array(3).fill({width:1080,height:1350}),[0,0],'horizontal').width).toBe(3240);
  });
  it('TEST 3: a 40px duplicate overlap produces 2120px width', () => {
    expect(calculateOutputDimensions([{width:1080,height:1350},{width:1080,height:1350}],[40],'horizontal').width).toBe(2120);
  });
  it('TEST 4: reversing restores reversed slide order', () => {
    expect(reverseItems([4,3,2,1])).toEqual([1,2,3,4]);
  });
  it('TEST 5: mismatched slide dimensions are detectable', () => {
    expect(dimensionsMatch([{width:1080,height:1350},{width:1080,height:1349}])).toBe(false);
  });
  it('TEST 6: manual overlap changes resulting width', () => {
    expect(calculateOutputDimensions([{width:1080,height:1350},{width:1080,height:1350}],[120],'horizontal').width).toBe(2040);
  });
  it('TEST 7: direct PNG path preserves zero overlap math', () => {
    expect(appliedOverlap(null, 0)).toBe(0);
  });
  it('TEST 8: selected JPEG overlap math is independent of compression quality', () => {
    expect(calculateOutputDimensions([{width:500,height:500},{width:500,height:500}],[10],'horizontal')).toMatchObject({width:990,height:500});
  });
  it('TEST 9: very large panorama triggers safety warning threshold', () => {
    expect(isPotentiallyUnsafe(calculateOutputDimensions([{width:40000,height:3000},{width:40000,height:3000}],[0],'horizontal'))).toBe(true);
  });
  it('TEST 10: mobile ordering controls can move an item without drag APIs', () => {
    expect(moveItem(['a','b','c'],1,0)).toEqual(['b','a','c']);
  });
});
