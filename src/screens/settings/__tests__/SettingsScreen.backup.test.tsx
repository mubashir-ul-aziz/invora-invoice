import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { SettingsScreen } from '../SettingsScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

function renderScreen() {
  return render(<SettingsScreen navigation={navigation as never} route={{} as never} />);
}

/** Own file — see the note in `SettingsScreen.test.tsx`. Updated for Phase 11: Backup & Restore is now a real screen, not a placeholder alert. */
describe('SettingsScreen Backup section', () => {
  it('navigates to the real Backup & Restore screen', async () => {
    const view = await renderScreen();

    fireEvent.press(view.getByTestId('settings-row-backup'));

    expect(navigation.navigate).toHaveBeenCalledWith('Backup');
  });
});
