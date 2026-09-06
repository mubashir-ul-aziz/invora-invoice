import * as Linking from 'expo-linking';

import type { BusinessCard } from '@/domain/businessCard/types';

import type { ShareLinkService } from './ShareLinkService';

/**
 * Backend-free implementation: builds a deep link from the app's own
 * `invora://` scheme (registered in app.json) using `expo-linking`, which
 * resolves to whatever transport is actually available on the device right
 * now (a real `invora://` URI in a standalone/dev-client build, or an
 * `exp://…` Expo Go URL in development) — never a hard-coded production
 * domain that may not exist yet. Works fully offline: no network call is
 * made to produce it.
 *
 * When a hosted redirect service exists (see the "Open decisions" note on
 * server-hosted share links in MVP_BUILD_PLAN.md), a `RemoteShareLinkService`
 * implementing this same interface can replace this one at the composition
 * root only — no screen or store changes.
 */
export class LocalShareLinkService implements ShareLinkService {
  getShareLink(card: BusinessCard): string {
    return Linking.createURL(`card/${card.shareSlug}`);
  }
}
