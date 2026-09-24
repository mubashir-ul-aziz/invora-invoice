import React, { useCallback, useState } from 'react';

import type { UpgradeReason } from '@/domain/subscription/upgradeReason';
import { useSubscription } from '@/state/useSubscription';

import { InvoiceLimitModal } from './InvoiceLimitModal';

interface PricingNavigation {
  navigate: (screen: 'Pricing', params: { reason: UpgradeReason }) => void;
}

/**
 * The shared "starting a new invoice" guard every entry point (Dashboard,
 * Invoice List, Customer Detail, Duplicate) uses — one place wiring
 * `useSubscription().guardInvoiceCreation()` to the `InvoiceLimitModal`, so no
 * screen re-implements the modal's open/close state or re-checks the limit
 * itself (see rule against duplicating `if (plan === ...)`-style logic).
 *
 * Usage: `const { guard, modal } = useInvoiceLimitGuard(navigation); guard(startCreateInvoice);`
 * then render `{modal}` once, anywhere in the screen's JSX.
 */
export function useInvoiceLimitGuard(navigation: PricingNavigation) {
  const subscription = useSubscription();
  const [visible, setVisible] = useState(false);

  const guard = useCallback(
    (proceed: () => void) => {
      subscription.guardInvoiceCreation(navigation, proceed, () => setVisible(true));
    },
    [subscription, navigation],
  );

  const modal = (
    <InvoiceLimitModal
      visible={visible}
      usage={subscription.usage}
      planLabel={subscription.planConfig.label}
      onDismiss={() => setVisible(false)}
      onUpgrade={() => {
        setVisible(false);
        navigation.navigate('Pricing', { reason: 'invoice_limit' });
      }}
    />
  );

  return { guard, modal };
}
