import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { createItemStore } from '@/state/itemStore';
import { InMemoryItemRepository } from '@/data/item/InMemoryItemRepository';
import { EMPTY_ITEM_INPUT } from '@/domain/item/types';

let mockStore: ReturnType<typeof createItemStore>;

jest.mock('@/state/itemStore', () => {
  const actual = jest.requireActual('@/state/itemStore');
  return {
    ...actual,
    useItemStore: (...args: unknown[]) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockStore as any)(...args),
  };
});

import { ItemListScreen } from '../ItemListScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

function renderScreen(routeParams?: { onSelectItem?: (item: never) => void }) {
  return render(
    <ItemListScreen navigation={navigation as never} route={{ params: routeParams } as never} />,
  );
}

describe('ItemListScreen', () => {
  beforeEach(() => {
    (navigation.navigate as jest.Mock).mockClear();
    (navigation.goBack as jest.Mock).mockClear();
  });

  it('shows an empty-state prompt when no items exist', async () => {
    mockStore = createItemStore(new InMemoryItemRepository());
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('item-list-empty')).toBeTruthy());
  });

  it('lists saved items', async () => {
    const repo = new InMemoryItemRepository();
    await repo.create({ ...EMPTY_ITEM_INPUT, name: 'Steel Pipe', defaultPrice: 10 });
    mockStore = createItemStore(repo);
    const view = await renderScreen();

    await waitFor(() => expect(view.getByText('Steel Pipe')).toBeTruthy());
  });

  it('navigates to Create Item', async () => {
    mockStore = createItemStore(new InMemoryItemRepository());
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('action-create-item')).toBeTruthy());
    fireEvent.press(view.getByTestId('action-create-item'));
    expect(navigation.navigate).toHaveBeenCalledWith('CreateItem', undefined);
  });

  it('navigates to Edit Item when tapping a row in normal mode', async () => {
    const repo = new InMemoryItemRepository();
    const created = await repo.create({ ...EMPTY_ITEM_INPUT, name: 'Steel Pipe' });
    mockStore = createItemStore(repo);
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId(`item-row-${created.id}`)).toBeTruthy());
    fireEvent.press(view.getByTestId(`item-row-${created.id}`));
    expect(navigation.navigate).toHaveBeenCalledWith('EditItem', { itemId: created.id });
  });

  it('calls onSelectItem and goes back when tapping a row in picker mode', async () => {
    const repo = new InMemoryItemRepository();
    const created = await repo.create({ ...EMPTY_ITEM_INPUT, name: 'Steel Pipe' });
    mockStore = createItemStore(repo);
    const onSelectItem = jest.fn();
    const view = await renderScreen({ onSelectItem });

    await waitFor(() => expect(view.getByTestId(`item-row-${created.id}`)).toBeTruthy());
    fireEvent.press(view.getByTestId(`item-row-${created.id}`));

    expect(onSelectItem).toHaveBeenCalledWith(expect.objectContaining({ id: created.id }));
    expect(navigation.goBack).toHaveBeenCalled();
    expect(navigation.navigate).not.toHaveBeenCalledWith('EditItem', expect.anything());
  });

  it('forwards onSelectItem as onCreated when creating from picker mode', async () => {
    mockStore = createItemStore(new InMemoryItemRepository());
    const onSelectItem = jest.fn();
    const view = await renderScreen({ onSelectItem });

    await waitFor(() => expect(view.getByTestId('action-create-item')).toBeTruthy());
    fireEvent.press(view.getByTestId('action-create-item'));
    expect(navigation.navigate).toHaveBeenCalledWith('CreateItem', { onCreated: onSelectItem });
  });

  it('filters the list by search text', async () => {
    const repo = new InMemoryItemRepository();
    await repo.create({ ...EMPTY_ITEM_INPUT, name: 'Steel Pipe' });
    await repo.create({ ...EMPTY_ITEM_INPUT, name: 'Wood Plank' });
    mockStore = createItemStore(repo);
    const view = await renderScreen();

    await waitFor(() => expect(view.getByText('Steel Pipe')).toBeTruthy());
    fireEvent.changeText(view.getByTestId('item-search'), 'wood');

    await waitFor(() => expect(view.queryByText('Steel Pipe')).toBeNull());
    expect(view.getByText('Wood Plank')).toBeTruthy();
  });

  it('deletes an item after confirming', async () => {
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_title, _message, buttons) => {
        const destructive = buttons?.find((button) => button.style === 'destructive');
        destructive?.onPress?.();
      });

    const repo = new InMemoryItemRepository();
    const created = await repo.create({ ...EMPTY_ITEM_INPUT, name: 'Steel Pipe' });
    mockStore = createItemStore(repo);
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId(`item-row-${created.id}-delete`)).toBeTruthy());
    fireEvent.press(view.getByTestId(`item-row-${created.id}-delete`));

    await waitFor(() => expect(view.getByTestId('item-list-empty')).toBeTruthy());
    alertSpy.mockRestore();
  });
});
