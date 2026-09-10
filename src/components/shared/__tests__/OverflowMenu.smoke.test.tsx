import { render, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import { OverflowMenu } from '@/components/shared/OverflowMenu';

describe('OverflowMenu', () => {
  it('reveals its items once the trigger is pressed, and invokes the pressed item', async () => {
    const onPress = jest.fn();
    const view = await render(
      <OverflowMenu testID="menu" items={[{ label: 'Delete', onPress, testID: 'del' }]} />,
    );

    expect(view.queryByTestId('del')).toBeNull();

    fireEvent.press(view.getByTestId('menu'));
    await waitFor(() => expect(view.getByTestId('del')).toBeTruthy());

    fireEvent.press(view.getByTestId('del'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
