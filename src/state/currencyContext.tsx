import React, { createContext, useCallback, useContext, useEffect } from 'react';

import { formatCurrency, getCurrencySymbol } from '@/domain/business/currency';
import { useBusinessProfileStore } from '@/state/businessProfileStore';

/**
 * The currency code money amounts are shown in, read everywhere a money
 * amount is shown — list rows, totals, summary cards, the price-input
 * prefix — via `useCurrencySymbol()` / `useFormatMoney()`.
 *
 * `<CurrencyProvider>` (mounted once in `App.tsx`) supplies the business's
 * own `BusinessProfile.currency` app-wide. Any screen showing one invoice's
 * amounts (Invoice Detail, Record/Edit Payment, the invoice editor, PDF
 * preview) wraps its content in `<InvoiceCurrencyProvider>` with that
 * invoice's saved `Invoice.currency`, so every nested row/card/input uses
 * the invoice's currency instead of the business default.
 *
 * A React Context (not a direct `useBusinessProfileStore()` call in every
 * display component) so that component-level tests, which render e.g.
 * `ItemListRow` on its own with no provider in the tree, get the safe `"$"`
 * default instead of each needing to mock the business store.
 */
const CurrencyContext = createContext<string | null>(null);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const profile = useBusinessProfileStore((state) => state.profile);
  const load = useBusinessProfileStore((state) => state.load);

  useEffect(() => {
    load();
  }, [load]);

  return <CurrencyContext.Provider value={profile?.currency ?? null}>{children}</CurrencyContext.Provider>;
}

/**
 * Scopes everything inside it to one invoice's saved currency. A missing
 * currency (an invoice saved before `Invoice.currency` existed) falls back
 * to the surrounding (business) currency.
 */
export function InvoiceCurrencyProvider({ currency, children }: { currency: string | null | undefined; children: React.ReactNode }) {
  const fallback = useContext(CurrencyContext);
  return <CurrencyContext.Provider value={currency || fallback}>{children}</CurrencyContext.Provider>;
}

/** The current 3-letter currency code, or null before the business profile has loaded. */
export function useCurrencyCode(): string | null {
  return useContext(CurrencyContext);
}

export function useCurrencySymbol(): string {
  return getCurrencySymbol(useContext(CurrencyContext));
}

/** `(3000) => "€3,000.00"` in the current currency — see `formatCurrency`. */
export function useFormatMoney(): (amount: number) => string {
  const currency = useContext(CurrencyContext);
  return useCallback((amount: number) => formatCurrency(amount, currency), [currency]);
}

/** Resolves an invoice's own currency against the current (business) one — for screens that render outside their own `InvoiceCurrencyProvider`. */
export function useInvoiceCurrency(currency: string | null | undefined): string | null {
  const fallback = useContext(CurrencyContext);
  return currency || fallback;
}

/** `useFormatMoney()` for one invoice's own currency — for list rows that each show a different invoice. */
export function useInvoiceFormatMoney(currency: string | null | undefined): (amount: number) => string {
  const resolved = useInvoiceCurrency(currency);
  return useCallback((amount: number) => formatCurrency(amount, resolved), [resolved]);
}
