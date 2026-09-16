import React, { createContext, useContext, useEffect } from 'react';

import { getCurrencySymbol } from '@/domain/business/currency';
import { useBusinessProfileStore } from '@/state/businessProfileStore';

/**
 * App-wide currency symbol, resolved once here from the business's own
 * `BusinessProfile.currency` (set on Business/Invoice Settings) and read
 * everywhere a money amount is shown — list rows, totals, summary cards, the
 * price-input prefix — via `useCurrencySymbol()`. A React Context (not a
 * direct `useBusinessProfileStore()` call in every display component) so
 * that component-level tests, which render e.g. `ItemListRow` on its own
 * with no provider in the tree, get the safe `"$"` default instead of each
 * needing to mock the business store — only `<CurrencyProvider>` (mounted
 * once in `App.tsx`) touches the store.
 */
const CurrencyContext = createContext<string>('$');

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const profile = useBusinessProfileStore((state) => state.profile);
  const load = useBusinessProfileStore((state) => state.load);

  useEffect(() => {
    load();
  }, [load]);

  return <CurrencyContext.Provider value={getCurrencySymbol(profile?.currency)}>{children}</CurrencyContext.Provider>;
}

export function useCurrencySymbol(): string {
  return useContext(CurrencyContext);
}
