import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { OptionPicker } from '@/components/business/OptionPicker';
import { ItemListRow } from '@/components/item/ItemListRow';
import { INVOICE_TYPE_REGISTRY } from '@/domain/invoiceType/invoiceTypeRegistry';
import type { Item } from '@/domain/item/types';
import type { RootStackParamList } from '@/navigation/types';
import { useItemStore } from '@/state/itemStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'ItemList'>;

const TYPE_FILTER_OPTIONS = [
  { value: 'all' as const, label: 'All' },
  ...INVOICE_TYPE_REGISTRY.map((def) => ({ value: def.id, label: def.label })),
];

/**
 * Items List screen. Doubles as an item **picker** when `route.params.onSelectItem`
 * is provided (see `navigation/types.ts`) — a future invoice-creation flow
 * (Phase 6) reuses this screen instead of a second, near-duplicate list.
 */
export function ItemListScreen({ navigation, route }: Props) {
  const onSelectItem = route.params?.onSelectItem;
  const { status, items, filter, error, load, setFilter, remove } = useItemStore();

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePressItem = (item: Item) => {
    if (onSelectItem) {
      onSelectItem(item);
      navigation.goBack();
      return;
    }
    navigation.navigate('EditItem', { itemId: item.id });
  };

  const handleDeleteItem = (item: Item) => {
    Alert.alert('Delete item', `Delete "${item.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await remove(item.id);
          } catch {
            Alert.alert("Couldn't delete", 'This item could not be deleted. Please try again.');
          }
        },
      },
    ]);
  };

  const handleCreate = () => {
    navigation.navigate('CreateItem', onSelectItem ? { onCreated: onSelectItem } : undefined);
  };

  return (
    <View style={styles.screen} testID="item-list-screen">
      <View style={styles.header}>
        <TextInput
          value={filter.searchText}
          onChangeText={(text) => setFilter({ searchText: text })}
          placeholder="Search by name, SKU, or description"
          placeholderTextColor={colors.placeholder}
          style={styles.search}
          testID="item-search"
        />
        <OptionPicker
          label="Invoice type"
          options={TYPE_FILTER_OPTIONS}
          value={filter.invoiceTypeId}
          onChange={(value) => setFilter({ invoiceTypeId: value })}
          testID="item-type-filter"
        />
        <ActionButton
          label="+ New item"
          variant="primary"
          onPress={handleCreate}
          testID="action-create-item"
        />
      </View>

      {(status === 'loading' || status === 'idle') && (
        <View style={styles.centered} testID="item-list-loading">
          <ActivityIndicator color={colors.primary} />
        </View>
      )}

      {status === 'error' && (
        <View style={styles.centered} testID="item-list-error">
          <Text style={styles.errorText}>Couldn't load items.</Text>
          <Text style={styles.errorDetail}>{error}</Text>
          <ActionButton label="Try again" onPress={load} />
        </View>
      )}

      {status === 'ready' && items.length === 0 && (
        <View style={styles.centered} testID="item-list-empty">
          <Text style={styles.emptyText}>
            {filter.searchText || filter.invoiceTypeId !== 'all'
              ? 'No items match your search or filter.'
              : "You haven't added any items yet."}
          </Text>
        </View>
      )}

      {status === 'ready' && items.length > 0 && (
        <FlatList
          testID="item-list"
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <ItemListRow
              item={item}
              onPress={() => handlePressItem(item)}
              onDelete={() => handleDeleteItem(item)}
              testID={`item-row-${item.id}`}
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
