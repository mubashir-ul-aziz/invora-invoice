import { formatStorageUsage, storageUsageRatio } from '../formatting';

describe('formatStorageUsage', () => {
  it('formats used/limit as "X of Y used"', () => {
    expect(formatStorageUsage({ usedBytes: 1024, limitBytes: 1024 * 1024, planId: 'free' })).toBe(
      '1.0 KB of 1.0 MB used',
    );
  });

  it('formats zero usage', () => {
    expect(formatStorageUsage({ usedBytes: 0, limitBytes: 1024, planId: 'free' })).toBe('0 B of 1.0 KB used');
  });
});

describe('storageUsageRatio', () => {
  it('computes a 0-1 fraction', () => {
    expect(storageUsageRatio({ usedBytes: 50, limitBytes: 100, planId: 'free' })).toBe(0.5);
  });

  it('clamps to 1 when usage exceeds the limit', () => {
    expect(storageUsageRatio({ usedBytes: 150, limitBytes: 100, planId: 'free' })).toBe(1);
  });

  it('returns 0 for a non-positive limit instead of dividing by zero', () => {
    expect(storageUsageRatio({ usedBytes: 10, limitBytes: 0, planId: 'free' })).toBe(0);
  });
});
