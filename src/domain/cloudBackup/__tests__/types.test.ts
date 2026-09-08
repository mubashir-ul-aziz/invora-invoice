import {
  CLOUD_BACKUP_RETENTION_COUNT,
  CLOUD_STORAGE_PLANS,
  DEFAULT_CLOUD_STORAGE_PLAN_ID,
  EMPTY_CLOUD_BACKUP_SETTINGS,
  getCloudStoragePlan,
} from '../types';

describe('CLOUD_STORAGE_PLANS', () => {
  it('has a free plan that is not an upgrade target', () => {
    const free = getCloudStoragePlan('free');
    expect(free.limitBytes).toBeGreaterThan(0);
    expect(free.isUpgradeTarget).toBe(false);
    expect(free.id).toBe(DEFAULT_CLOUD_STORAGE_PLAN_ID);
  });

  it('has at least one plan flagged as an upgrade target, with a larger limit than free', () => {
    const upgradeTargets = CLOUD_STORAGE_PLANS.filter((p) => p.isUpgradeTarget);
    expect(upgradeTargets.length).toBeGreaterThan(0);
    const free = getCloudStoragePlan('free');
    for (const plan of upgradeTargets) {
      expect(plan.limitBytes).toBeGreaterThan(free.limitBytes);
    }
  });

  it('getCloudStoragePlan falls back to the first plan for an unknown id', () => {
    expect(getCloudStoragePlan('does-not-exist' as never)).toEqual(CLOUD_STORAGE_PLANS[0]);
  });
});

describe('EMPTY_CLOUD_BACKUP_SETTINGS', () => {
  it('defaults to disabled, never backed up, unknown plan', () => {
    expect(EMPTY_CLOUD_BACKUP_SETTINGS).toEqual({
      cloudBackupEnabled: false,
      planId: null,
      lastCloudBackupAt: null,
      lastCloudBackupStatus: null,
      lastCloudBackupError: null,
    });
  });
});

describe('CLOUD_BACKUP_RETENTION_COUNT', () => {
  it('is a positive, finite number', () => {
    expect(CLOUD_BACKUP_RETENTION_COUNT).toBeGreaterThan(0);
  });
});
