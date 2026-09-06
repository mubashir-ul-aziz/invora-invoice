import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { ItemFormFields } from '@/components/item/ItemFormFields';
import { formValuesToItemInput, itemToFormDefaults } from '@/domain/item/formMapping';
import { itemFormSchema, type ItemFormOutput, type ItemFormValues } from '@/domain/item/validation';
import type { RootStackParamList } from '@/navigation/types';
import { useItemStore } from '@/state/itemStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'EditItem'>;

type LoadStatus = 'loading' | 'ready' | 'error' | 'not-found';

export function EditItemScreen({ navigation, route }: Props) {
  const { itemId } = route.params;
  const { getById, update } = useItemStore();
  const [status, setStatus] = useState<LoadStatus>('loading');

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
      navigation.goBack();
    } catch {
      Alert.alert("Couldn't save", 'Your changes could not be saved. Please try again.');
    }
  });

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

  if (status === 'error') {
    return (
      <View style={styles.centered} testID="edit-item-error">
        <Text style={styles.errorText}>Couldn't load this item.</Text>
        <ActionButton label="Go back" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="edit-item-screen"
    >
      <ItemFormFields control={control} errors={errors} />
      <ActionButton
        label={isSubmitting ? 'Saving…' : 'Save changes'}
        variant="primary"
        onPress={onSubmit}
        disabled={isSubmitting}
        testID="save-item"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  errorText: { color: colors.danger, fontWeight: '600' },
});
