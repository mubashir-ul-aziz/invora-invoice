import type { SecuritySettings, SecuritySettingsInput } from '@/domain/security/types';

import type { SecurityRepository } from './SecurityRepository';

/**
 * Frontend-first mock repository — no database, no I/O. Used to build and
 * unit-test the UI/state layer before the SQLite-backed repository exists,
 * and kept afterwards for fast Jest tests (same role as
 * `InMemoryBusinessRepository`).
 */
export class InMemorySecurityRepository implements SecurityRepository {
  private row: SecuritySettings | null;

  constructor(seed: SecuritySettings | null = null) {
    this.row = seed;
  }

  async getSettings(): Promise<SecuritySettings | null> {
    return this.row;
  }

  async saveSettings(input: SecuritySettingsInput): Promise<SecuritySettings> {
    this.row = { ...input, updatedAt: new Date().toISOString() };
    return this.row;
  }
}
