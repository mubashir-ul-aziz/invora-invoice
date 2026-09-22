import { getPlanConfig, type PlanId } from './plans';

/**
 * Customer access rules.
 *
 * A customer record is a *contact* and is never locked: Free users must be
 * able to pick, create and edit customers to issue invoices. What Free
 * restricts is *historical customer information* — the Customer History
 * timeline and older invoices listed on Customer Detail.
 * Nothing here deletes or hides stored customer data; it only gates views.
 */
export interface CustomerAccess {
  /** Always true — needed to create invoices. */
  canPickAndManageCustomers: true;
  /** Customer History timeline + historical invoices/payments under a customer. */
  canViewCustomerHistory: boolean;
}

export function getCustomerAccess(plan: PlanId): CustomerAccess {
  return {
    canPickAndManageCustomers: true,
    canViewCustomerHistory: getPlanConfig(plan).historicalCustomerAccess,
  };
}

export function canAccessHistoricalCustomer(plan: PlanId): boolean {
  return getCustomerAccess(plan).canViewCustomerHistory;
}

/** Whether `plan` may use an invoice pricing method. Every plan currently gets every method. */
export function canUsePricingMethod(plan: PlanId, pricingMethodId: string): boolean {
  const allowed = getPlanConfig(plan).allowedPricingMethods;
  return allowed === 'all' || allowed.includes(pricingMethodId);
}
