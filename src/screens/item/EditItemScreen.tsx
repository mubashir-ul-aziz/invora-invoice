import { Feather } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { ItemFormFields } from '@/components/item/ItemFormFields';
import { BottomActionBar } from '@/components/shared/BottomActionBar';
import { KeyboardAvoidingScreen } from '@/components/shared/KeyboardAvoidingScreen';
import type { Item } from '@/domain/item/types';
import { formValuesToItemInput, itemToFormDefaults } from '@/domain/item/formMapping';
import { itemFormSchema, type ItemFormOutput, type ItemFormValues } from '@/domain/item/validation';
import type { RootStackParamList } from '@/navigation/types';
import { useItemStore } from '@/state/itemStore';
import { toast } from '@/state/toastStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'EditItem'>;

type LoadStatus = 'loading' | 'ready' | 'error' | 'not-found';

/**
 * Edit Item screen, restyled to match the Stitch "Edit Item" design: a top
 * action row with the item's real id + a Save shortcut, the same
 * `ItemFormFields` cards Create Item uses, a Danger Zone with a real delete
 * action, and a sticky Save Changes button.
 *
 * Real, backend-connected elements:
 * - Every field in `ItemFormFields` loads from and saves to the existing
 *   item record via `itemStore.update`.
 * - The id badge shows the item's real `id` (truncated/uppercased for
 *   display, not a fabricated "ITM-" sequence).
 * - Delete Item calls `itemStore.remove` for real, with the same
 *   confirmation-modal pattern as Edit Customer's Danger Zone.
 */
export function EditItemScreen({ navigation, route }: Props) {
  const { itemId } = route.params;
  const { getById, update, remove } = useItemStore();
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [item, setItem] = useState<Item | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ItemFormValues, unknown, ItemFormOutput>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: itemToFormDefaults(null),
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const found = await getById(itemId);
        if (cancelled) {
          return;
        }
        if (!found) {
          setStatus('not-found');
          return;
        }
        setItem(found);
        reset(itemToFormDefaults(found));
        setStatus('ready');
      } catch {
        if (!cancelled) {
          setStatus('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await update(itemId, formValuesToItemInput(values));
      toast.success('Item changes saved');
      navigation.goBack();
    } catch {
      toast.error({ title: "Couldn't save", message: 'Your changes could not be saved. Please try again.' });
    }
  });

  const handleDelete = async () => {
    setDeleteModalVisible(false);
    setDeleting(true);
    try {
      await remove(itemId);
      toast.success('Item deleted');
      navigation.navigate('ItemList');
    } catch {
      setDeleting(false);
      toast.error({ title: "Couldn't delete", message: 'This item could not be deleted. Please try again.' });
    }
  };

  if (status === 'loading') {
    return (
      <View style={styles.centered} testID="edit-item-loading">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (status === 'not-found') {
    return (
      <View style={styles.centered} testID="edit-item-not-found">
        <Text style={styles.errorText}>This item no longer exists.</Text>
        <ActionButton label="Go back" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  if (status === 'error' || !item) {
    return (
      <View style={styles.centered} testID="edit-item-error">
        <Text style={styles.errorText}>Couldn't load this item.</Text>
        <ActionButton label="Go back" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingScreen
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="edit-item-screen"
      footer={
        <BottomActionBar
          primary={{
            label: isSubmitting ? 'Saving…' : 'Save Changes',
            accessibilityLabel: 'Save Changes',
            icon: 'check',
            onPress: onSubmit,
            disabled: isSubmitting || deleting,
            testID: 'save-item',
          }}
        />
      }
    >
      {/* Top action / context row */}
      <View style={styles.topRow}>
        <View style={styles.topBadges}>
          <View style={styles.idBadge}>
            <Text style={styles.idBadgeText}>ID: {item.id.slice(0, 8).toUpperCase()}</Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save"
          testID="action-save-top"
          onPress={onSubmit}
          disabled={isSubmitting || deleting}
          style={({ pressed }) => [styles.savePill, pressed && styles.pressed]}
        >
          <Text style={styles.savePillText}>Save</Text>
        </Pressable>
      </View>

      <ItemFormFields control={control} errors={errors} />

      {/* Danger Zone */}
      <View style={styles.dangerCard}>
        <View style={styles.dangerHeaderRow}>
          <View style={styles.dangerIcon}>
            <Feather name="alert-triangle" size={18} color={colors.danger} />
          </View>
          <View style={styles.dangerTextCol}>
            <Text style={styles.dangerTitle}>Danger Zone</Text>
            <Text style={styles.dangerCaption}>
              Removes this item from the catalog. Past invoices that already used it keep their own saved copy of its
              details.
            </Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete item"
          testID="action-delete-item"
          onPress={() => setDeleteModalVisible(true)}
          disabled={deleting}
          style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
        >
          <Feather name="trash-2" size={18} color={colors.danger} />
          <Text style={styles.deleteButtonText}>{deleting ? 'Deleting…' : 'Delete Item'}</Text>
        </Pressable>
      </View>

      {/* Deletion confirmation modal */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalBackdrop} testID="confirm-delete-modal">
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <Feather name="trash-2" size={24} color={colors.danger} />
            </View>
            <Text style={styles.modalTitle}>Confirm Deletion?</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to remove <Text style={styles.modalMessageBold}>{item.name}</Text>? This action
              cannot be undone.
            </Text>
            <Pressable
              accessibilityRole="button"
              testID="confirm-delete-btn"
              onPress={handleDelete}
              style={({ pressed }) => [styles.modalDeleteButton, pressed && styles.pressed]}
            >
              <Text style={styles.modalDeleteButtonText}>Yes, Delete Item</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              testID="cancel-delete-btn"
              onPress={() => setDeleteModalVisible(false)}
              style={({ pressed }) => [styles.modalCancelButton, pressed && styles.pressed]}
            >
              <Text style={styles.modalCancelButtonText}>Keep Item</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  pressed: { opacity: 0.75 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  errorText: { color: colors.danger, fontWeight: '600' },

  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  topBadges: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, flexWrap: 'wrap' },
  idBadge: { backgroundColor: colors.surface, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  idBadgeText: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  savePill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 12, backgroundColor: colors.surface },
  savePillText: { fontSize: 14, fontWeight: '700', color: colors.primary },

  dangerCard: { backgroundColor: '#FBE4E2', borderRadius: 16, padding: 16, gap: 12 },
  dangerHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dangerIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F5C6C1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerTextCol: { flex: 1, gap: 3 },
  dangerTitle: { fontSize: 15, fontWeight: '700', color: colors.danger },
  dangerCaption: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  deleteButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F5C6C1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deleteButtonText: { fontSize: 14, fontWeight: '700', color: colors.danger },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(11,28,48,0.4)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 12,
    alignItems: 'center',
  },
  modalIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FBE4E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  modalMessage: { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 18 },
  modalMessageBold: { fontWeight: '700', color: colors.text },
  modalDeleteButton: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  modalDeleteButtonText: { fontSize: 14, fontWeight: '700', color: colors.primaryText },
  modalCancelButton: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelButtonText: { fontSize: 14, fontWeight: '700', color: colors.text },
});
