import { assertLinesMatchPricingMethod, PricingMethodMismatchError } from '../integrity';

describe('assertLinesMatchPricingMethod', () => {
  it('passes silently when every line matches the invoice pricing method', () => {
    expect(() =>
      assertLinesMatchPricingMethod('weight', [{ pricingMethodId: 'weight' }, { pricingMethodId: 'weight' }]),
    ).not.toThrow();
  });

  it('passes silently when a line has no pricingMethodId set (inherits the invoice method)', () => {
    expect(() => assertLinesMatchPricingMethod('weight', [{}, { pricingMethodId: undefined }])).not.toThrow();
  });

  it('throws a PricingMethodMismatchError for a mismatched line', () => {
    expect(() =>
      assertLinesMatchPricingMethod('weight', [{ pricingMethodId: 'weight' }, { pricingMethodId: 'area' }]),
    ).toThrow(PricingMethodMismatchError);
  });

  it("the error message identifies which line and which two methods conflicted", () => {
    try {
      assertLinesMatchPricingMethod('weight', [{ pricingMethodId: 'area' }]);
      throw new Error('expected assertLinesMatchPricingMethod to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(PricingMethodMismatchError);
      expect((err as Error).message).toMatch(/line 1/i);
      expect((err as Error).message).toMatch(/"area"/);
      expect((err as Error).message).toMatch(/"weight"/);
    }
  });
});
