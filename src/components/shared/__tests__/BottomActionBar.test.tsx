import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import { BottomActionBar } from '@/components/shared/BottomActionBar';

describe('BottomActionBar', () => {
  it('renders the primary and secondary actions and invokes them', async () => {
    const onSave = jest.fn();
    const onCancel = jest.fn();
    const view = await render(
      <BottomActionBar
        secondary={{ label: 'Cancel', onPress: onCancel, testID: 'cancel' }}
        primary={{ label: 'Saving…', accessibilityLabel: 'Save', icon: 'check', onPress: onSave, testID: 'save' }}
      >
        <Text>Total £10.00</Text>
      </BottomActionBar>,
    );

    expect(view.getByText('Total £10.00')).toBeTruthy();
    expect(view.getByLabelText('Save')).toBeTruthy();

    await fireEvent.press(view.getByTestId('save'));
    await fireEvent.press(view.getByTestId('cancel'));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('does not invoke a disabled action', async () => {
    const onSave = jest.fn();
    const view = await render(<BottomActionBar primary={{ label: 'Save', onPress: onSave, disabled: true, testID: 'save' }} />);

    expect(view.getByTestId('save')).toBeDisabled();
    await fireEvent.press(view.getByTestId('save'));
    expect(onSave).not.toHaveBeenCalled();
  });
});
