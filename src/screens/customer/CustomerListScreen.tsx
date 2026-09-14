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
 * Customer" button. Also doubles as a customer **picker** when
 * `route.params.onSelectCustomer` is provided (see `navigation/types.ts`) —
 * a future invoice-creation flow (Phase 6) can reuse this screen instead of a
 * second, near-duplicate list; in that mode the screen-local bottom nav
 * (which would navigate away from the in-progress flow) is hidden.
 *
 * Balances come from `customerBalancesStore`, which reads the same
 * `CustomerActivityRepository` Customer Detail/History already use — real
 * invoice/payment-derived numbers, one lookup per visible customer, never a
 * stored or fabricated figure. The Stitch mock's per-row "Due 4d"/"Due Today"
 * day-countdown and its business-category tag ("Commercial Realty") have no
 * backing field (`CustomerBalanceSummary` has no due date; `Customer` has no
 * category) — the badge instead shows a plain "Due"/"Overdue" status, and the
 * row's second line falls back to phone/email, matching the mock's own
 * email-detail row variants. The "Active Ledger" live-status pill and the
 * mock's empty-state "Zero-State Mode" preview watermark are Stitch-only
 * decoration with no real sync/preview concept behind them, so the former is
 * marked DESIGN ONLY and the latter isn't reproduced.
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
});
