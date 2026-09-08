import { render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { InMemoryBusinessRepository } from '@/data/business/InMemoryBusinessRepository';
import { InMemoryDashboardRepository } from '@/data/dashboard/InMemoryDashboardRepository';
import { createDashboardStore } from '@/state/dashboardStore';
import { createInvoiceSettingsStore } from '@/state/invoiceSettingsStore';
import { createInvoiceTypeStore } from '@/state/invoiceTypeStore';

let mockDashboardStore: ReturnType<typeof createDashboardStore>;
let mockInvoiceTypeStore: ReturnType<typeof createInvoiceTypeStore>;
let mockInvoiceSettingsStore: ReturnType<typeof createInvoiceSettingsStore>;

jest.mock('@/state/dashboardStore', () => {
  const actual = jest.requireActual('@/state/dashboardStore');
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useDashboardStore: (...args: unknown[]) => (mockDashboardStore as any)(...args),
  };
});

jest.mock('@/state/invoiceTypeStore', () => {
  const actual = jest.requireActual('@/state/invoiceTypeStore');
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useInvoiceTypeStore: (...args: unknown[]) => (mockInvoiceTypeStore as any)(...args),
  };
});

jest.mock('@/state/invoiceSettingsStore', () => {
  const actual = jest.requireActual('@/state/invoiceSettingsStore');
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useInvoiceSettingsStore: (...args: unknown[]) => (mockInvoiceSettingsStore as any)(...args),
  };
});

import { DashboardScreen } from '../DashboardScreen';

const navigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  popToTop: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
};

/**
 * Kept in its own file — running it alongside `DashboardScreen.test.tsx`'s
 * other render-heavy tests produced React Testing Library "overlapping
 * act()" warnings and a flaky assertion, the same instability class Phases
 * 1–3 already documented and worked around by splitting one concern per
 * test file.
 */
describe('DashboardScreen — focus refresh', () => {
  beforeEach(() => {
    (navigation.addListener as jest.Mock).mockClear();
    mockInvoiceTypeStore = createInvoiceTypeStore(new InMemoryBusinessRepository());
    mockInvoiceSettingsStore = createInvoiceSettingsStore(new InMemoryBusinessRepository());
  });

  it('registers a focus listener so returning to this screen refreshes the summary', async () => {
    mockDashboardStore = createDashboardStore(new InMemoryDashboardRepository());
    await render(<DashboardScreen navigation={navigation as never} route={{} as never} />);

    await waitFor(() => expect(navigation.addListener).toHaveBeenCalledWith('focus', expect.any(Function)));
  });
});
