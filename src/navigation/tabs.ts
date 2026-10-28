import type { Feather } from '@expo/vector-icons';
import { CommonActions, type NavigationAction, type NavigatorScreenParams } from '@react-navigation/native';

import type { RootStackParamList } from './types';

export type MainTabKey = 'dashboard' | 'invoices' | 'customers' | 'settings';

/**
 * The bottom tab navigator's routes. Each tab hosts its own stack containing
 * every screen (see `RootNavigator`), so opening an invoice from the
 * Dashboard keeps you in the Dashboard tab, and each tab keeps its own
 * history and screen state while you're on another tab.
 */
export type MainTabParamList = {
  DashboardTab: NavigatorScreenParams<RootStackParamList> | undefined;
  InvoicesTab: NavigatorScreenParams<RootStackParamList> | undefined;
  CustomersTab: NavigatorScreenParams<RootStackParamList> | undefined;
  SettingsTab: NavigatorScreenParams<RootStackParamList> | undefined;
};

export interface MainTabSpec {
  key: MainTabKey;
  route: keyof MainTabParamList;
  /** The screen at the bottom of this tab's stack. */
  rootScreen: 'Dashboard' | 'InvoiceList' | 'CustomerList' | 'Settings';
  label: string;
  icon: keyof typeof Feather.glyphMap;
  testID: string;
}

export const MAIN_TABS: readonly MainTabSpec[] = [
  { key: 'dashboard', route: 'DashboardTab', rootScreen: 'Dashboard', label: 'Dashboard', icon: 'grid', testID: 'tab-dashboard' },
  { key: 'invoices', route: 'InvoicesTab', rootScreen: 'InvoiceList', label: 'Invoices', icon: 'file-text', testID: 'tab-invoices' },
  { key: 'customers', route: 'CustomersTab', rootScreen: 'CustomerList', label: 'Customers', icon: 'users', testID: 'tab-customers' },
  { key: 'settings', route: 'SettingsTab', rootScreen: 'Settings', label: 'Settings', icon: 'settings', testID: 'tab-settings' },
];

/**
 * Create/edit forms. Each ends in a fixed `BottomActionBar` (Save, Cancel, …)
 * in place of the tab bar.
 */
const ACTION_BAR_SCREENS = new Set<keyof RootStackParamList>([
  'CreateItem',
  'EditItem',
  'CreateCustomer',
  'EditCustomer',
  'EditBusiness',
  'EditBusinessCard',
  'InvoiceSettings',
  'CustomInvoiceType',
  'CreateInvoiceItems',
  'EditInvoiceLine',
  'InvoiceReview',
  'RecordPayment',
  'EditPayment',
]);

/**
 * Focused flows: the tab bar is hidden while one of these is on screen, so a
 * half-filled form or a purchase can't be abandoned by a stray tab tap.
 * Covers every create/edit form (they can hold unsaved changes at any time),
 * the edit-invoice redirect into that flow, and the full-screen upgrade flows.
 */
const FOCUSED_FLOW_SCREENS = new Set<keyof RootStackParamList>([
  ...ACTION_BAR_SCREENS,
  'EditInvoice',
  'Pricing',
  'UpgradeStorage',
]);

/** Whether the given focused stack route ends in a fixed `BottomActionBar`. */
export function hasBottomActionBar(route: { name: string }): boolean {
  return ACTION_BAR_SCREENS.has(route.name as keyof RootStackParamList);
}

/**
 * Whether the tab bar should be hidden for the given focused stack route.
 * The list screens double as pickers inside the invoice/payment flows
 * (`onSelectCustomer`/`onSelectInvoice`/`onSelectItem`), which are focused
 * flows too.
 */
export function isTabBarHiddenFor(route: { name: string; params?: object }): boolean {
  if (FOCUSED_FLOW_SCREENS.has(route.name as keyof RootStackParamList)) {
    return true;
  }
  const params = (route.params ?? {}) as Record<string, unknown>;
  return (
    (route.name === 'CustomerList' && !!params.onSelectCustomer) ||
    (route.name === 'InvoiceList' && !!params.onSelectInvoice) ||
    (route.name === 'ItemList' && !!params.onSelectItem)
  );
}

/**
 * Switches to a main tab and returns it to its root screen, e.g. the
 * Dashboard's "See all" invoices link. Use this instead of
 * `navigation.navigate('InvoiceList')`, which would push a second Invoices
 * list onto the current tab's stack. The root screen keeps its state
 * (filters, search, scroll); only screens pushed above it are popped.
 */
export function navigateToTab(navigation: { dispatch: (action: NavigationAction) => void }, tab: MainTabKey) {
  const spec = MAIN_TABS.find((t) => t.key === tab)!;
  navigation.dispatch(
    CommonActions.navigate({ name: spec.route, params: { screen: spec.rootScreen, pop: true } }),
  );
}
