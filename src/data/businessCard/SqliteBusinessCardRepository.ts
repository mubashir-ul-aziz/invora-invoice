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

    if (existing[0]) {
      await db.update(business).set(values).where(eq(business.id, BUSINESS_ID));
    } else {
      await db.insert(business).values(values);
    }

    // Replace the social-link set wholesale — small, bounded (<=4 rows) and
    // simpler/less error-prone than a diff for this data size.
    await db.delete(socialLink).where(eq(socialLink.businessId, BUSINESS_ID));
    for (const link of input.socialLinks) {
      if (!link.value.trim()) continue;
      await db.insert(socialLink).values({
        id: generateLocalId('soc_'),
        businessId: BUSINESS_ID,
        platform: link.platform,
        value: link.value,
      });
    }

    const saved = await this.getCard();
    if (!saved) {
      throw new Error('Failed to read back the business card after saving.');
    }
    return saved;
  }
}
