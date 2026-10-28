import { formatAmount, formatCurrency, getCurrencySymbol } from '../currency';

describe('formatCurrency', () => {
  it('uses the currency symbol and thousands separators', () => {
    expect(formatCurrency(3000, 'EUR')).toBe('€3,000.00');
    expect(formatCurrency(1234567.891, 'USD')).toBe('$1,234,567.89');
    expect(formatCurrency(999.5, 'GBP')).toBe('£999.50');
  });

  it('puts the minus sign before the symbol', () => {
    expect(formatCurrency(-1500, 'EUR')).toBe('-€1,500.00');
  });

  it('falls back to the code for currencies without a known symbol, and to $ when unknown', () => {
    expect(formatCurrency(10, 'XYZ')).toBe('XYZ10.00');
    expect(formatCurrency(10, null)).toBe('$10.00');
  });
});

describe('formatAmount', () => {
  it('groups the integer part only', () => {
    expect(formatAmount(1000000)).toBe('1,000,000.00');
    expect(formatAmount(100.123)).toBe('100.12');
    expect(formatAmount(-2500)).toBe('2,500.00');
  });
});

describe('getCurrencySymbol', () => {
  it('maps known codes case-insensitively', () => {
    expect(getCurrencySymbol(' eur ')).toBe('€');
  });
});
