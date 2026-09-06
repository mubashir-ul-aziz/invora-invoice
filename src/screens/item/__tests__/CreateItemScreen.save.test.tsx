import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { createItemStore } from '@/state/itemStore';
import { createInvoiceTypeStore } from '@/state/invoiceTypeStore';
import { InMemoryItemRepository } from '@/data/item/InMemoryItemRepository';
import { InMemoryBusinessRepository } from '@/data/business/InMemoryBusinessRepository';

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

import { CreateItemScreen } from '../CreateItemScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

/** One test per file — see the note in `CreateItemScreen.validation.test.tsx`. */
describe('CreateItemScreen.save', () => {
  beforeEach(() => {
    mockInvoiceTypeStore = createInvoiceTypeStore(new InMemoryBusinessRepository());
    (navigation.navigate as jest.Mock).mockClear();
    (navigation.goBack as jest.Mock).mockClear();
  });

  it('creates the item and navigates back', async () => {
    const repo = new InMemoryItemRepository();
    mockItemStore = createItemStore(repo);

    const view = await render(
      <CreateItemScreen navigation={navigation as never} route={{ params: undefined } as never} />,
    );

    await waitFor(() => expect(view.getByTestId('save-item')).toBeTruthy());
    fireEvent.changeText(view.getByTestId('field-name'), 'Steel Pipe');
    fireEvent.changeText(view.getByTestId('field-defaultPrice'), '12.5');
    fireEvent.press(view.getByTestId('save-item'));

    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    const items = await repo.list();
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Steel Pipe');
    expect(items[0].defaultPrice).toBe(12.5);
  });
});
