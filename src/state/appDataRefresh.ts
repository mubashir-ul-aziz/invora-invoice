import { useBusinessCardStore } from './businessCardStore';
import { useBusinessProfileStore } from './businessProfileStore';
import { useCustomUnitsStore } from './customUnitsStore';
import { useCustomerStore } from './customerStore';
import { useDashboardStore } from './dashboardStore';
import { useInvoiceDraftStore } from './invoiceDraftStore';
import { useInvoiceSettingsStore } from './invoiceSettingsStore';
import { useInvoiceStore } from './invoiceStore';
import { useInvoiceTypeStore } from './invoiceTypeStore';
import { useItemStore } from './itemStore';
import { usePaymentStore } from './paymentStore';
import { useSubscriptionStore } from './subscriptionStore';

/**
 * After a restore replaced the database, every store still holds the old
 * data in memory. This reloads each one from the (restored) database —
 * best-effort, one failure doesn't stop the rest — drops any half-written
 * invoice draft (it may reference customers/items that no longer exist),
 * and re-checks the subscription with RevenueCat. Per-customer stores
 * (activity, balances) reload themselves when their screen opens.
 */
export async function refreshAppDataAfterRestore(): Promise<void> {
  const loaders: (() => Promise<void>)[] = [
    useBusinessCardStore.getState().load,
    useBusinessProfileStore.getState().load,
    useCustomUnitsStore.getState().load,
    useCustomerStore.getState().load,
    useDashboardStore.getState().load,
    useInvoiceSettingsStore.getState().load,
    useInvoiceStore.getState().load,
    useInvoiceTypeStore.getState().load,
    useItemStore.getState().load,
    usePaymentStore.getState().load,
  ];
  useInvoiceDraftStore.getState().reset();
  await Promise.all(loaders.map((load) => load().catch(() => undefined)));
  await useSubscriptionStore.getState().refreshAfterRestore();
}
