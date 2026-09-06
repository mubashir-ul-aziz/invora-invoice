import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { CustomerListRow } from '@/components/customer/CustomerListRow';
import type { Customer } from '@/domain/customer/types';
import type { RootStackParamList } from '@/navigation/types';
import { useCustomerStore } from '@/state/customerStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'CustomerList'>;

/**
 * Customer List screen. Doubles as a customer **picker** when
 * `route.params.onSelectCustomer` is provided (see `navigation/types.ts`) — a
 * future invoice-creation flow (Phase 6) can reuse this screen instead of a
 * second, near-duplicate list. Mirrors `ItemListScreen` from Phase 4.
 */
export function CustomerListScreen({ navigation, route }: Props) {
  const onSelectCustomer = route.params?.onSelectCustomer;
  const { status, customers, filter, error, load, setFilter, remove } = useCustomerStore();

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePressCustomer = (customer: Customer) => {
    if (onSelectCustomer) {
      onSelectCustomer(customer);
      navigation.goBack();
      return;
    }
    navigation.navigate('CustomerDetail', { customerId: customer.id });
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
      <View style={styles.header}>
        <TextInput
          value={filter.searchText}
          onChangeText={(text) => setFilter({ searchText: text })}
          placeholder="Search by name, phone, or email"
          placeholderTextColor={colors.placeholder}
          style={styles.search}
          testID="customer-search"
        />
        <ActionButton
          label="+ New customer"
          variant="primary"
          onPress={handleCreate}
          testID="action-create-customer"
        />
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
          <Text style={styles.emptyText}>
            {filter.searchText
              ? 'No customers match your search.'
              : "You haven't added any customers yet."}
          </Text>
        </View>
      )}

      {status === 'ready' && customers.length > 0 && (
        <FlatList
          testID="customer-list"
          data={customers}
          keyExtractor={(customer) => customer.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item: customer }) => (
            <CustomerListRow
              customer={customer}
              onPress={() => handlePressCustomer(customer)}
              onDelete={() => handleDeleteCustomer(customer)}
              testID={`customer-row-${customer.id}`}
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
