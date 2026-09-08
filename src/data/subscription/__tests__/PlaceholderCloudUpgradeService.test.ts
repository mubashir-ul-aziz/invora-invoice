import { CLOUD_STORAGE_PLANS } from '@/domain/cloudBackup/types';

import { PlaceholderCloudUpgradeService } from '../PlaceholderCloudUpgradeService';

describe('PlaceholderCloudUpgradeService', () => {
  it('getPlans returns the static plan registry', () => {
    const service = new PlaceholderCloudUpgradeService();
    expect(service.getPlans()).toBe(CLOUD_STORAGE_PLANS);
  });

  it('requestUpgrade always reports unavailable, without throwing or making a network call', async () => {
    const service = new PlaceholderCloudUpgradeService();
    const result = await service.requestUpgrade('plus');

    expect(result.status).toBe('unavailable');
    expect(result.message).toMatch(/isn't available yet/i);
  });
});
