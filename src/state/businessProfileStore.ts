import { create } from 'zustand';

import type { BusinessRepository } from '@/data/business/BusinessRepository';
import { getBusinessRepository } from '@/data/container';
import type { BusinessProfile, BusinessProfileInput } from '@/domain/business/types';

export type BusinessProfileStatus = 'idle' | 'loading' | 'saving' | 'ready' | 'error';

interface BusinessProfileState {
  status: BusinessProfileStatus;
  profile: BusinessProfile | null;
  error: string | null;
  load: () => Promise<void>;
  save: (input: BusinessProfileInput) => Promise<BusinessProfile>;
}

/**
 * Dependencies are resolved lazily (not at module-eval time) so tests can
 * swap the repository via `createBusinessProfileStore` before anything
 * touches the database — same pattern as `businessCardStore`.
 */
export function createBusinessProfileStore(
  repository: BusinessRepository = getBusinessRepository(),
) {
  return create<BusinessProfileState>((set) => ({
    status: 'idle',
    profile: null,
    error: null,

    load: async () => {
      set({ status: 'loading', error: null });
      try {
        const profile = await repository.getProfile();
        set({ profile, status: 'ready' });
      } catch (err) {
        set({ status: 'error', error: err instanceof Error ? err.message : String(err) });
      }
    },

    save: async (input: BusinessProfileInput) => {
      set({ status: 'saving', error: null });
      try {
        const profile = await repository.saveProfile(input);
        set({ profile, status: 'ready' });
        return profile;
      } catch (err) {
        set({ status: 'error', error: err instanceof Error ? err.message : String(err) });
        throw err;
      }
    },
  }));
}

/** App-wide singleton store, wired to the real (SQLite) repository. */
export const useBusinessProfileStore = createBusinessProfileStore();
