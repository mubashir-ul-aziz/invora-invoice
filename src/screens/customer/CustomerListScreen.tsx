import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { DashboardBottomNav } from '@/components/dashboard/DashboardBottomNav';
import { CustomerListRow } from '@/components/customer/CustomerListRow';
import { classifyBalanceStatus } from '@/domain/customer/activity';
import type { Customer, CustomerBalanceSummary } from '@/domain/customer/types';
import type { RootStackParamList } from '@/navigation/types';
import { useCustomerBalancesStore } from '@/state/customerBalancesStore';
import { useCustomerStore } from '@/state/customerStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'CustomerList'>;

type StatusFilter = 'all' | 'due' | 'settled';
type SortMode = 'name' | 'balance';

/**
 * Customer List screen, restyled to match the Stitch "Customer List" design:
 * a pill search bar with an A-Z/Balance sort toggle, All/Due/Settled filter
 * pills, avatar rows with a real per-customer outstanding balance and
 * status badge, an outstanding/settled summary strip, and a floating "Add
 * Customer" button.
 *
 * Also doubles as the Stitch "Select Customer" screen — Step 1 of 3 of the
 * invoice-creation flow — when `route.params.onSelectCustomer` is provided
 * (see `navigation/types.ts`; wired from `DashboardScreen.handleCreateInvoice`
 * and `MVP_BUILD_PLAN.md`'s "Create Invoice – Customer is `CustomerList` in
 * picker mode" note). That mode renders a dedicated branch near the top of
 * this component matching the Stitch mock (step tracker, pinned "+ New
 * Customer" quick-add, count/sort caption, "Smart Pre-filling" hint) instead
 * of reusing the plain-mode layout below, since the two designs diverge too
 * much to share JSX cleanly. Tapping a row calls `onSelectCustomer` and pops
 * back to the caller instead of opening Customer Detail; the screen-local
 * bottom nav (which would navigate away from the in-progress flow) is never
 * shown in this mode.
 *
 * Balances come from `customerBalancesStore`, which reads the same
 * `CustomerActivityRepository` Customer Detail/History already use — real
 * invoice/payment-derived numbers, one lookup per visible customer, never a
 * stored or fabricated figure. The Stitch mock's per-row "Due 4d"/"Due Today"
 * day-countdown, its business-category tag ("Commercial Realty"), and the
 * Select Customer mock's per-row "Net 14"/"Net 30" payment-terms tag have no
 * backing field (`CustomerBalanceSummary` has no due date; `Customer` has no
 * category or default-terms field) — the badge instead shows a plain
 * "Due"/"Overdue"/"Settled" status, and the row's second line falls back to
 * phone/email, matching the mock's own email-detail row variants. The plain
 * mode's "Active Ledger" live-status pill and the mock's empty-state
 * "Zero-State Mode" preview watermark are Stitch-only decoration with no real
 * sync/preview concept behind them, so the former is marked DESIGN ONLY and
 * the latter isn't reproduced. The Select Customer mode's "Smart Pre-filling"
 * banner is marked DESIGN ONLY for the same reason (see the banner's own
 * comment below).
 */
export function CustomerListScreen({ navigation, route }: Props) {
  const onSelectCustomer = route.params?.onSelectCustomer;
  const { status, customers, filter, error, load, setFilter, remove } = useCustomerStore();
  const { balances, loadMany: loadBalances } = useCustomerBalancesStore();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('name');

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const customerIdsKey = useMemo(() => customers.map((c) => c.id).join(','), [customers]);
  useEffect(() => {
    if (customers.length > 0) {
      loadBalances(customers.map((c) => c.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerIdsKey]);

  const loadedBalances = useMemo(
    () => customers.map((c) => balances[c.id]).filter((b): b is CustomerBalanceSummary => !!b),
    [customers, balances],
  );
  const dueCount = loadedBalances.filter((b) => classifyBalanceStatus(b) !== 'settled').length;
  const settledCount = loadedBalances.filter((b) => classifyBalanceStatus(b) === 'settled').length;
  const totalOutstanding = loadedBalances.reduce((sum, b) => sum + b.outstanding, 0);
  const settledRatio = loadedBalances.length > 0 ? (settledCount / loadedBalances.length) * 100 : 0;

  const visibleCustomers = useMemo(() => {
    let list = customers;
    if (statusFilter !== 'all') {
      list = list.filter((c) => {
        const balance = balances[c.id];
        if (!balance) return false;
        const isSettled = classifyBalanceStatus(balance) === 'settled';
        return statusFilter === 'settled' ? isSettled : !isSettled;
      });
    }
    const sorted = [...list];
    if (sortMode === 'name') {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      sorted.sort((a, b) => (balances[b.id]?.outstanding ?? 0) - (balances[a.id]?.outstanding ?? 0));
    }
    return sorted;
  }, [customers, balances, statusFilter, sortMode]);

  const handlePressCustomer = (customer: Customer) => {
    if (onSelectCustomer) {
      // Pop this picker off the stack *before* invoking the callback: the
      // callback (e.g. Dashboard's "Create invoice" flow) typically pushes
      // the next screen itself, and calling goBack() after that would pop
      // that freshly-pushed screen right back off instead of this one.
      navigation.goBack();
      onSelectCustomer(customer);
      return;
    }
    navigation.navigate('CustomerDetail', { customerId: customer.id });
  };

  const handleEditCustomer = (customer: Customer) => {
    navigation.navigate('EditCustomer', { customerId: customer.id });
  };

  const handleDeleteCustomer = (customer: Customer) => {
    Alert.alert('Delete customer', `Delete "${customer.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await remove(customer.id);
          } catch {
            Alert.alert("Couldn't delete", 'This customer could not be deleted. Please try again.');
          }
        },
      },
    ]);
  };

  const handleCreate = () => {
    navigation.navigate('CreateCustomer', onSelectCustomer ? { onCreated: onSelectCustomer } : undefined);
  };

  // Picker mode (`onSelectCustomer`) is Step 1 of the invoice-creation flow —
  // the Stitch "Select Customer" design — which looks and behaves
  // differently enough from the plain Customers tab (below) that it gets its
  // own render branch rather than sprinkling `onSelectCustomer` checks
  // through one shared layout.
  if (onSelectCustomer) {
    const hintBanner = (
      <View style={styles.hintBanner}>
        <View style={styles.hintIconWrap}>
          <Feather name="zap" size={16} color={colors.primary} />
        </View>
        <View style={styles.hintTextCol}>
          <View style={styles.hintTitleRow}>
            <Text style={styles.hintTitle}>Smart Pre-filling</Text>
            <Text style={styles.designOnlyTag}>DESIGN ONLY</Text>
          </View>
          {/*
            DESIGN ONLY: `Customer` (domain/customer/types.ts) has no
            default-payment-terms field, and `invoiceDraftStore.setCustomer`
            only stores the chosen customer — it doesn't copy their address
            onto the invoice. Stitch's copy describes this auto-fill as if it
            already happens; it doesn't, so the badge above flags it.
          */}
          <Text style={styles.hintCaption}>
            Invoices could inherit a customer&apos;s default payment terms and registered billing address
            automatically.
          </Text>
        </View>
      </View>
    );

    return (
      <View style={styles.screen} testID="customer-list-screen">
        <View style={styles.stepTrackerWrap}>
          <View style={styles.stepTrackerRow}>
            <Text style={styles.stepTrackerStep}>Step 1 of 3</Text>
            <Text style={styles.stepTrackerLabel}>Invoice Recipient</Text>
          </View>
          <View style={styles.stepTrackerBarBg}>
            <View style={styles.stepTrackerBarFill} />
          </View>
        </View>

        <View style={styles.pickerSearchRow}>
          <View style={styles.searchPill}>
            <Feather name="search" size={18} color={colors.textMuted} />
            <TextInput
              value={filter.searchText}
              onChangeText={(text) => setFilter({ searchText: text })}
              placeholder="Search customers by name, company, email..."
              placeholderTextColor={colors.placeholder}
              style={styles.searchInput}
              testID="customer-search"
            />
            {!!filter.searchText && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                testID="customer-search-clear"
                hitSlop={8}
                onPress={() => setFilter({ searchText: '' })}
              >
                <Feather name="x-circle" size={16} color={colors.textMuted} />
              </Pressable>
            )}
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New customer"
          testID="action-create-customer"
          onPress={handleCreate}
          style={({ pressed }) => [styles.newCustomerCard, pressed && styles.pressedCard]}
        >
          <View style={styles.newCustomerLeft}>
            <View style={styles.newCustomerIcon}>
              <Feather name="user-plus" size={20} color={colors.primary} />
            </View>
            <View style={styles.newCustomerTextCol}>
              <View style={styles.newCustomerTitleRow}>
                <Text style={styles.newCustomerTitle}>+ New Customer</Text>
                <View style={styles.quickAddPill}>
                  <Text style={styles.quickAddPillText}>Quick Add</Text>
                </View>
              </View>
              <Text style={styles.newCustomerSubtitle} numberOfLines={1}>
                Add and configure a new customer profile
              </Text>
            </View>
          </View>
          <Feather name="chevron-right" size={18} color={colors.primary} />
        </Pressable>

        <View style={styles.directoryHeaderRow}>
          <View style={styles.directoryHeaderLeft}>
            <Text style={styles.directoryLabel}>Customers</Text>
            <View style={styles.directoryCountBadge}>
              <Text style={styles.directoryCountText}>
                {customers.length} {customers.length === 1 ? 'found' : 'available'}
              </Text>
            </View>
          </View>
          {/*
            Stitch's caption reads "Sorted by recent activity", but this app
            has no per-customer last-invoice/payment date to sort by (see
            domain/customer/activity.ts) — inventing that signal would violate
            DESIGN.md's "never fake a backend feature" rule. The list below
            uses the repository's real default order instead (most recently
            *added* customer first — SqliteCustomerRepository.list's
            `orderBy(desc(createdAt))`), and this caption is worded to match
            that real behavior.
          */}
          <Text style={styles.directoryCaption}>Sorted by recently added</Text>
        </View>

        <View style={styles.pickerBody}>
          {(status === 'loading' || status === 'idle') && (
            <View style={styles.centered} testID="customer-list-loading">
              <ActivityIndicator color={colors.primary} />
            </View>
          )}

          {status === 'error' && (
            <View style={styles.centered} testID="customer-list-error">
              <Text style={styles.errorText}>Couldn&apos;t load customers.</Text>
              <Text style={styles.errorDetail}>{error}</Text>
              <ActionButton label="Try again" onPress={load} />
            </View>
          )}

          {/*
            The store's `customers` is already the *search-filtered* result
            (see `customerStore.setFilter` → `repository.list(filter)`), so
            there's no separate "unfiltered total" to compare against here —
            an empty result while a search is active means "no matches",
            while an empty result with no search text means "no customers
            exist yet".
          */}
          {status === 'ready' && customers.length === 0 && !filter.searchText && (
            <View style={styles.centered} testID="customer-list-empty">
              <Text style={styles.emptyText}>No customers yet — add your first one above.</Text>
            </View>
          )}

          {status === 'ready' && customers.length === 0 && !!filter.searchText && (
            <View style={styles.noMatches} testID="customer-list-no-filter-matches">
              <View style={styles.noMatchesIconWrap}>
                <Feather name="search" size={26} color={colors.textMuted} />
              </View>
              <Text style={styles.noMatchesTitle}>No matching customers</Text>
              <Text style={styles.noMatchesSubtitle}>
                Double check your search or create a new profile instantly.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Create this customer"
                testID="customer-search-empty-create"
                onPress={handleCreate}
                style={({ pressed }) => [styles.noMatchesButton, pressed && styles.pressedCard]}
              >
                <Text style={styles.noMatchesButtonText}>Create This Customer</Text>
              </Pressable>
            </View>
          )}

          {status === 'ready' && customers.length > 0 && (
            <FlatList
              testID="customer-list"
              data={customers}
              keyExtractor={(customer) => customer.id}
              contentContainerStyle={styles.listContent}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              renderItem={({ item: customer }) => (
                <CustomerListRow
                  customer={customer}
                  balance={balances[customer.id]}
                  balanceStatus={balances[customer.id] ? classifyBalanceStatus(balances[customer.id]) : undefined}
                  onPress={() => handlePressCustomer(customer)}
                  testID={`customer-row-${customer.id}`}
                />
              )}
            />
          )}
        </View>

        {status === 'ready' && hintBanner}
      </View>
    );
  }

  return (
    <View style={styles.screen} testID="customer-list-screen">
      <View style={styles.controlBar}>
        <View style={styles.searchRow}>
          <View style={styles.searchPill}>
            <Feather name="search" size={18} color={colors.textMuted} />
            <TextInput
              value={filter.searchText}
              onChangeText={(text) => setFilter({ searchText: text })}
              placeholder="Search by name, email or phone..."
              placeholderTextColor={colors.placeholder}
              style={styles.searchInput}
              testID="customer-search"
            />
            {!!filter.searchText && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                testID="customer-search-clear"
                hitSlop={8}
                onPress={() => setFilter({ searchText: '' })}
              >
                <Feather name="x-circle" size={16} color={colors.textMuted} />
              </Pressable>
            )}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Toggle sort order"
            testID="customer-sort-toggle"
            onPress={() => setSortMode((m) => (m === 'name' ? 'balance' : 'name'))}
            style={styles.sortButton}
          >
            <Feather name="repeat" size={16} color={colors.primary} />
            <Text style={styles.sortButtonText}>{sortMode === 'name' ? 'A-Z' : 'Balance'}</Text>
          </Pressable>
        </View>

        <View style={styles.filterRow}>
          <View style={styles.pillsRow}>
            <FilterPill
              label="All"
              count={customers.length}
              active={statusFilter === 'all'}
              onPress={() => setStatusFilter('all')}
              testID="customer-filter-all"
            />
            <FilterPill
              label="Due"
              count={dueCount}
              active={statusFilter === 'due'}
              onPress={() => setStatusFilter('due')}
              testID="customer-filter-due"
              danger
            />
            <FilterPill
              label="Settled"
              count={settledCount}
              active={statusFilter === 'settled'}
              onPress={() => setStatusFilter('settled')}
              testID="customer-filter-settled"
            />
          </View>
          {/* DESIGN ONLY: the Stitch mock's "Active Ledger" pill implies a live sync status; there is no such concept in this app's backend. */}
          <View style={styles.ledgerStatus}>
            <View style={styles.ledgerDot} />
            <Text style={styles.ledgerText}>DESIGN ONLY</Text>
          </View>
        </View>
      </View>

      {(status === 'loading' || status === 'idle') && (
        <View style={styles.centered} testID="customer-list-loading">
          <ActivityIndicator color={colors.primary} />
        </View>
      )}

      {status === 'error' && (
        <View style={styles.centered} testID="customer-list-error">
          <Text style={styles.errorText}>Couldn't load customers.</Text>
          <Text style={styles.errorDetail}>{error}</Text>
          <ActionButton label="Try again" onPress={load} />
        </View>
      )}

      {status === 'ready' && customers.length === 0 && (
        <View style={styles.centered} testID="customer-list-empty">
          {filter.searchText ? (
            <Text style={styles.emptyText}>No customers match your search.</Text>
          ) : (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconCircle}>
                <Feather name="user-plus" size={26} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>No customers yet?</Text>
              <Text style={styles.emptySubtitle}>
                Add your first customer to track billings, send invoices, and log incoming payments with one tap.
              </Text>
              <ActionButton
                label="Add First Customer"
                icon="user-plus"
                onPress={handleCreate}
                testID="customer-empty-add"
              />
            </View>
          )}
        </View>
      )}

      {status === 'ready' && customers.length > 0 && visibleCustomers.length === 0 && (
        <View style={styles.centered} testID="customer-list-no-filter-matches">
          <Text style={styles.emptyText}>No customers match this filter.</Text>
        </View>
      )}

      {status === 'ready' && visibleCustomers.length > 0 && (
        <FlatList
          testID="customer-list"
          data={visibleCustomers}
          keyExtractor={(customer) => customer.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item: customer }) => (
            <CustomerListRow
              customer={customer}
              balance={balances[customer.id]}
              balanceStatus={balances[customer.id] ? classifyBalanceStatus(balances[customer.id]) : undefined}
              onPress={() => handlePressCustomer(customer)}
              onEdit={() => handleEditCustomer(customer)}
              onDelete={() => handleDeleteCustomer(customer)}
              testID={`customer-row-${customer.id}`}
            />
          )}
          ListFooterComponent={
            loadedBalances.length > 0 ? (
              <View style={styles.summaryBar} testID="customer-summary-bar">
                <View style={styles.summaryColumn}>
                  <Text style={styles.summaryLabel}>Total Outstanding</Text>
                  <Text style={styles.summaryValueDanger}>{totalOutstanding.toFixed(2)}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={[styles.summaryColumn, styles.summaryColumnEnd]}>
                  <Text style={styles.summaryLabel}>Settled Ratio</Text>
                  <View style={styles.summaryRatioRow}>
                    <Feather name="trending-up" size={14} color="#006243" />
                    <Text style={styles.summaryValue}>{settledRatio.toFixed(1)}%</Text>
                  </View>
                </View>
              </View>
            ) : null
          }
        />
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add new customer"
        testID="action-create-customer"
        onPress={handleCreate}
        style={({ pressed }) => [
          styles.fab,
          onSelectCustomer && styles.fabNoNav,
          pressed && styles.fabPressed,
        ]}
      >
        <Feather name="user-plus" size={18} color={colors.primaryText} />
        <Text style={styles.fabText}>Add Customer</Text>
      </Pressable>

      {!onSelectCustomer && (
        <DashboardBottomNav
          activeTab="customers"
          onDashboard={() => navigation.navigate('Dashboard')}
          onInvoices={() => navigation.navigate('InvoiceList')}
          onBusiness={() => navigation.navigate('Business')}
          onSettings={() => navigation.navigate('Settings')}
        />
      )}
    </View>
  );
}

function FilterPill({
  label,
  count,
  active,
  danger,
  onPress,
  testID,
}: {
  label: string;
  count: number;
  active: boolean;
  danger?: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Filter: ${label}`}
      testID={testID}
      onPress={onPress}
      style={[styles.pill, active && styles.pillActive]}
    >
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
      <View
        style={[
          styles.pillCount,
          active ? styles.pillCountActive : danger ? styles.pillCountDanger : styles.pillCountDefault,
        ]}
      >
        <Text
          style={[
            styles.pillCountText,
            active ? styles.pillCountTextActive : danger ? styles.pillCountTextDanger : styles.pillCountTextDefault,
          ]}
        >
          {count}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  controlBar: { padding: 16, paddingBottom: 8, gap: 10, backgroundColor: colors.background },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 14,
    height: 44,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, padding: 0 },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  sortButtonText: { fontSize: 12, fontWeight: '700', color: colors.text },
  filterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  pillsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  pillActive: { backgroundColor: colors.primary },
  pillText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  pillTextActive: { color: colors.primaryText },
  pillCount: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 999 },
  pillCountDefault: { backgroundColor: colors.background },
  pillCountDanger: { backgroundColor: '#FBE4E2' },
  pillCountActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  pillCountText: { fontSize: 10, fontWeight: '700' },
  pillCountTextDefault: { color: colors.textMuted },
  pillCountTextDanger: { color: colors.danger },
  pillCountTextActive: { color: colors.primaryText },
  ledgerStatus: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 0 },
  ledgerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  ledgerText: { fontSize: 9, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.3 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  errorText: { color: colors.danger, fontWeight: '600' },
  errorDetail: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  emptyText: { color: colors.textMuted, textAlign: 'center' },
  emptyCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  emptySubtitle: { fontSize: 13, color: colors.textMuted, textAlign: 'center', maxWidth: 270, marginBottom: 8 },
  listContent: { paddingHorizontal: 16, paddingBottom: 96 },
  separator: { height: 8 },
  summaryBar: {
    marginTop: 8,
    padding: 14,
    backgroundColor: colors.surface,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryColumn: { gap: 2 },
  summaryColumnEnd: { alignItems: 'flex-end' },
  summaryDivider: { width: 1, height: 28, backgroundColor: colors.border },
  summaryLabel: { fontSize: 10, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 },
  summaryValue: { fontSize: 16, fontWeight: '700', color: colors.text },
  summaryValueDanger: { fontSize: 16, fontWeight: '700', color: colors.danger },
  summaryRatioRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 84,
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  fabNoNav: { bottom: 24 },
  fabPressed: { opacity: 0.85 },
  fabText: { color: colors.primaryText, fontWeight: '700', fontSize: 14 },

  // --- Select Customer (picker mode / invoice-creation Step 1) ---
  pressedCard: { opacity: 0.85 },
  stepTrackerWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 6 },
  stepTrackerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepTrackerStep: { fontSize: 13, fontWeight: '700', color: colors.primary },
  stepTrackerLabel: { fontSize: 12, color: colors.textMuted },
  stepTrackerBarBg: { width: '100%', height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  stepTrackerBarFill: { width: '33%', height: '100%', borderRadius: 3, backgroundColor: colors.primary },
  pickerSearchRow: { paddingHorizontal: 16, paddingVertical: 8 },
  newCustomerCard: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  newCustomerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  newCustomerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newCustomerTextCol: { flex: 1, minWidth: 0, gap: 2 },
  newCustomerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  newCustomerTitle: { fontSize: 15, fontWeight: '700', color: colors.primary },
  quickAddPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: colors.background },
  quickAddPillText: { fontSize: 9, fontWeight: '700', color: colors.textMuted },
  newCustomerSubtitle: { fontSize: 12, color: colors.textMuted },
  directoryHeaderRow: {
    paddingHorizontal: 16,
    paddingBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  directoryHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  directoryLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  directoryCountBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: colors.surface },
  directoryCountText: { fontSize: 10, fontWeight: '700', color: colors.textMuted },
  directoryCaption: { fontSize: 11, color: colors.placeholder },
  pickerBody: { flex: 1 },
  noMatches: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 24 },
  noMatchesIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  noMatchesTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  noMatchesSubtitle: { fontSize: 13, color: colors.textMuted, textAlign: 'center', maxWidth: 260, marginBottom: 8 },
  noMatchesButton: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 12, backgroundColor: colors.primary },
  noMatchesButtonText: { color: colors.primaryText, fontWeight: '700', fontSize: 13 },
  hintBanner: {
    margin: 16,
    marginTop: 8,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    gap: 10,
  },
  hintIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  hintTextCol: { flex: 1, minWidth: 0, gap: 2 },
  hintTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hintTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  designOnlyTag: { fontSize: 9, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.3 },
  hintCaption: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
});
