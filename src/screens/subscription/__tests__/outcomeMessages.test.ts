import type { PurchaseOutcome, RestoreOutcome } from '@/data/subscription/SubscriptionService';
import { INITIAL_SNAPSHOT } from '@/domain/subscription/types';

import { purchaseOutcomeMessage, restoreOutcomeMessage } from '../outcomeMessages';

const snapshot = INITIAL_SNAPSHOT;

describe('purchaseOutcomeMessage', () => {
  const outcomes: PurchaseOutcome[] = [
    { status: 'success', snapshot },
    { status: 'scheduled', snapshot },
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

  it('reassures the user on connection errors and passes an unexpected failure message through', () => {
    expect(purchaseOutcomeMessage({ status: 'network_error' }, 'Pro')?.message).toMatch(/not been charged/);
    expect(purchaseOutcomeMessage({ status: 'failed', message: 'boom' }, 'Pro')?.message).toBe('boom');
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
