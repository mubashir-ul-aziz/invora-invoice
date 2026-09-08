import { InMemorySecurityRepository } from '../InMemorySecurityRepository';

describe('InMemorySecurityRepository', () => {
  it('returns null before anything is saved', async () => {
    const repo = new InMemorySecurityRepository();
    expect(await repo.getSettings()).toBeNull();
  });

  it('saves and reads back both toggles', async () => {
    const repo = new InMemorySecurityRepository();
    const saved = await repo.saveSettings({ appLockEnabled: true, biometricUnlockEnabled: true });

    expect(saved.appLockEnabled).toBe(true);
    expect(saved.biometricUnlockEnabled).toBe(true);
    expect(saved.updatedAt).toEqual(expect.any(String));

    const read = await repo.getSettings();
    expect(read).toEqual(saved);
  });

  it('updates in place rather than creating a second row', async () => {
    const repo = new InMemorySecurityRepository();
    await repo.saveSettings({ appLockEnabled: true, biometricUnlockEnabled: false });
    const second = await repo.saveSettings({ appLockEnabled: true, biometricUnlockEnabled: true });

    expect(second.appLockEnabled).toBe(true);
    expect(second.biometricUnlockEnabled).toBe(true);
    expect(await repo.getSettings()).toEqual(second);
  });
});
