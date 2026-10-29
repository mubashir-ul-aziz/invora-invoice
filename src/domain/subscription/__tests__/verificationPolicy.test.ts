import { CLOCK_ROLLBACK_TOLERANCE_MS, VERIFICATION_MAX_AGE_MS, evaluateVerification } from '../verificationPolicy';

const T = 1_800_000_000_000;
const base = { enforced: true, lastVerifiedAt: T, firstLaunchAt: T - 1000, clockHighWaterMs: T };

describe('evaluateVerification — the 24-hour boundary', () => {
  it('is not required right after a verification', () => {
    expect(evaluateVerification({ ...base, now: T }).required).toBe(false);
  });

  it('is not required at exactly 24 hours', () => {
    expect(evaluateVerification({ ...base, now: T + VERIFICATION_MAX_AGE_MS }).required).toBe(false);
  });

  it('is required one millisecond after 24 hours', () => {
    expect(evaluateVerification({ ...base, now: T + VERIFICATION_MAX_AGE_MS + 1 })).toMatchObject({
      required: true,
      reason: 'expired_window',
      deadlineAt: T + VERIFICATION_MAX_AGE_MS,
    });
  });

  it('counts the first window from the first launch until a verification has ever succeeded', () => {
    const fresh = { ...base, lastVerifiedAt: null, firstLaunchAt: T };
    expect(evaluateVerification({ ...fresh, now: T + VERIFICATION_MAX_AGE_MS - 1 }).required).toBe(false);
    expect(evaluateVerification({ ...fresh, now: T + VERIFICATION_MAX_AGE_MS + 1 }).required).toBe(true);
  });

  it('is never required when RevenueCat is unavailable in this build', () => {
    expect(evaluateVerification({ ...base, enforced: false, now: T + 10 * VERIFICATION_MAX_AGE_MS }).required).toBe(false);
  });
});

describe('evaluateVerification — clock tampering', () => {
  it('does not reopen the window when the clock is rolled back: the high-water mark is used', () => {
    // The device clock already reached T+25h once (high-water mark), then was set back to T+1h.
    const state = evaluateVerification({ ...base, clockHighWaterMs: T + 25 * 3_600_000, now: T + 3_600_000 });
    expect(state).toMatchObject({ required: true, reason: 'clock_rollback' });
  });

  it('treats a clock noticeably behind the highest time seen as a rollback, even inside the window', () => {
    const state = evaluateVerification({ ...base, clockHighWaterMs: T + 2 * 3_600_000, now: T + 3_600_000 });
    expect(state).toMatchObject({ required: true, reason: 'clock_rollback' });
  });

  it('tolerates small corrections (a slightly slow clock vs RevenueCat time)', () => {
    const state = evaluateVerification({ ...base, clockHighWaterMs: T + CLOCK_ROLLBACK_TOLERANCE_MS - 1, now: T });
    expect(state.required).toBe(false);
  });

  it('a clock pushed forward past 24 hours requires verification (it does not extend anything)', () => {
    expect(evaluateVerification({ ...base, now: T + 2 * VERIFICATION_MAX_AGE_MS }).required).toBe(true);
  });
});
