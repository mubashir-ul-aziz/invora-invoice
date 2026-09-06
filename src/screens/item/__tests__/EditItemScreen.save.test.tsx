import { fireEvent, render, waitFor } from '@testing-library/react-native';
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

describe('EditItemScreen.save', () => {
  beforeEach(() => {
    mockInvoiceTypeStore = createInvoiceTypeStore(new InMemoryBusinessRepository());
    (navigation.navigate as jest.Mock).mockClear();
    (navigation.goBack as jest.Mock).mockClear();
  });

  it('saves the edited item and navigates back, keeping the same id', async () => {
    const repo = new InMemoryItemRepository();
    const created = await repo.create({ ...EMPTY_ITEM_INPUT, name: 'Steel Pipe', defaultPrice: 10 });
    mockItemStore = createItemStore(repo);

    const view = await render(
      <EditItemScreen
        navigation={navigation as never}
        route={{ params: { itemId: created.id } } as never}
      />,
    );

    await waitFor(() => expect(view.getByTestId('field-name').props.value).toBe('Steel Pipe'));
    fireEvent.changeText(view.getByTestId('field-name'), 'Steel Tube');
    fireEvent.press(view.getByTestId('save-item'));

    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    const updated = await repo.getById(created.id);
    expect(updated?.name).toBe('Steel Tube');
    expect(updated?.id).toBe(created.id);
  });
});
