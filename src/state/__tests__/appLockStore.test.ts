import { FakeBiometricService } from '@/data/security/FakeBiometricService';

import { createAppLockStore } from '../appLockStore';

describe('appLockStore', () => {
  it('starts in "checking" until applyInitialState is called', () => {
    const useStore = createAppLockStore(new FakeBiometricService());
    expect(useStore.getState().status).toBe('checking');
  });

  it('applyInitialState(false) unlocks, applyInitialState(true) locks', () => {
    const unlockedStore = createAppLockStore(new FakeBiometricService());
    unlockedStore.getState().applyInitialState(false);
    expect(unlockedStore.getState().status).toBe('unlocked');

    const lockedStore = createAppLockStore(new FakeBiometricService());
    lockedStore.getState().applyInitialState(true);
    expect(lockedStore.getState().status).toBe('locked');
  });

  it('only applies the initial state once, so a later settings save cannot yank the screen back to locked', () => {
    const useStore = createAppLockStore(new FakeBiometricService());
    useStore.getState().applyInitialState(false);
    expect(useStore.getState().status).toBe('unlocked');

    useStore.getState().applyInitialState(true);
    expect(useStore.getState().status).toBe('unlocked');
  });

  it('lockIfEnabled re-locks only when App Lock is currently on', () => {
    const useStore = createAppLockStore(new FakeBiometricService());
    useStore.getState().applyInitialState(false);

    useStore.getState().lockIfEnabled(false);
    expect(useStore.getState().status).toBe('unlocked');

    useStore.getState().lockIfEnabled(true);
    expect(useStore.getState().status).toBe('locked');
  });

  it('unlock() succeeds and transitions to unlocked when the biometric service authenticates', async () => {
    const biometric = new FakeBiometricService();
    biometric.nextAuthenticateResult = true;
    const useStore = createAppLockStore(biometric);
    useStore.getState().applyInitialState(true);

    const result = await useStore.getState().unlock();

    expect(result).toBe(true);
    expect(useStore.getState().status).toBe('unlocked');
    expect(biometric.authenticateCalls).toEqual(['Unlock Invora']);
  });

  it('unlock() stays locked when authentication fails or is cancelled', async () => {
    const biometric = new FakeBiometricService();
    biometric.nextAuthenticateResult = false;
    const useStore = createAppLockStore(biometric);
    useStore.getState().applyInitialState(true);

    const result = await useStore.getState().unlock();

    expect(result).toBe(false);
    expect(useStore.getState().status).toBe('locked');
  });
});
