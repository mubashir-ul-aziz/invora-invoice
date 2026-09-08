/**
 * App Lock / Biometric Unlock settings (Phase 10 — Settings). A device-level
 * preference, not business data — see the doc comment on `appSettings` in
 * `data/db/schema.ts`.
 */
export interface SecuritySettings {
  /** Whether opening/resuming the app requires authenticating first. */
  appLockEnabled: boolean;
  /**
   * Whether the App Lock screen offers biometric auth (Face ID/fingerprint)
   * in addition to the device passcode. Only meaningful when the device
   * itself supports it — see `BiometricService.isSupported()` — and only
   * takes effect while `appLockEnabled` is also true.
   */
  biometricUnlockEnabled: boolean;
  updatedAt: string;
}

export type SecuritySettingsInput = Omit<SecuritySettings, 'updatedAt'>;

export const EMPTY_SECURITY_SETTINGS_INPUT: SecuritySettingsInput = {
  appLockEnabled: false,
  biometricUnlockEnabled: false,
};
