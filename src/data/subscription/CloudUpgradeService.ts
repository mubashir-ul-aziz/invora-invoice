import type { CloudStoragePlan, CloudStoragePlanId } from '@/domain/cloudBackup/types';

export interface CloudUpgradeResult {
  /** Only `'unavailable'` is ever produced today — see `PlaceholderCloudUpgradeService`. `'success'` is reserved for a future real implementation so `UpgradeStorageScreen` doesn't need to change when one exists. */
  status: 'unavailable' | 'success';
  message: string;
}

/**
 * The seam a future subscription/payment integration (Stripe, RevenueCat, a
 * native IAP SDK — none is chosen yet, per `MVP_BUILD_PLAN.md` §10's open
 * "Subscription/payment provider" decision) would implement, kept
 * deliberately separate from `CloudBackupService`/`CloudBackupApi` so
 * billing never becomes a dependency of the backup feature itself — cloud
 * backup keeps working (on whatever plan a device already has) whether or
 * not a payment provider is ever wired in here.
 *
 * `getPlans()` reads the static `CLOUD_STORAGE_PLANS` registry
 * (`domain/cloudBackup/types.ts`) rather than fetching from a server — there
 * is no billing backend to ask. `requestUpgrade()` is the one method a real
 * implementation would fill in with an actual checkout/purchase flow; today
 * it's a placeholder (see `PlaceholderCloudUpgradeService`), per the explicit
 * "do not implement a complicated billing system unless existing backend
 * infrastructure already supports it" instruction — none does yet.
 */
export interface CloudUpgradeService {
  getPlans(): CloudStoragePlan[];
  requestUpgrade(planId: CloudStoragePlanId): Promise<CloudUpgradeResult>;
}
