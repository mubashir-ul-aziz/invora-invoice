import type { PurchaseOutcome, RestoreOutcome } from '@/data/subscription/SubscriptionService';
import { INITIAL_SNAPSHOT } from '@/domain/subscription/types';

import { purchaseOutcomeMessage, restoreOutcomeMessage } from '../outcomeMessages';

const snapshot = INITIAL_SNAPSHOT;

describe('purchaseOutcomeMessage', () => {
  const outcomes: PurchaseOutcome[] = [
    { status: 'success', snapshot },
    { status: 'scheduled', snapshot, effectiveAt: null },
    { status: 'not_allowed' },
    { status: 'pending' },
    { status: 'cancelled' },
    { status: 'already_subscribed', snapshot },
    { status: 'network_error' },
    { status: 'store_unavailable' },
    { status: 'product_unavailable' },
    { status: 'unavailable' },
    { status: 'failed', message: 'boom' },
  ];

  it('uses success wording only for a confirmed success', () => {
    for (const outcome of outcomes) {
      const message = purchaseOutcomeMessage(outcome, 'Business');
      const text = message ? `${message.title} ${message.message}` : '';
      const claimsSuccess = /is active|confirmed and unlocked|thank you/i.test(text);
      expect(claimsSuccess).toBe(outcome.status === 'success');
    }
  });

  it('is silent when the user cancels', () => {
    expect(purchaseOutcomeMessage({ status: 'cancelled' }, 'Pro')).toBeNull();
  });

  it('says a pending payment has not unlocked anything', () => {
    expect(purchaseOutcomeMessage({ status: 'pending' }, 'Pro')?.message).toMatch(/not unlocked/);
  });

  it('reassures the user on connection errors and keeps technical failure detail to development builds', () => {
    expect(purchaseOutcomeMessage({ status: 'network_error' }, 'Pro')?.message).toMatch(/not been charged/);
    const failed = purchaseOutcomeMessage({ status: 'failed', message: 'PurchasesError(code=StoreProblemError)' }, 'Pro')!.message;
    expect(failed).toMatch(/^The purchase couldn't be completed and you have not been charged/);
    // Jest runs as a development build, so the detail is appended under a [Development] label only.
    expect(failed).toContain('[Development] PurchasesError(code=StoreProblemError)');
  });

  it('explains a not-allowed purchase without RevenueCat jargon', () => {
    const message = purchaseOutcomeMessage({ status: 'not_allowed' }, 'Pro')!;
    expect(message.title).toBe('Purchase not allowed');
    expect(message.message).not.toMatch(/RevenueCat|Test Store|PurchasesError/);
  });

  it('says when a scheduled change starts, from RevenueCat's expiry date', () => {
    const at = new Date(2026, 10, 12).getTime();
    const message = purchaseOutcomeMessage({ status: 'scheduled', snapshot, effectiveAt: at }, 'Pro')!.message;
    expect(message).toContain('Pro starts on');
    expect(message).toContain(new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }));
    expect(purchaseOutcomeMessage({ status: 'scheduled', snapshot, effectiveAt: null }, 'Pro')!.message).toContain('at your next renewal');
  });

  it('never mentions the Test Store or RevenueCat internals to users', () => {
    for (const outcome of outcomes) {
      const message = purchaseOutcomeMessage(outcome, 'Pro');
      expect(message?.title ?? '').not.toMatch(/Test Store/);
      expect((message?.message ?? '').split('[Development]')[0]).not.toMatch(/Test Store|RevenueCat/);
    }
  });
});

describe('restoreOutcomeMessage', () => {
  it('has an honest message for every outcome', () => {
    const outcomes: RestoreOutcome[] = [
      { status: 'restored', snapshot },
      { status: 'already_active', snapshot },
      { status: 'nothing_to_restore', snapshot },
      { status: 'network_error' },
      { status: 'store_unavailable' },
      { status: 'unavailable' },
      { status: 'failed', message: 'oops' },
    ];
    for (const outcome of outcomes) {
      const message = restoreOutcomeMessage(outcome);
      expect(message.title.length).toBeGreaterThan(0);
      expect(message.message.length).toBeGreaterThan(0);
    }
    expect(restoreOutcomeMessage({ status: 'restored', snapshot }).title).toBe('Purchases restored');
    expect(restoreOutcomeMessage({ status: 'nothing_to_restore', snapshot }).title).toBe('Nothing to restore');
  });
});
