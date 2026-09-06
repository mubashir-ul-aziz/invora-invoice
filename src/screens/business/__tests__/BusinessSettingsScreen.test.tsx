import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { BusinessSettingsScreen } from '../BusinessSettingsScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

function renderScreen() {
  return render(<BusinessSettingsScreen navigation={navigation as never} route={{} as never} />);
}

describe('BusinessSettingsScreen', () => {
  beforeEach(() => {
    (navigation.navigate as jest.Mock).mockClear();
  });

  it('navigates to Edit Business, Invoice Settings, and Digital Card', async () => {
    const view = await renderScreen();

    fireEvent.press(view.getByTestId('settings-row-profile'));
    expect(navigation.navigate).toHaveBeenCalledWith('EditBusiness');

    fireEvent.press(view.getByTestId('settings-row-invoice'));
    expect(navigation.navigate).toHaveBeenCalledWith('InvoiceSettings');

    fireEvent.press(view.getByTestId('settings-row-card'));
    expect(navigation.navigate).toHaveBeenCalledWith('DigitalCard');
  });
});
