import type { BusinessCard, BusinessCardInput } from '@/domain/businessCard/types';

/**
 * The only door the state/controller layer is allowed to use to reach
 * business-card data. Screens/components never import a concrete
 * repository, Drizzle table, or the sqlite client directly.
 */
export interface BusinessCardRepository {
  /** Returns the single on-device business card, or null if none was ever saved. */
  getCard(): Promise<BusinessCard | null>;
  /** Creates the card on first save, or updates the existing one. */
  saveCard(input: BusinessCardInput): Promise<BusinessCard>;
}
