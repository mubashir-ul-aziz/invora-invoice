import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { SettingsScreen } from '../SettingsScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

function renderScreen() {
  return render(<SettingsScreen navigation={navigation as never} route={{} as never} />);
}

/** Own file — see the note in `SettingsScreen.test.tsx`. */
describe('SettingsScreen Invoice section', () => {
  it("routes every row to its screen, per the brief's six named items", async () => {
    const view = await renderScreen();

    fireEvent.press(view.getByTestId('settings-row-invoice-type'));
    expect(navigation.navigate).toHaveBeenCalledWith('InvoiceTypeSelection');

    fireEvent.press(view.getByTestId('settings-row-invoice-numbering'));
    expect(navigation.navigate).toHaveBeenLastCalledWith('InvoiceSettings');

    fireEvent.press(view.getByTestId('settings-row-currency'));
    expect(navigation.navigate).toHaveBeenLastCalledWith('InvoiceSettings');

    fireEvent.press(view.getByTestId('settings-row-tax'));
    expect(navigation.navigate).toHaveBeenLastCalledWith('InvoiceSettings');

    fireEvent.press(view.getByTestId('settings-row-payment-terms'));
    expect(navigation.navigate).toHaveBeenLastCalledWith('InvoiceSettings');

    fireEvent.press(view.getByTestId('settings-row-invoice-template'));
    expect(navigation.navigate).toHaveBeenLastCalledWith('InvoiceTemplates');
  });
});
