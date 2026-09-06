import { create } from 'zustand';

import type { BusinessCardRepository } from '@/data/businessCard/BusinessCardRepository';
import { getBusinessCardRepository, getShareLinkService } from '@/data/container';
import type { ShareLinkService } from '@/data/shareLink/ShareLinkService';
import type { BusinessCard, BusinessCardInput } from '@/domain/businessCard/types';

export type BusinessCardStatus = 'idle' | 'loading' | 'saving' | 'ready' | 'error';

interface BusinessCardState {
  status: BusinessCardStatus;
  card: BusinessCard | null;
  error: string | null;
  load: () => Promise<void>;
  save: (input: BusinessCardInput) => Promise<BusinessCard>;
  getShareLink: () => string | null;
}

/**
 * Dependencies are resolved lazily (not at module-eval time) so tests can
 * swap the repository via `createBusinessCardStore` below before anything
 * touches the database.
 */
export function createBusinessCardStore(
  repository: BusinessCardRepository = getBusinessCardRepository(),
  shareLinkService: ShareLinkService = getShareLinkService(),
) {
  return create<BusinessCardState>((set, get) => ({
    status: 'idle',
    card: null,
    error: null,

    load: async () => {
      set({ status: 'loading', error: null });
      try {
        const card = await repository.getCard();
        set({ card, status: 'ready' });
      } catch (err) {
        set({ status: 'error', error: err instanceof Error ? err.message : String(err) });
      }
    },

    save: async (input: BusinessCardInput) => {
      set({ status: 'saving', error: null });
      try {
        const card = await repository.saveCard(input);
        set({ card, status: 'ready' });
        return card;
      } catch (err) {
        set({ status: 'error', error: err instanceof Error ? err.message : String(err) });
        throw err;
      }
    },

    getShareLink: () => {
      const { card } = get();
      return card ? shareLinkService.getShareLink(card) : null;
    },
  }));
}

/** App-wide singleton store, wired to the real (SQLite) repository. */
export const useBusinessCardStore = createBusinessCardStore();
