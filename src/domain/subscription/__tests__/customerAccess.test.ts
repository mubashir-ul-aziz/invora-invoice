import { INVOICE_TYPE_IDS } from '@/domain/invoiceType/invoiceTypeRegistry';

import { canAccessHistoricalCustomer, canUsePricingMethod, getCustomerAccess } from '../customerAccess';
import { PLAN_ORDER } from '../plans';

describe('customer access', () => {
  it('always lets every plan pick and manage customers so invoicing never breaks', () => {
    for (const plan of PLAN_ORDER) {
      expect(getCustomerAccess(plan).canPickAndManageCustomers).toBe(true);
    }
  });

  it('restricts historical customer information on Free only', () => {
    expect(canAccessHistoricalCustomer('free')).toBe(false);
    for (const plan of PLAN_ORDER.filter((p) => p !== 'free')) {
      expect(canAccessHistoricalCustomer(plan)).toBe(true);
    }
  });
});

describe('canUsePricingMethod', () => {
  it('leaves every existing pricing method available on every plan', () => {
    for (const plan of PLAN_ORDER) {
      for (const methodId of INVOICE_TYPE_IDS) {
        expect(canUsePricingMethod(plan, methodId)).toBe(true);
      }
    }
  });
});
