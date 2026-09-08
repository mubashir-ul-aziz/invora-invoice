import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { SettingsScreen } from '../SettingsScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

function renderScreen() {
  return render(<SettingsScreen navigation={navigation as never} route={{} as never} />);
}

/** Own file — see the note in `SettingsScreen.test.tsx`. Phase 12: Cloud Backup is a second, independent row alongside Backup & Restore. */
describe('SettingsScreen Cloud Backup row', () => {
  it('navigates to the Cloud Backup screen', async () => {
    const view = await renderScreen();

    fireEvent.press(view.getByTestId('settings-row-cloud-backup'));

    expect(navigation.navigate).toHaveBeenCalledWith('CloudBackup');
  });
});
