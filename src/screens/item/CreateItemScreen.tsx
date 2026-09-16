import { Feather } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { useForm } from 'react-hook-form';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { ItemFormFields } from '@/components/item/ItemFormFields';
import { KeyboardAvoidingScreen } from '@/components/shared/KeyboardAvoidingScreen';
import { formValuesToItemInput, itemToFormDefaults } from '@/domain/item/formMapping';
import { itemFormSchema, type ItemFormOutput, type ItemFormValues } from '@/domain/item/validation';
import type { RootStackParamList } from '@/navigation/types';
import { useItemStore } from '@/state/itemStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateItem'>;

/**
 * Create Item screen, restyled to match the Stitch "Create Item" design: a
 * Catalog Management context header, Item Identification / Pricing & Units /
 * Pricing Method / Item Description cards (all in `ItemFormFields`, see its
 * doc comment for the DESIGN ONLY elements within), and a sticky
 * Cancel/Save Item bottom dock.
 *
 * When opened with `route.params.onCreated` (the "add item while creating an
 * invoice" flow — see `navigation/types.ts`), the newly created item is
 * handed back to the caller instead of the screen just closing on its own.
 */
export function CreateItemScreen({ navigation, route }: Props) {
  const { create } = useItemStore();
  const onCreated = route.params?.onCreated;
  const defaultInvoiceTypeId = route.params?.defaultInvoiceTypeId;

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ItemFormValues, unknown, ItemFormOutput>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: {
      ...itemToFormDefaults(null),
      ...(defaultInvoiceTypeId ? { invoiceTypeId: defaultInvoiceTypeId } : {}),
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const created = await create(formValuesToItemInput(values));
      onCreated?.(created);
      navigation.goBack();
    } catch {
      Alert.alert("Couldn't save", 'This item could not be created. Please try again.');
    }
  });

  return (
    <KeyboardAvoidingScreen
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="create-item-screen"
    >
      {/* Context header card */}
      <View style={styles.contextCard}>
        <View style={styles.contextLeft}>
          <View style={styles.contextIcon}>
            <Feather name="package" size={20} color={colors.primary} />
          </View>
          <View>
            <Text style={styles.contextEyebrow}>Catalog Management</Text>
            <Text style={styles.contextTitle}>Add New Catalog Item</Text>
          </View>
        </View>
        <View style={styles.stepBadge}>
          <Text style={styles.stepBadgeText}>Step 1 of 1</Text>
        </View>
      </View>

      <ItemFormFields control={control} errors={errors} lockedInvoiceTypeId={defaultInvoiceTypeId ?? null} />

      {/* Sticky bottom Cancel / Save dock */}
      <View style={styles.dock}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          testID="action-cancel"
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.dockCancel, pressed && styles.pressed]}
        >
          <Text style={styles.dockCancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save Item"
          testID="save-item"
          onPress={onSubmit}
          disabled={isSubmitting}
          style={({ pressed }) => [
            styles.dockSave,
            isSubmitting && styles.dockSaveDisabled,
            pressed && !isSubmitting && styles.pressed,
          ]}
        >
          <Feather name="check" size={18} color={colors.primaryText} />
          <Text style={styles.dockSaveText}>{isSubmitting ? 'Saving…' : 'Save Item'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  pressed: { opacity: 0.75 },

  contextCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  contextLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  contextIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contextEyebrow: { fontSize: 10, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },
  contextTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 2 },
  stepBadge: { backgroundColor: colors.background, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  stepBadgeText: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },

  dock: { flexDirection: 'row', gap: 10, marginTop: 4 },
  dockCancel: {
    width: '33%',
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockCancelText: { fontSize: 14, fontWeight: '700', color: colors.text },
  dockSave: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dockSaveDisabled: { opacity: 0.6 },
  dockSaveText: { fontSize: 14, fontWeight: '700', color: colors.primaryText },
});
