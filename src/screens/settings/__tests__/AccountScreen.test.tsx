import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';

import { AccountScreen } from '../AccountScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

function renderScreen() {
  return render(<AccountScreen navigation={navigation as never} route={{} as never} />);
}

describe('AccountScreen', () => {
  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows the Account and Subscription placeholders', async () => {
    const view = await renderScreen();

    expect(view.getByText('Account')).toBeTruthy();
    expect(view.getByText('Subscription')).toBeTruthy();
    expect(view.getByText(/no cloud account/)).toBeTruthy();
  });

  it('"Log out" is a real, working button that honestly says there is nothing to log out of', async () => {
    const view = await renderScreen();

    fireEvent.press(view.getByTestId('action-logout'));

    expect(Alert.alert).toHaveBeenCalledWith(
      "You're not signed in",
      expect.stringContaining('no account to log out of'),
    );
  });
});
