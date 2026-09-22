import { canAccessHistoricalCustomer, canUsePricingMethod } from '@/domain/subscription/customerAccess';
import {
  InvoiceLimitError,
  computeInvoiceUsage,
  createdAtToMs,
  decideInvoiceCreation,
  getInvoiceAccess,
  type InvoiceAccess,
  type InvoiceCreationDecision,
  type InvoiceUsage,
} from '@/domain/subscription/invoiceAccess';
import { effectiveNow } from '@/domain/subscription/offlinePolicy';
import { getPlanConfig, type PlanConfig, type PlanId } from '@/domain/subscription/plans';
import type { SubscriptionSnapshot } from '@/domain/subscription/types';

import type { InvoiceUsageTracker } from './InvoiceUsageTracker';

/**
 * What `invoiceStore.create()` needs from the subscription layer, and nothing
 * more — so the invoice store depends on this two-method interface, not on
 * RevenueCat, plans or usage internals.
 */
export interface InvoiceCreationGate {
  /** Throws `InvoiceLimitError` when the plan's monthly limit is reached. */
  assertCanCreate(): Promise<void>;
  /** Call once an invoice was actually persisted. */
  recordCreated(): Promise<void>;
}

/**
 * The one place business code asks "is the user allowed to…?". It combines
 * the current plan (from `SubscriptionService`, which itself answers to
 * RevenueCat) with the pure rules in `domain/subscription`, and reads
 * invoice usage from SQLite via `InvoiceUsageTracker`. Screens call these
 * methods (through `useSubscription()`); none of them branch on plan names.
 *
 * Every decision uses the *effective* plan, so a paid user who is offline is
 * judged by the documented offline policy, not silently downgraded.
 */
export class EntitlementService implements InvoiceCreationGate {
  private usageListeners = new Set<() => void>();

  constructor(
    private readonly subscription: { getSnapshot(): SubscriptionSnapshot },
    private readonly usage: Pick<InvoiceUsageTracker, 'getUsage' | 'recordCreated'>,
    private readonly now: () => number = Date.now,
  ) {}

  getPlan(): PlanId {
    return this.subscription.getSnapshot().plan;
  }

  getPlanConfig(): PlanConfig {
    return getPlanConfig(this.getPlan());
  }

  /** Device time, never earlier than the latest time already seen (defeats a rolled-back clock). */
  private currentTime(): number {
    return effectiveNow(this.now(), this.subscription.getSnapshot().clockHighWaterMs);
  }

  async getInvoiceUsage(): Promise<InvoiceUsage> {
    const { used, period } = await this.usage.getUsage();
    return computeInvoiceUsage(this.getPlan(), used, period);
  }

  async canCreateInvoice(): Promise<InvoiceCreationDecision> {
    return decideInvoiceCreation(await this.getInvoiceUsage());
  }

  async assertCanCreate(): Promise<void> {
    const decision = await this.canCreateInvoice();
    if (!decision.allowed) {
      throw new InvoiceLimitError(decision.usage);
    }
  }

  async recordCreated(): Promise<void> {
    await this.usage.recordCreated();
    this.usageListeners.forEach((listener) => listener());
  }

  /** Notifies `listener` whenever an invoice was just created (so a usage meter can refresh). Returns an unsubscribe function. */
  onUsageChanged(listener: () => void): () => void {
    this.usageListeners.add(listener);
    return () => {
      this.usageListeners.delete(listener);
    };
  }

  getInvoiceAccess(createdAt: string | number): InvoiceAccess {
    return getInvoiceAccess(this.getPlan(), createdAtToMs(createdAt), this.currentTime());
  }

  canAccessHistoricalInvoice(createdAt: string | number): boolean {
    return this.getInvoiceAccess(createdAt).accessible;
  }

  canAccessHistoricalCustomer(): boolean {
    return canAccessHistoricalCustomer(this.getPlan());
  }

  canUsePricingMethod(pricingMethodId: string): boolean {
    return canUsePricingMethod(this.getPlan(), pricingMethodId);
  }
}
