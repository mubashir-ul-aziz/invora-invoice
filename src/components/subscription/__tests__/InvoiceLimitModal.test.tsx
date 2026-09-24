import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { getUsagePeriod, computeInvoiceUsage } from '@/domain/subscription/invoiceAccess';

import { InvoiceLimitModal } from '../InvoiceLimitModal';

const usage = computeInvoiceUsage('free', 5, getUsagePeriod(Date.now()));

describe('InvoiceLimitModal', () => {
  it('renders nothing meaningful when not visible', async () => {
    const view = await render(
      <InvoiceLimitModal visible={false} usage={usage} planLabel="Free" onUpgrade={jest.fn()} onDismiss={jest.fn()} />,
    );
    expect(view.queryByTestId('invoice-limit-modal-upgrade')).toBeNull();
  });

  it('shows the real usage numbers and plan label — never a hardcoded limit', async () => {
    const view = await render(
      <InvoiceLimitModal visible usage={usage} planLabel="Free" onUpgrade={jest.fn()} onDismiss={jest.fn()} />,
    );
    expect(view.getByText('Free plan')).toBeTruthy();
    expect(view.getByText('5 / 5')).toBeTruthy();
    expect(view.getByText(/reached your 5 invoice limit|5 invoices a month/)).toBeTruthy();
  });

  it('calls onUpgrade and onDismiss from their respective buttons', async () => {
    const onUpgrade = jest.fn();
    const onDismiss = jest.fn();
    const view = await render(
      <InvoiceLimitModal visible usage={usage} planLabel="Free" onUpgrade={onUpgrade} onDismiss={onDismiss} />,
    );

    await fireEvent.press(view.getByTestId('invoice-limit-modal-upgrade'));
    expect(onUpgrade).toHaveBeenCalledTimes(1);

    await fireEvent.press(view.getByTestId('invoice-limit-modal-dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('dismisses when the backdrop is tapped', async () => {
    const onDismiss = jest.fn();
    const view = await render(
      <InvoiceLimitModal visible usage={usage} planLabel="Free" onUpgrade={jest.fn()} onDismiss={onDismiss} />,
    );
    await fireEvent.press(view.getByTestId('invoice-limit-modal-backdrop'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('handles a null usage reading (not yet loaded) without crashing', async () => {
    const view = await render(
      <InvoiceLimitModal visible usage={null} planLabel="Free" onUpgrade={jest.fn()} onDismiss={jest.fn()} />,
    );
    expect(view.getByTestId('invoice-limit-modal-upgrade')).toBeTruthy();
  });

  it('never claims a limit for Unlimited (limit: null)', async () => {
    const unlimitedUsage = computeInvoiceUsage('unlimited', 300, getUsagePeriod(Date.now()));
    const view = await render(
      <InvoiceLimitModal visible usage={unlimitedUsage} planLabel="Unlimited" onUpgrade={jest.fn()} onDismiss={jest.fn()} />,
    );
    expect(view.queryByText(/\/ null/)).toBeNull();
    expect(view.getByText('300')).toBeTruthy();
  });
});
