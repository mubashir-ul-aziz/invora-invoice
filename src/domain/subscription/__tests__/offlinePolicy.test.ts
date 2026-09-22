import { MAX_STALE_MS, OFFLINE_GRACE_MS, effectiveNow, resolveEffectivePlan } from '../offlinePolicy';
import type { NormalizedSubscription } from '../types';

const DAY = 86_400_000;
const NOW = 1_800_000_000_000;

function paid(overrides: Partial<NormalizedSubscription> = {}): NormalizedSubscription {
  return {
    plan: 'business',
    isActive: true,
    expiresAt: NOW + 10 * DAY,
    willRenew: true,
    billingIssue: false,
    billingPeriod: 'monthly',
    lastSyncedAt: NOW - DAY,
    source: 'revenuecat',
    ...overrides,
  };
}

const resolve = (
  subscription: NormalizedSubscription | null,
  extra: { now?: number; highWater?: number; verified?: boolean } = {},
) =>
  resolveEffectivePlan({
    subscription,
    now: extra.now ?? NOW,
    clockHighWaterMs: extra.highWater ?? 0,
    verifiedThisSession: extra.verified ?? false,
  });

describe('resolveEffectivePlan', () => {
  it('is Free with no cache — a paid plan never appears from nothing', () => {
    expect(resolve(null)).toEqual({ plan: 'free', trust: 'none' });
  });

  it('never trusts a row that did not come from a RevenueCat sync', () => {
    const forged = paid({ plan: 'unlimited', source: 'default', expiresAt: null });
    expect(resolve(forged)).toEqual({ plan: 'free', trust: 'none' });
  });

  it('keeps a paid plan offline while inside its paid period', () => {
    expect(resolve(paid())).toEqual({ plan: 'business', trust: 'cached' });
  });

  it('keeps a paid plan for the grace window after expiry, then downgrades', () => {
    const sub = paid({ expiresAt: NOW - 1000 });
    expect(resolve(sub).plan).toBe('business');
    expect(resolve(sub, { now: NOW - 1000 + OFFLINE_GRACE_MS }).plan).toBe('business');
    expect(resolve(sub, { now: NOW - 1000 + OFFLINE_GRACE_MS + 1 })).toEqual({ plan: 'free', trust: 'expired' });
  });

  it('stops trusting a cache that has not been verified for too long, even if not expired', () => {
    const sub = paid({ lastSyncedAt: NOW - MAX_STALE_MS - 1, expiresAt: NOW + 300 * DAY, billingPeriod: 'yearly' });
    expect(resolve(sub)).toEqual({ plan: 'free', trust: 'stale' });
  });

  it('treats a verified sync as authoritative, including "free"', () => {
    expect(resolve(paid(), { verified: true })).toEqual({ plan: 'business', trust: 'verified' });
    const lapsed = paid({ plan: 'free', isActive: false, expiresAt: NOW - 30 * DAY });
    expect(resolve(lapsed, { verified: true })).toEqual({ plan: 'free', trust: 'verified' });
  });

  it('does not extend an expired plan just because the clock was rolled back', () => {
    const sub = paid({ expiresAt: NOW - 10 * DAY, lastSyncedAt: NOW - 11 * DAY });
    // Device clock rolled back to before expiry, but the high-water mark already reached NOW.
    expect(resolve(sub, { now: NOW - 20 * DAY, highWater: NOW }).plan).toBe('free');
  });

  it('uses the later of device time and the high-water mark', () => {
    expect(effectiveNow(100, 500)).toBe(500);
    expect(effectiveNow(900, 500)).toBe(900);
  });

  it('is Free for an inactive or free cached plan', () => {
    expect(resolve(paid({ isActive: false }))).toEqual({ plan: 'free', trust: 'cached' });
    expect(resolve(paid({ plan: 'free' }))).toEqual({ plan: 'free', trust: 'cached' });
  });
});
