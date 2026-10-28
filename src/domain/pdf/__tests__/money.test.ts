import { formatMoney } from '../money';

describe('formatMoney', () => {
  it('formats with 2 decimals and the currency symbol prefix', () => {
    expect(formatMoney(500, 'USD')).toBe('$500.00');
  });

  it('groups thousands', () => {
    expect(formatMoney(1234567.5, 'USD')).toBe('$1,234,567.50');
    expect(formatMoney(3000, 'EUR')).toBe('€3,000.00');
  });

  it('formats zero', () => {
    expect(formatMoney(0, 'EUR')).toBe('€0.00');
  });

  it('formats negative amounts with a leading minus before the symbol', () => {
    expect(formatMoney(-42.5, 'GBP')).toBe('-£42.50');
  });
});
