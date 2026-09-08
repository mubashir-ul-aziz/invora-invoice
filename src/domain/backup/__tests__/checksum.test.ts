import { computeChecksum } from '../checksum';

describe('computeChecksum', () => {
  it('is deterministic for the same input', () => {
    const content = JSON.stringify({ a: 1, b: [1, 2, 3] });
    expect(computeChecksum(content)).toBe(computeChecksum(content));
  });

  it('changes when a single character changes (detects corruption)', () => {
    const a = computeChecksum('{"business":[{"id":"1"}]}');
    const b = computeChecksum('{"business":[{"id":"2"}]}');
    expect(a).not.toBe(b);
  });

  it('changes when content is truncated (detects an interrupted write)', () => {
    const full = JSON.stringify({ items: Array.from({ length: 50 }, (_, i) => ({ id: i })) });
    const truncated = full.slice(0, full.length - 20);
    expect(computeChecksum(full)).not.toBe(computeChecksum(truncated));
  });

  it('handles an empty string', () => {
    expect(typeof computeChecksum('')).toBe('string');
    expect(computeChecksum('')).toHaveLength(8);
  });
});
