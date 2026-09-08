import { FakeBiometricService } from '@/data/security/FakeBiometricService';
import { InMemorySecurityRepository } from '@/data/security/InMemorySecurityRepository';

import { createSecurityStore } from '../securityStore';

describe('securityStore', () => {
  it('loads defaults (both off, no biometric support) for a never-saved device', async () => {
    const biometric = new FakeBiometricService();
    biometric.supported = false;
    const useStore = createSecurityStore(new InMemorySecurityRepository(), biometric);

    await useStore.getState().load();

    expect(useStore.getState().status).toBe('ready');
    expect(useStore.getState().settings).toBeNull();
    expect(useStore.getState().biometricSupported).toBe(false);
  });

  it('reports biometric support from the injected service', async () => {
    const biometric = new FakeBiometricService();
    biometric.supported = true;
    const useStore = createSecurityStore(new InMemorySecurityRepository(), biometric);

    await useStore.getState().load();

    expect(useStore.getState().biometricSupported).toBe(true);
  });

  it('saves settings and reflects them immediately', async () => {
    const useStore = createSecurityStore(new InMemorySecurityRepository(), new FakeBiometricService());

    const saved = await useStore
      .getState()
      .save({ appLockEnabled: true, biometricUnlockEnabled: true });

    expect(saved.appLockEnabled).toBe(true);
    expect(useStore.getState().settings).toEqual(saved);
    expect(useStore.getState().status).toBe('ready');
  });

  it('surfaces a load failure as an error state', async () => {
    const failingRepository = {
      getSettings: jest.fn().mockRejectedValue(new Error('boom')),
      saveSettings: jest.fn(),
    };
    const useStore = createSecurityStore(failingRepository, new FakeBiometricService());

    await useStore.getState().load();

    expect(useStore.getState().status).toBe('error');
    expect(useStore.getState().error).toBe('boom');
  });

  it('surfaces a save failure as an error state and rethrows', async () => {
    const failingRepository = {
      getSettings: jest.fn().mockResolvedValue(null),
      saveSettings: jest.fn().mockRejectedValue(new Error('nope')),
    };
    const useStore = createSecurityStore(failingRepository, new FakeBiometricService());

    await expect(
      useStore.getState().save({ appLockEnabled: true, biometricUnlockEnabled: false }),
    ).rejects.toThrow('nope');
    expect(useStore.getState().status).toBe('error');
  });
});
