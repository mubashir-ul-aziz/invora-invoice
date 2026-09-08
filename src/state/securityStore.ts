import { create } from 'zustand';

import type { BiometricService } from '@/data/security/BiometricService';
import type { SecurityRepository } from '@/data/security/SecurityRepository';
import { getBiometricService, getSecurityRepository } from '@/data/container';
import type { SecuritySettings, SecuritySettingsInput } from '@/domain/security/types';

export type SecurityStatus = 'idle' | 'loading' | 'saving' | 'ready' | 'error';

interface SecurityState {
  status: SecurityStatus;
  settings: SecuritySettings | null;
  /** Whether this device can offer biometric auth at all — drives whether the Biometric Unlock toggle is interactable. */
  biometricSupported: boolean;
  error: string | null;
  load: () => Promise<void>;
  save: (input: SecuritySettingsInput) => Promise<SecuritySettings>;
}

/**
 * Dependencies are resolved lazily (not at module-eval time) so tests can
 * swap the repository/service via `createSecurityStore` before anything
 * touches the database or a native module — same pattern as every other
 * store in this codebase. Backs both the Security settings screen and
 * `AppLockGate` (which reads `settings`/`biometricSupported` from this same
 * singleton rather than re-reading the repository itself).
 */
export function createSecurityStore(
  repository: SecurityRepository = getSecurityRepository(),
  biometricService: BiometricService = getBiometricService(),
) {
  return create<SecurityState>((set) => ({
    status: 'idle',
    settings: null,
    biometricSupported: false,
    error: null,

    load: async () => {
      set({ status: 'loading', error: null });
      try {
        const [settings, biometricSupported] = await Promise.all([
          repository.getSettings(),
          biometricService.isSupported(),
        ]);
        set({ settings, biometricSupported, status: 'ready' });
      } catch (err) {
        set({ status: 'error', error: err instanceof Error ? err.message : String(err) });
      }
    },

    save: async (input: SecuritySettingsInput) => {
      set({ status: 'saving', error: null });
      try {
        const settings = await repository.saveSettings(input);
        set({ settings, status: 'ready' });
        return settings;
      } catch (err) {
        set({ status: 'error', error: err instanceof Error ? err.message : String(err) });
        throw err;
      }
    },
  }));
}

/** App-wide singleton store, wired to the real repository/service. */
export const useSecurityStore = createSecurityStore();
