import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { ItemListRow } from '@/components/item/ItemListRow';
import {
  getInvoiceTypeDefinition,
  INVOICE_TYPE_REGISTRY,
} from '@/domain/invoiceType/invoiceTypeRegistry';
import type { InvoiceTypeId } from '@/domain/invoiceType/invoiceTypeRegistry';
import type { Item } from '@/domain/item/types';
import type { RootStackParamList } from '@/navigation/types';
import { useItemStore } from '@/state/itemStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'ItemList'>;

type CategoryFilter = InvoiceTypeId | 'all';
type SortMode = 'name' | 'price';

/**
 * Items List screen, restyled to match the Stitch "Item List" ("Items
 * Catalog") design: a pill search bar with a live item count, an A-Z/Price
 * sort toggle, horizontally-scrollable Pricing-Method filter chips (each
 * with a real count), Stitch-style item cards, and a floating "Add Item"
 * button.
 *
 * The chips use this app's real categorization axis — Pricing Method
 * (`domain/invoiceType/invoiceTypeRegistry.ts`) — in place of the Stitch
 * mock's invented "Materials/Services/Hardware" categories, since `Item` has
 * no such category field; only methods actually present in the catalog get
 * a chip, each labelled with its real item count.
 *
 * Also doubles as an item **picker** when `route.params.onSelectItem` is
 * provided — the Create Invoice Items screen reuses this screen instead of a
 * second, near-duplicate list. When picking *for an invoice*
 * (`requiredPricingMethodId` set), §15 of the brief applies: the list is
 * locked to that Pricing Method (no chips to fight with) and tapping an
 * incompatible item — which shouldn't be visible anyway, but could exist
 * from before this filter existed, or from a bulk import — is refused with a
 * clear explanation instead of silently adding a mismatched line.
 */
export function ItemListScreen({ navigation, route }: Props) {
  const onSelectItem = route.params?.onSelectItem;
  const requiredPricingMethodId = route.params?.requiredPricingMethodId;
  const { status, items, filter, error, load, setFilter, remove } = useItemStore();

  // Pricing-Method filtering happens client-side (below) in plain mode, so
  // every category's count can be shown side-by-side; the store's own
  // `invoiceTypeId` filter is reserved for the picker's hard lock.
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('name');

  // `requiredPricingMethodId`, when set, scopes the list's Pricing Method
  // filter for as long as this screen instance is mounted — applied on
  // mount and cleared again on unmount, so it never leaks into the global
  // filter the plain "Items" tab shares (same pattern as `InvoiceListScreen`'s
  // `customerId` scoping).
  useEffect(() => {
    if (requiredPricingMethodId) {
      setFilter({ invoiceTypeId: requiredPricingMethodId });
    } else {
      load();
    }
    return () => {
      if (requiredPricingMethodId) {
        setFilter({ invoiceTypeId: 'all' });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requiredPricingMethodId]);

  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<InvoiceTypeId, number>> = {};
    for (const item of items) {
      counts[item.invoiceTypeId] = (counts[item.invoiceTypeId] ?? 0) + 1;
    }
    return counts;
  }, [items]);

  const presentCategories = useMemo(
    () => INVOICE_TYPE_REGISTRY.filter((def) => (categoryCounts[def.id] ?? 0) > 0),
    [categoryCounts],
  );

  const displayedItems = useMemo(() => {
    const list =
      categoryFilter === 'all' ? items : items.filter((item) => item.invoiceTypeId === categoryFilter);
    const sorted = [...list];
    if (sortMode === 'name') {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      sorted.sort((a, b) => b.defaultPrice - a.defaultPrice);
    }
    return sorted;
  }, [items, categoryFilter, sortMode]);

  const handlePressItem = (item: Item) => {
    if (onSelectItem) {
      if (requiredPricingMethodId && item.invoiceTypeId !== requiredPricingMethodId) {
        const itemMethodLabel = getInvoiceTypeDefinition(item.invoiceTypeId).label;
        const invoiceMethodLabel = getInvoiceTypeDefinition(requiredPricingMethodId).label;
        Alert.alert(
          'Incompatible pricing method',
          `This item uses ${itemMethodLabel} pricing and cannot be added to this ${invoiceMethodLabel} invoice.`,
        );
        return;
      }
      onSelectItem(item);
      navigation.goBack();
      return;
    }
    navigation.navigate('EditItem', { itemId: item.id });
  };

  const handleEditItem = (item: Item) => {
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
    navigation.navigate(
      'CreateItem',
      onSelectItem ? { onCreated: onSelectItem, defaultInvoiceTypeId: requiredPricingMethodId } : undefined,
    );
  };

  return (
    <View style={styles.screen} testID="item-list-screen">
      <View style={styles.controlBar}>
        <Text style={styles.subtitle}>Manage products, services &amp; pricing</Text>

        <View style={styles.searchRow}>
          <View style={styles.searchPill}>
            <Feather name="search" size={18} color={colors.textMuted} />
            <TextInput
              value={filter.searchText}
              onChangeText={(text) => setFilter({ searchText: text })}
              placeholder="Search items, SKU, or category..."
              placeholderTextColor={colors.placeholder}
              style={styles.searchInput}
              testID="item-search"
            />
            {status === 'ready' && (
              <View style={styles.countPill}>
                <Text style={styles.countPillText}>
                  {items.length} {items.length === 1 ? 'item' : 'items'}
                </Text>
              </View>
            )}
          </View>
          {!requiredPricingMethodId && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Toggle sort order"
              testID="item-sort-toggle"
              onPress={() => setSortMode((m) => (m === 'name' ? 'price' : 'name'))}
              style={styles.sortButton}
            >
              <Feather name="repeat" size={16} color={colors.primary} />
              <Text style={styles.sortButtonText}>{sortMode === 'name' ? 'A-Z' : 'Price'}</Text>
            </Pressable>
          )}
        </View>

        {requiredPricingMethodId ? (
          <View style={styles.lockedFilterNote} testID="item-type-filter-locked">
            <Feather name="lock" size={12} color={colors.textMuted} />
            <Text style={styles.lockedFilterText}>
              Showing {getInvoiceTypeDefinition(requiredPricingMethodId).label} items only — this invoice is
              priced by {getInvoiceTypeDefinition(requiredPricingMethodId).label}.
            </Text>
          </View>
        ) : (
          <View testID="item-type-filter">
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={[{ id: 'all' as const, label: 'All Items' }, ...presentCategories]}
              keyExtractor={(entry) => entry.id}
              contentContainerStyle={styles.chipRow}
              renderItem={({ item: entry }) => {
                const active = categoryFilter === entry.id;
                const count = entry.id === 'all' ? items.length : categoryCounts[entry.id as InvoiceTypeId] ?? 0;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Filter: ${entry.label}`}
                    accessibilityState={{ selected: active }}
                    testID={`item-type-filter-${entry.id}`}
                    onPress={() => setCategoryFilter(entry.id as CategoryFilter)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{entry.label}</Text>
                    <Text style={[styles.chipCount, active && styles.chipCountActive]}>({count})</Text>
                  </Pressable>
                );
              }}
            />
          </View>
        )}
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
          {filter.searchText ? (
            <Text style={styles.emptyText}>No items match your search.</Text>
          ) : (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconCircle}>
                <Feather name="package" size={26} color={colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No items yet in catalog</Text>
              <Text style={styles.emptySubtitle}>
                Add your first item to quickly populate invoices and estimates without retyping details.
              </Text>
              <ActionButton label="Add First Item" icon="plus" onPress={handleCreate} testID="item-empty-add" />
            </View>
          )}
        </View>
      )}

      {status === 'ready' && items.length > 0 && displayedItems.length === 0 && (
        <View style={styles.centered} testID="item-list-no-filter-matches">
          <Text style={styles.emptyText}>No items match this filter.</Text>
        </View>
      )}

      {status === 'ready' && displayedItems.length > 0 && (
        <FlatList
          testID="item-list"
          data={displayedItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => (
            <ItemListRow
              item={item}
              onPress={() => handlePressItem(item)}
              onEdit={() => handleEditItem(item)}
              onDelete={() => handleDeleteItem(item)}
              testID={`item-row-${item.id}`}
            />
          )}
        />
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add new item"
        testID="action-create-item"
        onPress={handleCreate}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      >
        <Feather name="plus" size={18} color={colors.primaryText} />
        <Text style={styles.fabText}>Add Item</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  controlBar: { padding: 16, paddingBottom: 10, gap: 10, backgroundColor: colors.background },
  subtitle: { fontSize: 12, color: colors.textMuted, marginTop: -4 },
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
  countPill: { backgroundColor: colors.background, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  countPillText: { fontSize: 10, fontWeight: '700', color: colors.textMuted },
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
  lockedFilterNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  lockedFilterText: { flex: 1, fontSize: 12, color: colors.textMuted },
  chipRow: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  chipTextActive: { color: colors.primaryText },
  chipCount: { fontSize: 11, fontWeight: '500', color: colors.placeholder },
  chipCountActive: { color: colors.primaryText, opacity: 0.8 },
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
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
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
  fabPressed: { opacity: 0.85 },
  fabText: { color: colors.primaryText, fontWeight: '700', fontSize: 14 },
});
