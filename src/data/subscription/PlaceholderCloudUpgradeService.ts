import { CLOUD_STORAGE_PLANS, type CloudStoragePlan, type CloudStoragePlanId } from '@/domain/cloudBackup/types';

import type { CloudUpgradeResult, CloudUpgradeService } from './CloudUpgradeService';

/**
 * Today's only `CloudUpgradeService` implementation — makes no network call
 * and integrates no payment SDK, per the "no complicated billing system"
 * instruction. `requestUpgrade()` always resolves `'unavailable'` with an
 * honest, specific message, the same tone `AccountScreen` (Phase 10) already
 * uses for "there's no account system yet" rather than faking a checkout
 * flow that doesn't exist.
 */
export class PlaceholderCloudUpgradeService implements CloudUpgradeService {
  getPlans(): CloudStoragePlan[] {
    return CLOUD_STORAGE_PLANS;
  }

  async requestUpgrade(_planId: CloudStoragePlanId): Promise<CloudUpgradeResult> {
    return {
      status: 'unavailable',
      message:
        "Upgrading storage isn't available yet — this is a placeholder for a future subscription plan. Contact support if you need more cloud storage sooner.",
    };
  }
}
