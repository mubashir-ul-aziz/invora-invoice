import type { SecuritySettings, SecuritySettingsInput } from '@/domain/security/types';

/**
 * The only door the state/controller layer is allowed to use to reach
 * App Lock / Biometric Unlock settings. Screens/components never import a
 * concrete repository, Drizzle table, or the sqlite client directly.
 */
export interface SecurityRepository {
  /** Returns the saved security settings, or null if none were ever saved (defaults to "off" — see `EMPTY_SECURITY_SETTINGS_INPUT`). */
  getSettings(): Promise<SecuritySettings | null>;
  /** Creates the settings row on first save, or updates the existing one. */
  saveSettings(input: SecuritySettingsInput): Promise<SecuritySettings>;
}
