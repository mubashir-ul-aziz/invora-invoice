import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { CustomerLockedModal } from '../CustomerLockedModal';

describe('CustomerLockedModal', () => {
  it('renders nothing meaningful when not visible', async () => {
    const view = await render(<CustomerLockedModal visible={false} onUpgrade={jest.fn()} onDismiss={jest.fn()} />);
    expect(view.queryByTestId('customer-locked-modal-upgrade')).toBeNull();
  });

  it('names the customer and reassures that their info is not locked', async () => {
    const view = await render(
      <CustomerLockedModal visible customerName="Acme Co" onUpgrade={jest.fn()} onDismiss={jest.fn()} />,
    );
    expect(view.getByText('Customer history is locked')).toBeTruthy();
    expect(view.getByText('Acme Co')).toBeTruthy();
    expect(view.getByText(/stays available/)).toBeTruthy();
  });

  it('renders without a customer name (e.g. name not yet loaded)', async () => {
    const view = await render(<CustomerLockedModal visible onUpgrade={jest.fn()} onDismiss={jest.fn()} />);
    expect(view.getByTestId('customer-locked-modal-upgrade')).toBeTruthy();
  });

  it('calls onUpgrade and onDismiss from their respective buttons', async () => {
    const onUpgrade = jest.fn();
    const onDismiss = jest.fn();
    const view = await render(
      <CustomerLockedModal visible customerName="Acme Co" onUpgrade={onUpgrade} onDismiss={onDismiss} />,
    );

    await fireEvent.press(view.getByTestId('customer-locked-modal-upgrade'));
    expect(onUpgrade).toHaveBeenCalledTimes(1);

    await fireEvent.press(view.getByTestId('customer-locked-modal-dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('dismisses when the backdrop is tapped', async () => {
    const onDismiss = jest.fn();
    const view = await render(
      <CustomerLockedModal visible customerName="Acme Co" onUpgrade={jest.fn()} onDismiss={onDismiss} />,
    );
    await fireEvent.press(view.getByTestId('customer-locked-modal-backdrop'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
