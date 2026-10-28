import { act, render } from '@testing-library/react-native';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { toast, useToastStore } from '@/state/toastStore';
import { colors } from '@/theme/colors';

import { TOAST_SLIDE_MS, TOAST_VISIBLE_MS, ToastHost } from '../ToastHost';

const TOP_INSET = 47;

function renderHost() {
  return render(
    <SafeAreaProvider
      initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: TOP_INSET, left: 0, right: 0, bottom: 34 } }}
    >
      <ToastHost />
    </SafeAreaProvider>,
  );
}

type View = Awaited<ReturnType<typeof renderHost>>;

function translateY(view: View, testID: string): number {
  const transform = StyleSheet.flatten(view.getByTestId(testID).props.style).transform as { translateY: number }[];
  return transform[0].translateY;
}

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

describe('ToastHost', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Jest mocks the native animation driver (its animations finish instantly), so run the JS driver to observe real timing.
    jest.replaceProperty(Platform, 'OS', 'web');
    useToastStore.setState({ current: null });
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('renders nothing when there is no toast', async () => {
    const view = await renderHost();
    expect(view.queryByTestId('toast-container')).toBeNull();
  });

  it('shows a success toast below the top safe area, with no backdrop and without blocking touches', async () => {
    const view = await renderHost();

    await act(async () => toast.success('Invoice INV-1 created'));

    expect(view.getByTestId('toast-success')).toBeTruthy();
    expect(view.getByTestId('toast-message').props.children).toBe('Invoice INV-1 created');
    expect(StyleSheet.flatten(view.getByTestId('toast-message').props.style).color).toBe(colors.text);
    const container = view.getByTestId('toast-container');
    expect(container.props.pointerEvents).toBe('none');
    expect(StyleSheet.flatten(container.props.style).paddingTop).toBeGreaterThanOrEqual(TOP_INSET);
    expect(StyleSheet.flatten(container.props.style).backgroundColor).toBeUndefined();
  });

  it('renders failures in red', async () => {
    const view = await renderHost();

    await act(async () => toast.error({ title: "Couldn't save", message: 'Please try again.' }));

    expect(view.getByTestId('toast-error')).toBeTruthy();
    expect(StyleSheet.flatten(view.getByTestId('toast-title').props.style).color).toBe(colors.danger);
    expect(StyleSheet.flatten(view.getByTestId('toast-message').props.style).color).toBe(colors.danger);
  });

  it('slides down over 0.4s, stays 3s, slides back up over 0.4s, then clears itself', async () => {
    const view = await renderHost();

    await act(async () => toast.success('Customer changes saved'));
    const hidden = translateY(view, 'toast-success');
    expect(hidden).toBeLessThan(-TOP_INSET);

    await advance(TOAST_SLIDE_MS / 2);
    // Ease-in-out is symmetric: halfway through in time is halfway in distance.
    expect(translateY(view, 'toast-success')).toBeCloseTo(hidden / 2, 0);

    await advance(TOAST_SLIDE_MS / 2);
    expect(translateY(view, 'toast-success')).toBe(0);

    await advance(TOAST_VISIBLE_MS - 100);
    expect(translateY(view, 'toast-success')).toBe(0);

    await advance(100 + TOAST_SLIDE_MS / 2);
    expect(translateY(view, 'toast-success')).toBeCloseTo(hidden / 2, 0);

    await advance(TOAST_SLIDE_MS / 2 + 50);
    expect(useToastStore.getState().current).toBeNull();
    expect(view.queryByTestId('toast-container')).toBeNull();
  });

  it('ignores a duplicate while showing, so its timer is not extended', async () => {
    const view = await renderHost();

    await act(async () => toast.success('Payment deleted'));
    await advance(2000);
    await act(async () => toast.success('Payment deleted'));
    await advance(TOAST_SLIDE_MS + TOAST_VISIBLE_MS + TOAST_SLIDE_MS - 2000 + 50);

    expect(view.queryByTestId('toast-container')).toBeNull();
  });

  it('restarts the 3s hold when a different toast replaces the current one', async () => {
    const view = await renderHost();

    await act(async () => toast.success('Line item added'));
    await advance(TOAST_SLIDE_MS + 2000);
    await act(async () => toast.error('Line item could not be added'));
    await advance(TOAST_VISIBLE_MS - 100);

    expect(view.getByTestId('toast-message').props.children).toBe('Line item could not be added');
    expect(translateY(view, 'toast-error')).toBe(0);

    await advance(100 + TOAST_SLIDE_MS + 50);
    expect(view.queryByTestId('toast-container')).toBeNull();
  });
});
