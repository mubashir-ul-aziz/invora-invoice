import { create } from 'zustand';

import type { BiometricService } from '@/data/security/BiometricService';
import { getBiometricService } from '@/data/container';

export type AppLockStatus = 'checking' | 'unlocked' | 'locked';

interface AppLockState {
  status: AppLockStatus;
  /**
   * Whether `applyInitialState` has already run once. Guards against a later
   * settings save (e.g. turning App Lock on from inside the already-unlocked
   * Security screen) re-triggering the initial checking→locked/unlocked
   * transition and yanking the user back to the lock screen they're not on.
   */
  hasInitialized: boolean;
  /** Sets the app's starting lock state from the persisted App Lock setting. Call once, as soon as it's known (see `AppLockGate`). No-ops after the first call. */
  applyInitialState: (appLockEnabled: boolean) => void;
  /** Re-locks the app on returning to the foreground, if App Lock is currently enabled. Called from `AppLockGate`'s `AppState` listener. */
  lockIfEnabled: (appLockEnabled: boolean) => void;
  /** Prompts the device's biometric/passcode UI via the injected `BiometricService`. Unlocks on success. */
  unlock: () => Promise<boolean>;
}

/**
 * Dependencies are resolved lazily (not at module-eval time) so tests can
 * swap the biometric service via `createAppLockStore` before anything
 * touches a native module — same pattern as every other store in this
 * codebase. Deliberately holds no repository of its own: `AppLockGate` reads
 * the persisted setting through `securityStore` (the single source of truth
 * for it) and only hands this store the resulting boolean.
 */
export function createAppLockStore(biometricService: BiometricService = getBiometricService()) {
  return create<AppLockState>((set, get) => ({
    status: 'checking',
    hasInitialized: false,

    applyInitialState: (appLockEnabled) => {
      if (get().hasInitialized) {
        return;
      }
      set({ status: appLockEnabled ? 'locked' : 'unlocked', hasInitialized: true });
    },

    lockIfEnabled: (appLockEnabled) => {
      if (appLockEnabled) {
        set({ status: 'locked' });
      }
    },

    unlock: async () => {
      const success = await biometricService.authenticate('Unlock Invora');
      if (success) {
        set({ status: 'unlocked' });
      }
      return success;
    },
  }));
}

/** App-wide singleton store, wired to the real biometric service. */
export const useAppLockStore = createAppLockStore();
