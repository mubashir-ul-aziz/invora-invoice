import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { LockedContentView } from '@/components/subscription/LockedContentView';
import { useCustomerStore } from '@/state/customerStore';
import { useInvoiceStore } from '@/state/invoiceStore';
import { usePaymentStore } from '@/state/paymentStore';
import { useSubscription } from '@/state/useSubscription';
import { colors } from '@/theme/colors';

/** The bits of a navigation prop the guards use. */
interface GuardNavigation {
  navigate: (screen: 'Pricing', params: { reason: 'locked_invoice' | 'locked_customer' }) => void;
  goBack: () => void;
}

interface GuardedProps {
  navigation: GuardNavigation;
}

function Spinner() {
  return (
    <View style={styles.centered} testID="access-guard-loading">
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

function formatCreated(createdAt: string): string {
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime())
    ? ''
    : `Created ${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

/**
 * Wraps a screen that opens ONE invoice (detail, edit, PDF, record payment…)
 * so a Free user can't open it once it's past the 24-hour window — including
 * via any list row, deep link or back-stack entry. One guard at the
 * navigator replaces per-screen checks, so a new invoice screen can't
 * forget it. The invoice itself is untouched; only access is withheld, and
 * the real screen appears the moment the plan (from `useSubscription`) allows
 * it — e.g. right after the user subscribes.
 *
 * `resolveInvoiceId` maps the screen's route params to an invoice id (a
 * payment screen resolves it through the payment). If the invoice can't be
 * found the wrapped screen renders as usual and shows its own "not found".
 */
export function withInvoiceAccessGuard<P extends GuardedProps>(
  Screen: React.ComponentType<P>,
  resolveInvoiceId: (props: P) => Promise<string | null>,
): React.ComponentType<P> {
  function InvoiceAccessGuard(props: P) {
    const subscription = useSubscription();
    const getInvoice = useInvoiceStore((state) => state.getById);
    const [invoice, setInvoice] = useState<{ number: string; createdAt: string } | null | 'loading'>('loading');

    useEffect(() => {
      let cancelled = false;
      (async () => {
        try {
          const id = await resolveInvoiceId(props);
          const found = id ? await getInvoice(id) : null;
          if (!cancelled) {
            setInvoice(found ? { number: found.invoiceNumber, createdAt: found.createdAt } : null);
          }
        } catch {
          if (!cancelled) {
            setInvoice(null);
          }
        }
      })();
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (!subscription.resolved || invoice === 'loading') {
      return <Spinner />;
    }
    if (invoice && !subscription.canAccessHistoricalInvoice(invoice.createdAt)) {
      return (
        <LockedContentView
          reason="locked_invoice"
          details={[`Invoice ${invoice.number}`, formatCreated(invoice.createdAt)].filter(Boolean)}
          onUpgrade={() => props.navigation.navigate('Pricing', { reason: 'locked_invoice' })}
          onBack={() => props.navigation.goBack()}
          testID="locked-invoice"
        />
      );
    }
    return <Screen {...props} />;
  }
  InvoiceAccessGuard.displayName = `InvoiceAccessGuard(${Screen.displayName ?? Screen.name ?? 'Screen'})`;
  return InvoiceAccessGuard;
}

/** For screens whose route params carry an `invoiceId`. */
export const byInvoiceId = async (props: { route: { params: { invoiceId: string } } }): Promise<string | null> =>
  props.route.params.invoiceId;

/** For screens whose route params carry a `paymentId`: a payment belongs to one invoice, and that invoice's lock applies. */
export const byPaymentId = async (props: { route: { params: { paymentId: string } } }): Promise<string | null> => {
  const payment = await usePaymentStore.getState().getById(props.route.params.paymentId);
  return payment?.invoiceId ?? null;
};

/**
 * Wraps the Customer History screen. Customer *contacts* are never locked
 * (Free users need them to create invoices); the historical timeline of a
 * customer's past invoices and payments needs a plan with historical
 * customer access.
 */
export function withCustomerHistoryGuard<P extends GuardedProps & { route: { params: { customerId: string } } }>(
  Screen: React.ComponentType<P>,
): React.ComponentType<P> {
  function CustomerHistoryGuard(props: P) {
    const subscription = useSubscription();
    const getCustomer = useCustomerStore((state) => state.getById);
    const [name, setName] = useState<string | null>(null);

    useEffect(() => {
      let cancelled = false;
      getCustomer(props.route.params.customerId)
        .then((customer) => !cancelled && setName(customer?.name ?? null))
        .catch(() => undefined);
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (!subscription.resolved) {
      return <Spinner />;
    }
    if (!subscription.canAccessHistoricalCustomer()) {
      return (
        <LockedContentView
          reason="locked_customer"
          details={name ? [name] : undefined}
          onUpgrade={() => props.navigation.navigate('Pricing', { reason: 'locked_customer' })}
          onBack={() => props.navigation.goBack()}
          testID="locked-customer-history"
        />
      );
    }
    return <Screen {...props} />;
  }
  CustomerHistoryGuard.displayName = `CustomerHistoryGuard(${Screen.displayName ?? Screen.name ?? 'Screen'})`;
  return CustomerHistoryGuard;
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});
