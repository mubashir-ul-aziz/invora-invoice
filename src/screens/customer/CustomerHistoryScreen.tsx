import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { OptionPicker } from '@/components/business/OptionPicker';
import { CustomerActivityRow } from '@/components/customer/CustomerActivityRow';
import type { RootStackParamList } from '@/navigation/types';
import { useCustomerActivityStore } from '@/state/customerActivityStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'CustomerHistory'>;

const TYPE_FILTER_OPTIONS = [
  { value: 'all' as const, label: 'All' },
  { value: 'invoice' as const, label: 'Invoices' },
  { value: 'payment' as const, label: 'Payments' },
];

/**
 * Customer History: the customer's invoices and payments in one
 * chronological (newest-first) list, filterable to All / Invoices /
 * Payments. Until Phase 6/7 exist, this reads from
 * `NullCustomerActivityRepository` and is correctly always empty — see
 * `data/customerActivity/`.
 */
export function CustomerHistoryScreen({ route }: Props) {
  const { customerId } = route.params;
  const { status, history, filter, error, load, setFilter } = useCustomerActivityStore();

  useEffect(() => {
    load(customerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  return (
    <View style={styles.screen} testID="customer-history-screen">
      <View style={styles.header}>
        <OptionPicker
          label="Show"
          options={TYPE_FILTER_OPTIONS}
          value={filter.type}
          onChange={(value) => setFilter({ type: value })}
          testID="history-type-filter"
        />
      </View>

      {(status === 'loading' || status === 'idle') && (
        <View style={styles.centered} testID="customer-history-loading">
          <ActivityIndicator color={colors.primary} />
        </View>
      )}

      {status === 'error' && (
        <View style={styles.centered} testID="customer-history-error">
          <Text style={styles.errorText}>Couldn't load history.</Text>
          <Text style={styles.errorDetail}>{error}</Text>
          <ActionButton label="Try again" onPress={() => load(customerId)} />
        </View>
      )}

      {status === 'ready' && history.length === 0 && (
        <View style={styles.centered} testID="customer-history-empty">
          <Text style={styles.emptyText}>
            {filter.type === 'all'
              ? 'No invoices or payments yet.'
              : `No ${filter.type === 'invoice' ? 'invoices' : 'payments'} yet.`}
          </Text>
        </View>
      )}

      {status === 'ready' && history.length > 0 && (
        <FlatList
          testID="customer-history-list"
          data={history}
          keyExtractor={(entry) => entry.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item: entry }) => (
            <CustomerActivityRow entry={entry} testID={`history-row-${entry.id}`} />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { padding: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  errorText: { color: colors.danger, fontWeight: '600' },
  errorDetail: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  emptyText: { color: colors.textMuted, textAlign: 'center' },
  listContent: { paddingHorizontal: 16, paddingBottom: 24, gap: 10 },
});
