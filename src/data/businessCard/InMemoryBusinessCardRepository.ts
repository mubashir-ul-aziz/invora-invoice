import type { BusinessCard, BusinessCardInput } from '@/domain/businessCard/types';
import { generateLocalId } from '@/lib/id';

import type { BusinessCardRepository } from './BusinessCardRepository';

/**
 * Frontend-first mock repository — no database, no I/O. Used to build and
 * unit-test the UI/state layer before the SQLite-backed repository exists,
 * and kept afterwards for fast Jest tests of screens/stores that don't need
 * to exercise real persistence.
 */
export class InMemoryBusinessCardRepository implements BusinessCardRepository {
  private card: BusinessCard | null;

  constructor(seed: BusinessCard | null = null) {
    this.card = seed;
  }

  async getCard(): Promise<BusinessCard | null> {
    return this.card;
  }

  async saveCard(input: BusinessCardInput): Promise<BusinessCard> {
    const now = new Date().toISOString();
    this.card = {
      id: this.card?.id ?? generateLocalId('biz_'),
      shareSlug: this.card?.shareSlug ?? generateLocalId(),
      ...input,
      updatedAt: now,
    };
    return this.card;
  }
}
