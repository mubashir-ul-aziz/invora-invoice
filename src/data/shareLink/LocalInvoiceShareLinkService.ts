import * as Linking from 'expo-linking';

import type { Invoice } from '@/domain/invoice/types';

import type { InvoiceShareLinkService } from './InvoiceShareLinkService';

/**
 * Backend-free implementation, same reasoning as `LocalShareLinkService`
 * (Phase 1): builds a deep link from the app's own `invora://` scheme via
 * `expo-linking`, resolving to whatever transport is actually available
 * right now (a real `invora://` URI in a standalone/dev-client build, an
 * `exp://…` Expo Go URL in development) — never a hard-coded production
 * domain that doesn't exist. Works fully offline: no network call is made to
 * produce it. Per the explicit Phase 9 instructions ("do not make PDF
 * generation dependent on your backend", "do not implement complex online
 * payment links"), this deliberately doesn't stand up a hosted redirect
 * service — see `MVP_BUILD_PLAN.md`'s "server-hosted share links" open
 * decision for the future `RemoteInvoiceShareLinkService` path if that's
 * ever confirmed.
 */
export class LocalInvoiceShareLinkService implements InvoiceShareLinkService {
  getShareLink(invoice: Invoice): string {
    return Linking.createURL(`invoice/${invoice.id}`);
  }
}
