/**
 * Why the user was sent to the Pricing screen. Drives the contextual banner
 * there, so every "you need to upgrade" moment reads the same everywhere and
 * the copy lives in one file.
 */
export type UpgradeReason = 'invoice_limit' | 'locked_invoice' | 'locked_customer';

export interface UpgradeReasonCopy {
  title: string;
  message: string;
}

export function describeUpgradeReason(reason: UpgradeReason, context?: { limit?: number | null }): UpgradeReasonCopy {
  switch (reason) {
    case 'invoice_limit':
      return {
        title: 'Monthly invoice limit reached',
        message:
          context?.limit != null
            ? `Your plan includes ${context.limit} invoices a month. Upgrade to create more — your existing invoices are safe.`
            : 'Upgrade to create more invoices this month — your existing invoices are safe.',
      };
    case 'locked_invoice':
      return {
        title: 'Historical invoices are locked',
        message:
          'Free plans can open an invoice for 24 hours after it is created. Upgrade to open older invoices — nothing has been deleted.',
      };
    case 'locked_customer':
      return {
        title: 'Customer history is locked',
        message:
          'Customer history is part of a paid plan. Your customers and their invoices are still saved on this device.',
      };
  }
}
