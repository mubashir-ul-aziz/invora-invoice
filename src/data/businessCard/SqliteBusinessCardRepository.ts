import { eq } from 'drizzle-orm';

import type { BusinessCard, BusinessCardInput, SocialLink } from '@/domain/businessCard/types';
import { generateLocalId } from '@/lib/id';

import { getDatabase, getDrizzle } from '../db/client';
import { business, socialLink } from '../db/schema';
import type { BusinessCardRepository } from './BusinessCardRepository';

/** Phase 1 supports exactly one on-device business profile. */
const BUSINESS_ID = 'default';

function toDomain(
  row: typeof business.$inferSelect,
  links: SocialLink[],
): BusinessCard {
  return {
    id: row.id,
    businessName: row.name,
    ownerName: row.ownerName,
    logoUri: row.logoUri,
    phone: row.phone,
    email: row.email,
    website: row.website,
    address: row.address,
    currency: row.currency,
    taxId: row.taxId,
    shareSlug: row.shareSlug,
    socialLinks: links,
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

export class SqliteBusinessCardRepository implements BusinessCardRepository {
  async getCard(): Promise<BusinessCard | null> {
    await getDatabase();
    const db = getDrizzle();

    const rows = await db.select().from(business).where(eq(business.id, BUSINESS_ID));
    const row = rows[0];
    if (!row) return null;

    const linkRows = await db
      .select()
      .from(socialLink)
      .where(eq(socialLink.businessId, BUSINESS_ID));

    return toDomain(
      row,
      linkRows.map((link) => ({ platform: link.platform, value: link.value })),
    );
  }

  /**
   * The business row and its social-link rows are written in one
   * `db.transaction()` (same synchronous, `.run()`-based pattern as
   * `SqliteBackupRepository.restoreAll()` — see its doc comment for why the
   * callback must stay sync). Without this, an interruption between the
   * "delete every social link" step and the reinsert loop below would
   * silently wipe every social link the card previously had — the
   * "recovery from interrupted writes" failure mode Phase 13 audits for.
   */
  async saveCard(input: BusinessCardInput): Promise<BusinessCard> {
    await getDatabase();
    const db = getDrizzle();

    const now = Date.now();
    const existing = await db
      .select({ id: business.id, createdAt: business.createdAt, shareSlug: business.shareSlug })
      .from(business)
      .where(eq(business.id, BUSINESS_ID));

    const shareSlug = existing[0]?.shareSlug ?? generateLocalId();
    const createdAt = existing[0]?.createdAt ?? now;

    const values = {
      id: BUSINESS_ID,
      name: input.businessName,
      ownerName: input.ownerName,
      logoUri: input.logoUri,
      phone: input.phone,
      email: input.email,
      website: input.website,
      address: input.address,
      currency: input.currency,
      taxId: input.taxId,
      shareSlug,
      createdAt,
      updatedAt: now,
    };

    db.transaction((tx) => {
      if (existing[0]) {
        tx.update(business).set(values).where(eq(business.id, BUSINESS_ID)).run();
      } else {
        tx.insert(business).values(values).run();
      }

      // Replace the social-link set wholesale — small, bounded (<=4 rows) and
      // simpler/less error-prone than a diff for this data size.
      tx.delete(socialLink).where(eq(socialLink.businessId, BUSINESS_ID)).run();
      for (const link of input.socialLinks) {
        if (!link.value.trim()) continue;
        tx.insert(socialLink)
          .values({
            id: generateLocalId('soc_'),
            businessId: BUSINESS_ID,
            platform: link.platform,
            value: link.value,
          })
          .run();
      }
    });

    const saved = await this.getCard();
    if (!saved) {
      throw new Error('Failed to read back the business card after saving.');
    }
    return saved;
  }
}
