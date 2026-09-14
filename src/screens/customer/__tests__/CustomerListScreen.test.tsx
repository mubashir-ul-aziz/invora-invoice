import { Alert } from 'react-native';
import { fireEvent, render, waitFor, within } from '@testing-library/react-native';
import React from 'react';

import { InMemoryCustomerActivityRepository } from '@/data/customerActivity/InMemoryCustomerActivityRepository';
import { createCustomerStore } from '@/state/customerStore';
import { InMemoryCustomerRepository } from '@/data/customer/InMemoryCustomerRepository';
import { EMPTY_CUSTOMER_INPUT, type CustomerActivityEntry } from '@/domain/customer/types';
import { createCustomerBalancesStore } from '@/state/customerBalancesStore';

let mockStore: ReturnType<typeof createCustomerStore>;
// Never wired to the real (SQLite-backed) repository in tests — same reason
// Dashboard's tests mock `businessProfileStore`: this screen's balance badges
// are a bonus, not what any of these tests assert on, so they're backed by
// an in-memory repository that defaults to "no activity" for every customer.
let mockBalancesStore: ReturnType<typeof createCustomerBalancesStore>;

jest.mock('@/state/customerStore', () => {
  const actual = jest.requireActual('@/state/customerStore');
  return {
    ...actual,
    useCustomerStore: (...args: unknown[]) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockStore as any)(...args),
  };
});

jest.mock('@/state/customerBalancesStore', () => {
  const actual = jest.requireActual('@/state/customerBalancesStore');
  return {
    ...actual,
    useCustomerBalancesStore: (...args: unknown[]) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockBalancesStore as any)(...args),
  };
});

import { CustomerListScreen } from '../CustomerListScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

function renderScreen(routeParams?: { onSelectCustomer?: (customer: never) => void }) {
  return render(
    <CustomerListScreen navigation={navigation as never} route={{ params: routeParams } as never} />,
  );
}

describe('CustomerListScreen', () => {
  beforeEach(() => {
    (navigation.navigate as jest.Mock).mockClear();
    (navigation.goBack as jest.Mock).mockClear();
    mockBalancesStore = createCustomerBalancesStore(new InMemoryCustomerActivityRepository());
  });

  it('shows an empty-state prompt when no customers exist', async () => {
    mockStore = createCustomerStore(new InMemoryCustomerRepository());
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('customer-list-empty')).toBeTruthy());
  });

  it('lists saved customers', async () => {
    const repo = new InMemoryCustomerRepository();
    await repo.create({ ...EMPTY_CUSTOMER_INPUT, name: 'Acme Co' });
    mockStore = createCustomerStore(repo);
    const view = await renderScreen();

    await waitFor(() => expect(view.getByText('Acme Co')).toBeTruthy());
  });

  it('navigates to Create Customer', async () => {
    mockStore = createCustomerStore(new InMemoryCustomerRepository());
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('action-create-customer')).toBeTruthy());
    fireEvent.press(view.getByTestId('action-create-customer'));
    expect(navigation.navigate).toHaveBeenCalledWith('CreateCustomer', undefined);
  });

  it('navigates to Customer Detail when tapping a row in normal mode', async () => {
    const repo = new InMemoryCustomerRepository();
    const created = await repo.create({ ...EMPTY_CUSTOMER_INPUT, name: 'Acme Co' });
    mockStore = createCustomerStore(repo);
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId(`customer-row-${created.id}`)).toBeTruthy());
    fireEvent.press(view.getByTestId(`customer-row-${created.id}`));
    expect(navigation.navigate).toHaveBeenCalledWith('CustomerDetail', { customerId: created.id });
  });

  it('calls onSelectCustomer and goes back when tapping a row in picker mode', async () => {
    const repo = new InMemoryCustomerRepository();
    const created = await repo.create({ ...EMPTY_CUSTOMER_INPUT, name: 'Acme Co' });
    mockStore = createCustomerStore(repo);
    const onSelectCustomer = jest.fn();
    const view = await renderScreen({ onSelectCustomer });

    await waitFor(() => expect(view.getByTestId(`customer-row-${created.id}`)).toBeTruthy());
    fireEvent.press(view.getByTestId(`customer-row-${created.id}`));

    expect(onSelectCustomer).toHaveBeenCalledWith(expect.objectContaining({ id: created.id }));
    expect(navigation.goBack).toHaveBeenCalled();
    expect(navigation.navigate).not.toHaveBeenCalledWith('CustomerDetail', expect.anything());
  });

  it('forwards onSelectCustomer as onCreated when creating from picker mode', async () => {
    mockStore = createCustomerStore(new InMemoryCustomerRepository());
    const onSelectCustomer = jest.fn();
    const view = await renderScreen({ onSelectCustomer });

    await waitFor(() => expect(view.getByTestId('action-create-customer')).toBeTruthy());
    fireEvent.press(view.getByTestId('action-create-customer'));
    expect(navigation.navigate).toHaveBeenCalledWith('CreateCustomer', { onCreated: onSelectCustomer });
  });

  it('filters the list by search text', async () => {
    const repo = new InMemoryCustomerRepository();
    await repo.create({ ...EMPTY_CUSTOMER_INPUT, name: 'Acme Co' });
    await repo.create({ ...EMPTY_CUSTOMER_INPUT, name: 'Globex Inc' });
    mockStore = createCustomerStore(repo);
    const view = await renderScreen();

    await waitFor(() => expect(view.getByText('Acme Co')).toBeTruthy());
    fireEvent.changeText(view.getByTestId('customer-search'), 'globex');

    await waitFor(() => expect(view.queryByText('Acme Co')).toBeNull());
    expect(view.getByText('Globex Inc')).toBeTruthy();
  });

  it('navigates to Edit Customer when tapping the edit action', async () => {
    const repo = new InMemoryCustomerRepository();
    const created = await repo.create({ ...EMPTY_CUSTOMER_INPUT, name: 'Acme Co' });
    mockStore = createCustomerStore(repo);
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId(`customer-row-${created.id}-edit`)).toBeTruthy());
    fireEvent.press(view.getByTestId(`customer-row-${created.id}-edit`));

    expect(navigation.navigate).toHaveBeenCalledWith('EditCustomer', { customerId: created.id });
  });

  it('deletes a customer after confirming', async () => {
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_title, _message, buttons) => {
        const destructive = buttons?.find((button) => button.style === 'destructive');
        destructive?.onPress?.();
      });

    const repo = new InMemoryCustomerRepository();
    const created = await repo.create({ ...EMPTY_CUSTOMER_INPUT, name: 'Acme Co' });
    mockStore = createCustomerStore(repo);
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId(`customer-row-${created.id}-delete`)).toBeTruthy());
    fireEvent.press(view.getByTestId(`customer-row-${created.id}-delete`));

    await waitFor(() => expect(view.getByTestId('customer-list-empty')).toBeTruthy());
    alertSpy.mockRestore();
  });

  it('shows a real outstanding balance and lets the Due/Settled pills filter by it', async () => {
    const repo = new InMemoryCustomerRepository();
    const paid = await repo.create({ ...EMPTY_CUSTOMER_INPUT, name: 'Acme Co' });
    const owing = await repo.create({ ...EMPTY_CUSTOMER_INPUT, name: 'Zeta Ltd' });
    mockStore = createCustomerStore(repo);

    const entries: Record<string, CustomerActivityEntry[]> = {
      [owing.id]: [
        {
          id: 'inv1',
          type: 'invoice',
          date: '2026-01-01T00:00:00.000Z',
          title: 'Invoice INV-1',
          amount: 250,
          status: 'unpaid',
        },
      ],
    };
    mockBalancesStore = createCustomerBalancesStore(new InMemoryCustomerActivityRepository(entries));

    const view = await renderScreen();

    await waitFor(() =>
      expect(within(view.getByTestId(`customer-row-${owing.id}`)).getByText('250.00')).toBeTruthy(),
    );
    expect(within(view.getByTestId(`customer-row-${paid.id}`)).getByText('0.00')).toBeTruthy();

    fireEvent.press(view.getByTestId('customer-filter-settled'));
    await waitFor(() => expect(view.queryByText('Zeta Ltd')).toBeNull());
    expect(view.getByText('Acme Co')).toBeTruthy();

    fireEvent.press(view.getByTestId('customer-filter-due'));
    await waitFor(() => expect(view.queryByText('Acme Co')).toBeNull());
    expect(view.getByText('Zeta Ltd')).toBeTruthy();
  });
});
