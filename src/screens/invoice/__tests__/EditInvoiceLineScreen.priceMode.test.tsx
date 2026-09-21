import { render, waitFor, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { InMemoryBusinessRepository } from '@/data/business/InMemoryBusinessRepository';
import { createInvoiceTypeStore } from '@/state/invoiceTypeStore';
import { useInvoiceDraftStore } from '@/state/invoiceDraftStore';

let mockInvoiceTypeStore: ReturnType<typeof createInvoiceTypeStore>;

jest.mock('@/state/invoiceTypeStore', () => {
  const actual = jest.requireActual('@/state/invoiceTypeStore');
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useInvoiceTypeStore: (...args: unknown[]) => (mockInvoiceTypeStore as any)(...args),
  };
});

import { EditInvoiceLineScreen } from '../EditInvoiceLineScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

async function renderAreaLine() {
  mockInvoiceTypeStore = createInvoiceTypeStore(new InMemoryBusinessRepository());
  useInvoiceDraftStore.getState().reset();
  useInvoiceDraftStore.getState().startCreate({ invoiceTypeId: 'area' });
  const view = await render(
    <EditInvoiceLineScreen navigation={navigation as never} route={{ params: { lineIndex: null } } as never} />,
  );
  await waitFor(() => expect(view.getByTestId('field-itemName')).toBeTruthy());
  return view;
}

/** Non-submitting checks only — the submitting one lives in its own file (see the codebase-wide note on react-hook-form's async resolver). */
describe('EditInvoiceLineScreen price mode toggle', () => {
  it('starts in Unit Price mode: unit price input, no total price input, live quantity and total', async () => {
    const view = await renderAreaLine();

    expect(view.getByTestId('field-priceMode-unit').props.accessibilityState.selected).toBe(true);
    expect(view.getByTestId('field-unitPrice')).toBeTruthy();
    expect(view.queryByTestId('field-totalPrice')).toBeNull();

    await fireEvent.changeText(view.getByTestId('field-length'), '20');
    await fireEvent.changeText(view.getByTestId('field-width'), '10');
    await fireEvent.changeText(view.getByTestId('field-unitPrice'), '10');

    await waitFor(() => expect(view.getByTestId('invoice-line-preview-subtotal')).toHaveTextContent(/2000.00/));
    expect(view.getByTestId('invoice-line-preview-quantity')).toHaveTextContent(/200/);
  });

  it('Total Item Price mode: swaps to the total price input, keeps the measurement fields, and never multiplies by quantity', async () => {
    const view = await renderAreaLine();

    await fireEvent.changeText(view.getByTestId('field-length'), '10');
    await fireEvent.changeText(view.getByTestId('field-width'), '10');
    await fireEvent.press(view.getByTestId('field-priceMode-total'));

    await waitFor(() => expect(view.getByTestId('field-totalPrice')).toBeTruthy());
    expect(view.queryByTestId('field-unitPrice')).toBeNull();
    // Measurement info is still there.
    expect(view.getByTestId('field-length')).toBeTruthy();
    expect(view.getByTestId('field-width')).toBeTruthy();

    await fireEvent.changeText(view.getByTestId('field-totalPrice'), '900');

    await waitFor(() => expect(view.getByTestId('invoice-line-preview-subtotal')).toHaveTextContent(/900.00/));
    expect(view.getByTestId('invoice-line-preview-quantity')).toHaveTextContent(/100/);
    expect(view.getByTestId('invoice-line-total-preview')).not.toHaveTextContent(/90000/);
  });

  it('switching modes keeps what was typed in each', async () => {
    const view = await renderAreaLine();

    await fireEvent.changeText(view.getByTestId('field-unitPrice'), '8');
    await fireEvent.press(view.getByTestId('field-priceMode-total'));
    await waitFor(() => expect(view.getByTestId('field-totalPrice')).toBeTruthy());
    await fireEvent.changeText(view.getByTestId('field-totalPrice'), '900');
    await fireEvent.press(view.getByTestId('field-priceMode-unit'));

    await waitFor(() => expect(view.getByTestId('field-unitPrice').props.value).toBe('8'));
  });
});
