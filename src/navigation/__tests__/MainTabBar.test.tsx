import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { MainTabBar } from '../MainTabBar';
import { isTabBarHiddenFor, MAIN_TABS, navigateToTab, type MainTabParamList } from '../tabs';
import type { RootStackParamList } from '../types';

/* eslint-disable @typescript-eslint/no-explicit-any */

// The real app shell (`RootNavigator`) wired to stub screens, so the tab bar,
// per-tab stacks and hide rules run against real React Navigation.
const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function StubScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList>) {
  const [count, setCount] = useState(0);
  const go = (name: string, params?: object) => (navigation.navigate as any)(name, params);
  const button = (label: string, onPress: () => void) => (
    <Pressable key={label} onPress={onPress} testID={label}>
      <Text>{label}</Text>
    </Pressable>
  );
  return (
    <View>
      <Text testID="screen-name">{route.name}</Text>
      <Text>{`${route.name} count ${count}`}</Text>
      {button('increment', () => setCount((c) => c + 1))}
      {button('open-invoice', () => go('InvoiceDetail', { invoiceId: 'inv-1' }))}
      {button('open-create-customer', () => go('CreateCustomer'))}
      {button('open-customer-picker', () => go('CustomerList', { onSelectCustomer: () => {} }))}
      {button('see-all-invoices', () => navigateToTab(navigation, 'invoices'))}
    </View>
  );
}

const SCREENS: (keyof RootStackParamList)[] = ['Dashboard', 'InvoiceList', 'CustomerList', 'Settings', 'InvoiceDetail', 'CreateCustomer'];

async function renderShell() {
  await render(
    <SafeAreaProvider
      initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 34 } }}
    >
      <NavigationContainer>
        <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <MainTabBar {...props} />}>
          {MAIN_TABS.map((tab) => (
            <Tab.Screen key={tab.key} name={tab.route}>
              {() => (
                <Stack.Navigator initialRouteName={tab.rootScreen} screenOptions={{ headerShown: false }}>
                  {SCREENS.map((name) => (
                    <Stack.Screen key={name} name={name} component={StubScreen as any} />
                  ))}
                </Stack.Navigator>
              )}
            </Tab.Screen>
          ))}
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>,
  );
}

const isSelected = (testID: string) => screen.getByTestId(testID).props.accessibilityState?.selected === true;
const focusedScreen = () => screen.getAllByTestId('screen-name').map((n) => n.props.children);

describe('MainTabBar', () => {
  it('shows all four tabs and highlights the active one', async () => {
    await renderShell();

    expect(screen.getByTestId('main-tab-bar')).toBeTruthy();
    expect(isSelected('tab-dashboard')).toBe(true);

    fireEvent.press(screen.getByTestId('tab-customers'));
    await waitFor(() => expect(isSelected('tab-customers')).toBe(true));
    expect(isSelected('tab-dashboard')).toBe(false);
  });

  it('stays visible on detail pages and keeps the current tab highlighted', async () => {
    await renderShell();

    fireEvent.press(screen.getByText('open-invoice'));

    await waitFor(() => expect(screen.getByText('InvoiceDetail count 0')).toBeTruthy());
    expect(screen.getByTestId('main-tab-bar')).toBeTruthy();
    expect(isSelected('tab-dashboard')).toBe(true);
  });

  it('keeps each tab’s screen state when switching away and back', async () => {
    await renderShell();

    fireEvent.press(screen.getByTestId('tab-invoices'));
    await waitFor(() => expect(screen.getByText('InvoiceList count 0')).toBeTruthy());
    fireEvent.press(screen.getAllByTestId('increment').at(-1)!);
    await waitFor(() => expect(screen.getByText('InvoiceList count 1')).toBeTruthy());

    fireEvent.press(screen.getByTestId('tab-settings'));
    await waitFor(() => expect(isSelected('tab-settings')).toBe(true));
    fireEvent.press(screen.getByTestId('tab-invoices'));

    await waitFor(() => expect(isSelected('tab-invoices')).toBe(true));
    expect(screen.getByText('InvoiceList count 1')).toBeTruthy();
  });

  it('hides during create/edit forms and leaves a safe-area spacer', async () => {
    await renderShell();

    fireEvent.press(screen.getByText('open-create-customer'));

    await waitFor(() => expect(screen.getByTestId('main-tab-bar-hidden')).toBeTruthy());
    expect(screen.queryByTestId('main-tab-bar')).toBeNull();
    expect(screen.getByTestId('main-tab-bar-hidden')).toHaveStyle({ height: 34 });
  });

  it('hides while a list screen is used as a picker', async () => {
    await renderShell();

    fireEvent.press(screen.getByText('open-customer-picker'));

    await waitFor(() => expect(screen.queryByTestId('main-tab-bar')).toBeNull());
  });

  it('navigateToTab switches tabs without pushing a duplicate list', async () => {
    await renderShell();

    fireEvent.press(screen.getByText('see-all-invoices'));

    await waitFor(() => expect(isSelected('tab-invoices')).toBe(true));
    // Pushing `InvoiceList` onto the Dashboard tab's stack would mount a second one.
    expect(focusedScreen().filter((name) => name === 'InvoiceList')).toHaveLength(1);
  });
});

describe('isTabBarHiddenFor', () => {
  it('shows the bar on main and detail screens', () => {
    for (const name of ['Dashboard', 'InvoiceList', 'CustomerList', 'Settings', 'InvoiceDetail', 'CustomerDetail', 'Business', 'Backup', 'InvoicePdfPreview']) {
      expect(isTabBarHiddenFor({ name })).toBe(false);
    }
  });

  it('hides the bar in forms, upgrade flows and pickers', () => {
    for (const name of ['CreateInvoiceItems', 'InvoiceReview', 'EditCustomer', 'CreateItem', 'RecordPayment', 'EditBusiness', 'Pricing']) {
      expect(isTabBarHiddenFor({ name })).toBe(true);
    }
    expect(isTabBarHiddenFor({ name: 'InvoiceList', params: { onSelectInvoice: () => {} } })).toBe(true);
    expect(isTabBarHiddenFor({ name: 'ItemList', params: { onSelectItem: () => {} } })).toBe(true);
    expect(isTabBarHiddenFor({ name: 'ItemList' })).toBe(false);
  });
});
