/**
 * 24-HOUR VERIFICATION POLICY
 *
 * The app must successfully verify the subscription with RevenueCat at least
 * once every 24 hours. After that, normal use pauses behind
 * "Connect to the internet to verify your plan" until a verification
 * succeeds — the user's data is never deleted and the plan is never labelled
 * expired because of it (an unreachable server is *pending*, not *expired*).
 *
 *  - Only a *fresh* RevenueCat answer counts (`SubscriptionService` stamps
 *    `lastVerifiedAt` with RevenueCat's own `requestDateMillis`). The SDK's
 *    offline-cached CustomerInfo and failed requests never move it.
 *  - Before the first verification ever succeeds, the window starts at
 *    `firstLaunchAt` (the first launch with this policy), so a new or
 *    upgraded install isn't blocked the moment it opens offline.
 *  - Time never runs backwards: the decision uses `max(now, clockHighWaterMs)`,
 *    and a device clock noticeably *behind* the highest time already seen is
 *    treated as tampering and requires verification right away (a fresh
 *    RevenueCat answer resets the high-water mark to server time, which also
 *    clears an accidentally-wrong clock).
 *  - It's enforced only when RevenueCat is usable in this build. A build
 *    without RevenueCat can never verify, so blocking it would brick the app.
 *
 * This is local enforcement on a device the user controls: clearing app
 * data or reinstalling resets it, and a rooted device can edit anything. The
 * signed cache (see `cacheCodec.ts`) makes hand-edits fail closed, but it is
 * not tamper-proof. RevenueCat stays the only source of a paid plan.
 */
export const VERIFICATION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * How far the device clock may sit behind the highest time already seen
 * before it counts as rolled back. Must exceed `FRESH_TOLERANCE_MS` (15 min,
 * `SubscriptionService`): a fresh answer sets the high-water mark to
 * RevenueCat's time, which may be up to that far ahead of a slightly slow
 * device clock.
 */
export const CLOCK_ROLLBACK_TOLERANCE_MS = 20 * 60 * 1000;

export interface VerificationInput {
  /** False when RevenueCat isn't usable in this build — the requirement is then off. */
  enforced: boolean;
  lastVerifiedAt: number | null;
  firstLaunchAt: number | null;
  clockHighWaterMs: number;
  now: number;
}

export type VerificationState =
  | { required: false; reason: null; deadlineAt: number | null }
  | { required: true; reason: 'expired_window' | 'clock_rollback'; deadlineAt: number | null };

export function evaluateVerification(input: VerificationInput): VerificationState {
  const anchor = input.lastVerifiedAt ?? input.firstLaunchAt;
  const deadlineAt = anchor === null ? null : anchor + VERIFICATION_MAX_AGE_MS;
  if (!input.enforced || anchor === null) {
    return { required: false, reason: null, deadlineAt };
  }
  if (input.now + CLOCK_ROLLBACK_TOLERANCE_MS < input.clockHighWaterMs) {
    return { required: true, reason: 'clock_rollback', deadlineAt };
  }
  const now = Math.max(input.now, input.clockHighWaterMs);
  if (now - anchor > VERIFICATION_MAX_AGE_MS) {
    return { required: true, reason: 'expired_window', deadlineAt };
  }
  return { required: false, reason: null, deadlineAt };
}
