import { render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { createItemStore } from '@/state/itemStore';
import { createInvoiceTypeStore } from '@/state/invoiceTypeStore';
import { InMemoryItemRepository } from '@/data/item/InMemoryItemRepository';
import { InMemoryBusinessRepository } from '@/data/business/InMemoryBusinessRepository';
import { EMPTY_ITEM_INPUT } from '@/domain/item/types';

let mockItemStore: ReturnType<typeof createItemStore>;
let mockInvoiceTypeStore: ReturnType<typeof createInvoiceTypeStore>;

jest.mock('@/state/itemStore', () => {
  const actual = jest.requireActual('@/state/itemStore');
  return {
    ...actual,
    useItemStore: (...args: unknown[]) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockItemStore as any)(...args),
  };
});

jest.mock('@/state/invoiceTypeStore', () => {
  const actual = jest.requireActual('@/state/invoiceTypeStore');
  return {
    ...actual,
    useInvoiceTypeStore: (...args: unknown[]) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockInvoiceTypeStore as any)(...args),
  };
});

import { EditItemScreen } from '../EditItemScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

function renderScreen(itemId: string) {
  return render(
    <EditItemScreen navigation={navigation as never} route={{ params: { itemId } } as never} />,
  );
}

describe('EditItemScreen', () => {
  beforeEach(() => {
    mockInvoiceTypeStore = createInvoiceTypeStore(new InMemoryBusinessRepository());
    (navigation.navigate as jest.Mock).mockClear();
    (navigation.goBack as jest.Mock).mockClear();
  });

  it('shows a not-found state for a missing item id', async () => {
    mockItemStore = createItemStore(new InMemoryItemRepository());
    const view = await renderScreen('missing');

    await waitFor(() => expect(view.getByTestId('edit-item-not-found')).toBeTruthy());
  });

  it('pre-fills the form with the existing item', async () => {
    const repo = new InMemoryItemRepository();
    const created = await repo.create({
      ...EMPTY_ITEM_INPUT,
      name: 'Steel Pipe',
      defaultPrice: 10,
      sku: 'STL-1',
    });
    mockItemStore = createItemStore(repo);
    const view = await renderScreen(created.id);

    await waitFor(() => expect(view.getByTestId('field-name').props.value).toBe('Steel Pipe'));
    expect(view.getByTestId('field-defaultPrice').props.value).toBe('10');
    expect(view.getByTestId('field-sku').props.value).toBe('STL-1');
  });
});
