import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { SettingsScreen } from '../SettingsScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

function renderScreen() {
  return render(<SettingsScreen navigation={navigation as never} route={{} as never} />);
}

/** Own file — see the note in `SettingsScreen.test.tsx`. */
describe('SettingsScreen Security/Account sections', () => {
  it('routes Security and Account to their own screens', async () => {
    const view = await renderScreen();

    fireEvent.press(view.getByTestId('settings-row-security'));
    expect(navigation.navigate).toHaveBeenCalledWith('Security');

    fireEvent.press(view.getByTestId('settings-row-account'));
    expect(navigation.navigate).toHaveBeenCalledWith('Account');
  });
});
