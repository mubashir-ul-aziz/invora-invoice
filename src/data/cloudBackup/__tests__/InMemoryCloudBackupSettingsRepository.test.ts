import { InMemoryCloudBackupSettingsRepository } from '../InMemoryCloudBackupSettingsRepository';

describe('InMemoryCloudBackupSettingsRepository', () => {
  it('defaults to disabled, never backed up, unknown plan', async () => {
    const repo = new InMemoryCloudBackupSettingsRepository();
    await expect(repo.getSettings()).resolves.toMatchObject({
      cloudBackupEnabled: false,
      planId: null,
      lastCloudBackupAt: null,
      lastCloudBackupStatus: null,
    });
  });

  it('saveSettings only changes cloudBackupEnabled', async () => {
    const repo = new InMemoryCloudBackupSettingsRepository();
    await repo.recordPlan('plus');

    const settings = await repo.saveSettings({ cloudBackupEnabled: true });

    expect(settings.cloudBackupEnabled).toBe(true);
    expect(settings.planId).toBe('plus'); // not clobbered
  });

  it('recordAttempt sets lastCloudBackupAt only on success', async () => {
    const repo = new InMemoryCloudBackupSettingsRepository();
    await repo.recordAttempt({ status: 'success', finishedAt: '2026-01-01T00:00:00.000Z', errorMessage: null });
    const afterSuccess = await repo.getSettings();
    expect(afterSuccess.lastCloudBackupAt).toBe('2026-01-01T00:00:00.000Z');

    await repo.recordAttempt({ status: 'failure', finishedAt: '2026-01-02T00:00:00.000Z', errorMessage: 'oops' });
    const afterFailure = await repo.getSettings();

    expect(afterFailure.lastCloudBackupAt).toBe('2026-01-01T00:00:00.000Z'); // unchanged
    expect(afterFailure.lastCloudBackupStatus).toBe('failure');
    expect(afterFailure.lastCloudBackupError).toBe('oops');
  });

  it('recordPlan updates only the plan field', async () => {
    const repo = new InMemoryCloudBackupSettingsRepository();
    await repo.saveSettings({ cloudBackupEnabled: true });

    const settings = await repo.recordPlan('plus');

    expect(settings.planId).toBe('plus');
    expect(settings.cloudBackupEnabled).toBe(true); // not clobbered
  });
});
