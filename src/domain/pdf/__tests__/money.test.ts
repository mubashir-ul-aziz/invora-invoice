import { formatMoney } from '../money';

describe('formatMoney', () => {
  it('formats with 2 decimals and the currency code prefix', () => {
    expect(formatMoney(500, 'USD')).toBe('USD 500.00');
  });

  it('groups thousands', () => {
    expect(formatMoney(1234567.5, 'USD')).toBe('USD 1,234,567.50');
  });

  it('formats zero', () => {
    expect(formatMoney(0, 'EUR')).toBe('EUR 0.00');
  });

  it('formats negative amounts with a leading minus, not a negative-looking group', () => {
    expect(formatMoney(-42.5, 'GBP')).toBe('GBP -42.50');
  });
});
