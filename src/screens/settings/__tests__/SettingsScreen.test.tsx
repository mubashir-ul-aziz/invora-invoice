import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { SettingsScreen } from '../SettingsScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

function renderScreen() {
  return render(<SettingsScreen navigation={navigation as never} route={{} as never} />);
}

/**
 * Split into one test per file (`SettingsScreen.invoice.test.tsx`,
 * `SettingsScreen.backup.test.tsx`, `SettingsScreen.other.test.tsx`) — this
 * codebase has repeatedly documented (Phases 1–8) that several render-heavy
 * tests sharing one file/describe block intermittently trip React Testing
 * Library's "overlapping act()" warning and lose previously-found elements;
 * splitting resolved it every prior time and does again here.
 */
describe('SettingsScreen', () => {
  beforeEach(() => {
    (navigation.navigate as jest.Mock).mockClear();
  });

  it('routes the Business section to Edit Business and the Digital Business Card', async () => {
    const view = await renderScreen();

    fireEvent.press(view.getByTestId('settings-row-business-profile'));
    expect(navigation.navigate).toHaveBeenCalledWith('EditBusiness');

    fireEvent.press(view.getByTestId('settings-row-digital-card'));
    expect(navigation.navigate).toHaveBeenCalledWith('DigitalCard');
  });
});
