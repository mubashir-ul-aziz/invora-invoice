import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { OptionPicker } from '@/components/business/OptionPicker';
import { PaymentListRow } from '@/components/payment/PaymentListRow';
import { PAYMENT_METHOD_FILTER_OPTIONS } from '@/domain/payment/types';
import type { RootStackParamList } from '@/navigation/types';
import { usePaymentStore } from '@/state/paymentStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'PaymentHistory'>;

/** Payment History: every payment recorded, across every invoice/customer, newest payment date first. */
export function PaymentHistoryScreen({ navigation }: Props) {
  const { status, entries, filter, error, load, setFilter } = usePaymentStore();

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.screen} testID="payment-history-screen">
      <View style={styles.header}>
        <TextInput
          value={filter.searchText}
          onChangeText={(text) => setFilter({ searchText: text })}
          placeholder="Search by invoice number, customer, or reference"
          placeholderTextColor={colors.placeholder}
          style={styles.search}
          testID="payment-search"
        />
        <OptionPicker
          label="Method"
          options={PAYMENT_METHOD_FILTER_OPTIONS}
          value={filter.method}
          onChange={(value) => setFilter({ method: value })}
          testID="payment-method-filter"
        />
      </View>

      {(status === 'loading' || status === 'idle') && (
        <View style={styles.centered} testID="payment-history-loading">
          <ActivityIndicator color={colors.primary} />
        </View>
      )}

      {status === 'error' && (
        <View style={styles.centered} testID="payment-history-error">
          <Text style={styles.errorText}>Couldn't load payments.</Text>
          <Text style={styles.errorDetail}>{error}</Text>
          <ActionButton label="Try again" onPress={load} />
        </View>
      )}

      {status === 'ready' && entries.length === 0 && (
        <View style={styles.centered} testID="payment-history-empty">
          <Text style={styles.emptyText}>
            {filter.searchText || filter.method !== 'all'
              ? 'No payments match your search or filter.'
              : 'No payments have been recorded yet.'}
          </Text>
        </View>
      )}

      {status === 'ready' && entries.length > 0 && (
        <FlatList
          testID="payment-history-list"
          data={entries}
          keyExtractor={(entry) => entry.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item: entry }) => (
            <PaymentListRow
              payment={entry}
              onPress={() => navigation.navigate('EditPayment', { paymentId: entry.id })}
              testID={`payment-row-${entry.id}`}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { padding: 16, gap: 12 },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  errorText: { color: colors.danger, fontWeight: '600' },
  errorDetail: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  emptyText: { color: colors.textMuted, textAlign: 'center' },
  listContent: { paddingHorizontal: 16, paddingBottom: 24, gap: 10 },
});
